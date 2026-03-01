/**
 * 股票历史行情爬虫脚本
 * 用于爬取股票的历史K线数据（开盘价、收盘价、最高价、最低价、成交量、成交额等）
 *
 * 使用方法:
 * node crawler/dailyStockSpider.js                     # 抓取所有股票最近30天数据
 * node crawler/dailyStockSpider.js --days=365          # 抓取所有股票最近365天数据
 * node crawler/dailyStockSpider.js --codes=00700,002027 # 仅抓取指定股票
 * node crawler/dailyStockSpider.js --from-2024         # 抓取2024年1月1日至今的数据（自动检测缺失数据）
 * node crawler/dailyStockSpider.js --recalc-rsi        # 重新计算所有股票的RSI指标
 *
 * 分批抓取（避免一次性抓取过多）:
 * node crawler/dailyStockSpider.js --from-2024 --batch=20            # 每次抓20只股票
 * node crawler/dailyStockSpider.js --from-2024 --batch=20 --offset=20 # 从第21只开始抓
 *
 * 技术特点：
 * 1、双接口支持：腾讯接口（主要）+ 东方财富接口（备用）
 * 2、增量更新：自动检测已有数据，只抓取新日期
 * 3、断点续传：自动检测缺失的历史数据
 * 4、分批抓取：支持批量处理，避免一次性请求过多
 * 5、A股/港股兼容：自动识别市场代码
 * 6、重试机制：请求失败自动重试
 * 7、UTF-8 BOM：确保 Windows 正确识别编码
 * 8、成交额计算：成交量 × 收盘价
 * 9、换手率计算：成交额 / 流通市值
 * 10、RSI指标：自动计算RSI6/RSI12/RSI24
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const STOCKS_FILE = path.join(DATA_DIR, "stocks.csv");
const STOCK_HISTORY_FILE = path.join(DATA_DIR, "stock_history.csv");

// 起始日期常量（2024-01-02是2024年第一个交易日）
const START_DATE_2024 = "2024-01-02";

// CSV 表头（包含RSI字段）
const CSV_HEADERS = [
  "id",
  "stock_code",
  "stock_name",
  "trade_date",
  "is_open",
  "open",
  "close",
  "high",
  "low",
  "volume",
  "amount",
  "float_cap",
  "turnover_rate",
  "pe_ttm",
  "pb",
  "rsi6",
  "rsi12",
  "rsi24",
  "created_at",
];

// ========== RSI 计算模块 ==========

/**
 * 计算单个周期的RSI
 * RSI = 100 - 100 / (1 + RS)
 * RS = 平均上涨幅度 / 平均下跌幅度
 * 
 * @param {number[]} closes - 收盘价数组（按时间升序）
 * @param {number} period - RSI周期
 * @returns {(number|null)[]} RSI值数组
 */
function calculateRSI(closes, period) {
  if (!closes || closes.length < period + 1) {
    return closes.map(() => null);
  }

  const rsiValues = [];
  const gains = [];
  const losses = [];

  // 计算每日涨跌幅
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // 前period个数据无法计算RSI（因为需要前一日的数据）
  for (let i = 0; i < period; i++) {
    rsiValues.push(null);
  }

  // 计算第一个RSI值
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    rsiValues.push(100);
  } else {
    const rs = avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  // 计算后续RSI值（Wilder平滑）
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
  }

  return rsiValues;
}

/**
 * 批量计算RSI指标
 * @param {number[]} closes - 收盘价数组
 * @returns {{rsi6: number, rsi12: number, rsi24: number}[]} 每日RSI值数组
 */
function calculateAllRSI(closes) {
  const rsi6 = calculateRSI(closes, 6);
  const rsi12 = calculateRSI(closes, 12);
  const rsi24 = calculateRSI(closes, 24);

  return closes.map((_, i) => ({
    rsi6: rsi6[i],
    rsi12: rsi12[i],
    rsi24: rsi24[i],
  }));
}

/**
 * 格式化RSI值
 * @param {number|null} value - RSI值
 * @returns {string} 格式化后的字符串
 */
function formatRSI(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return "";
  }
  return value.toFixed(2);
}

// 请求头
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
  Accept: "*/*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

/**
 * HTTP GET 请求封装（带重试机制）
 */
function httpRequest(url, retries = 3, delayMs = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = https.get(
        url,
        { headers: HEADERS, timeout: 15000 },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ data, statusCode: res.statusCode }));
        }
      );

      req.on("error", (err) => {
        if (n > 0) {
          console.log(
            `    请求失败，${delayMs / 1000}秒后重试 (${
              retries - n + 1
            }/${retries})...`
          );
          setTimeout(() => attempt(n - 1), delayMs);
        } else {
          reject(err);
        }
      });

      req.on("timeout", () => {
        req.destroy();
        if (n > 0) {
          console.log(
            `    请求超时，${delayMs / 1000}秒后重试 (${
              retries - n + 1
            }/${retries})...`
          );
          setTimeout(() => attempt(n - 1), delayMs);
        } else {
          reject(new Error("Request timeout"));
        }
      });
    };

    attempt(retries);
  });
}

/**
 * 根据股票代码获取市场代码
 * 腾讯股票接口格式
 */
function getTencentCode(stockCode) {
  // 港股：5位数字
  if (stockCode.length === 5) {
    return `hk${stockCode}`;
  }
  // 上海A股：6开头
  if (stockCode.startsWith("6")) {
    return `sh${stockCode}`;
  }
  // 深圳A股：0/3开头
  return `sz${stockCode}`;
}

/**
 * 根据股票代码获取东方财富 secid
 */
function getEastmoneySecId(stockCode) {
  if (stockCode.length === 5) {
    return `116.${stockCode}`; // 港股
  }
  if (stockCode.startsWith("6")) {
    return `1.${stockCode}`; // 上海
  }
  return `0.${stockCode}`; // 深圳
}

/**
 * 获取股票实时行情（包含市值信息）- 使用腾讯接口
 */
async function getStockRealtimeQuote(stockCode) {
  // 构建腾讯股票代码
  let tencentCode;
  if (stockCode.length === 5) {
    tencentCode = `hk${stockCode}`; // 港股
  } else if (stockCode.startsWith("6")) {
    tencentCode = `sh${stockCode}`; // 上海
  } else {
    tencentCode = `sz${stockCode}`; // 深圳
  }

  const url = `https://qt.gtimg.cn/q=${tencentCode}`;

  try {
    const { data } = await httpRequest(url, 2, 1500);

    // 解析腾讯接口返回的数据
    // 格式: v_sz002027="51~股票名称~代码~...~总市值~流通市值~...";
    const match = data.match(/="([^"]+)"/);
    if (!match) return null;

    const parts = match[1].split("~");
    if (parts.length < 46) return null;

    // 字段索引（从0开始）：
    // 44: 总市值（亿元）, 45: 流通市值（亿元）
    // 46: 市盈率（PE-TTM）, 47: 市净率（PB）
    const totalCapYi = parseFloat(parts[44]) || 0;
    const floatCapYi = parseFloat(parts[45]) || 0;
    const pe_ttm = parseFloat(parts[46]) || 0;
    const pb = parseFloat(parts[47]) || 0;

    return {
      total_cap: Math.round(totalCapYi * 100000000), // 转换为元
      float_cap: Math.round(floatCapYi * 100000000), // 转换为元
      pe_ttm: pe_ttm,
      pb: pb,
    };
  } catch (error) {
    return null;
  }
}

/**
 * 批量获取股票市值信息（缓存优化）
 */
const marketCapCache = new Map();
async function getMarketCap(stockCode) {
  // 检查缓存（有效期10分钟）
  const cached = marketCapCache.get(stockCode);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
    return cached.data;
  }

  const quote = await getStockRealtimeQuote(stockCode);
  const data = quote ? {
    float_cap: quote.float_cap,
    total_cap: quote.total_cap,
    pe_ttm: quote.pe_ttm,
    pb: quote.pb,
  } : null;

  // 更新缓存
  marketCapCache.set(stockCode, { data, time: Date.now() });
  return data;
}

/**
 * 从腾讯接口获取股票K线数据（主要接口）
 */
async function getStockKlinesFromTencent(stockCode, limit = 30) {
  const code = getTencentCode(stockCode);
  const random = Math.random().toString().replace("0.", "");
  // qfq = 前复权, day = 日K线
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?_var=kline_dayqfq&param=${code},day,,,${limit},qfq&r=${random}`;

  try {
    const { data } = await httpRequest(url, 2, 1500);

    // 解析 JSONP 格式数据
    const jsonMatch = data.match(/kline_dayqfq=(\{[\s\S]*\})/);
    if (!jsonMatch) return null;

    const json = JSON.parse(jsonMatch[1]);

    if (json.code !== 0 || !json.data) return null;

    // 获取股票数据 - 可能是 qfqday 或 day
    const stockData = json.data[code];
    if (!stockData) return null;

    const klines = stockData.qfqday || stockData.day;
    if (!klines || klines.length === 0) return null;

    // 解析K线数据
    // 格式: [日期, 开盘, 收盘, 最高, 最低, 成交量]
    // 注意：腾讯接口返回的成交量可能是"手"或"股"，需要智能判断
    return klines.map((item) => {
      let volume = parseInt(item[5] || "0");
      // 如果成交量看起来太小（<100万），可能是"手"单位，需要乘以100
      // 正常A股日成交量应该在百万级别以上
      if (volume > 0 && volume < 1000000) {
        volume = volume * 100;
      }
      // 成交额 = 成交量 × 收盘价（估算值）
      const close = parseFloat(item[2]) || 0;
      const amount = Math.round(volume * close);
      return {
        trade_date: item[0],
        open: item[1],
        close: item[2],
        high: item[3],
        low: item[4],
        volume: String(volume),
        amount: String(amount),
      };
    });
  } catch (error) {
    return null;
  }
}

/**
 * 从东方财富接口获取股票K线数据（备用接口）
 * @param {string} stockCode - 股票代码
 * @param {number} limit - 获取条数
 * @param {string} startDate - 起始日期 (YYYY-MM-DD)
 */
async function getStockKlinesFromEastmoney(stockCode, limit = 30, startDate = null) {
  const secid = getEastmoneySecId(stockCode);
  let url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?` +
    `secid=${secid}&` +
    `fields1=f1,f2,f3,f4,f5,f6&` +
    `fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&` +
    `klt=101&fqt=1&end=20500101&lmt=${limit}`;
  
  // 如果指定了起始日期，添加beg参数
  if (startDate) {
    url += `&beg=${startDate.replace(/-/g, '')}`;
  }

  try {
    const { data } = await httpRequest(url, 2, 1500);
    const json = JSON.parse(data);

    if (!json.data || !json.data.klines) return null;

    // 格式: 日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率
    return json.data.klines.map((line) => {
      const parts = line.split(",");
      return {
        trade_date: parts[0],
        open: parts[1],
        close: parts[2],
        high: parts[3],
        low: parts[4],
        volume: parts[5],
        amount: parts[6], // 东方财富直接提供成交额
      };
    });
  } catch (error) {
    return null;
  }
}

/**
 * 获取股票K线数据（自动切换接口）
 * @param {string} stockCode - 股票代码
 * @param {number} limit - 获取条数
 * @param {string} startDate - 起始日期 (YYYY-MM-DD)，用于获取历史数据
 */
async function getStockKlines(stockCode, limit = 30, startDate = null) {
  // 如果需要获取大量历史数据，优先使用东方财富接口
  if (startDate || limit > 100) {
    const klines = await getStockKlinesFromEastmoney(stockCode, limit, startDate);
    if (klines && klines.length > 0) {
      return { data: klines, source: "eastmoney" };
    }
  }

  // 先尝试腾讯接口
  let klines = await getStockKlinesFromTencent(stockCode, limit);

  if (klines && klines.length > 0) {
    return { data: klines, source: "tencent" };
  }

  // 腾讯失败，尝试东方财富
  klines = await getStockKlinesFromEastmoney(stockCode, limit, startDate);

  if (klines && klines.length > 0) {
    return { data: klines, source: "eastmoney" };
  }

  return { data: [], source: "failed" };
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 从 stocks.csv 提取唯一股票代码和名称
 */
function getUniqueStocks() {
  if (!fs.existsSync(STOCKS_FILE)) {
    console.log("stocks.csv 文件不存在");
    return [];
  }

  let content = fs.readFileSync(STOCKS_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",");
  const codeIndex = headers.indexOf("stock_code");
  const nameIndex = headers.indexOf("stock_name");

  if (codeIndex === -1) return [];

  const stockMap = new Map();
  lines.slice(1).forEach((line) => {
    const values = parseCSVRow(line);
    const code = values[codeIndex];
    const name = values[nameIndex] || "";
    if (code && !stockMap.has(code)) {
      stockMap.set(code, name);
    }
  });

  return Array.from(stockMap.entries()).map(([code, name]) => ({ code, name }));
}

/**
 * 读取现有股票历史数据
 */
function readStockHistory() {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) {
    return [];
  }

  let content = fs.readFileSync(STOCK_HISTORY_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",");
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseCSVRow(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return obj;
    });
}

/**
 * 获取股票已有数据的最新日期
 */
function getLatestDate(existingData, stockCode) {
  const stockData = existingData.filter((d) => d.stock_code === stockCode);
  if (stockData.length === 0) return null;

  const dates = stockData
    .map((d) => d.trade_date)
    .sort()
    .reverse();
  return dates[0];
}

/**
 * 写入股票历史数据
 */
function writeStockHistory(records) {
  const headerLine = CSV_HEADERS.join(",");
  const lines = [
    headerLine,
    ...records.map((r) => {
      return CSV_HEADERS
        .map((h) => {
          const val = r[h] ?? "";
          if (String(val).includes(",") || String(val).includes('"')) {
            return `"${String(val).replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",");
    }),
  ];

  const BOM = "\uFEFF";
  fs.writeFileSync(STOCK_HISTORY_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 为股票数据计算并填充RSI值
 * @param {Array} records - 股票历史数据（同一只股票）
 * @returns {Array} 添加了RSI字段的记录
 */
function calculateAndFillRSI(records) {
  if (!records || records.length === 0) return records;

  // 按日期升序排序
  const sorted = [...records].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  
  // 提取收盘价
  const closes = sorted.map(r => parseFloat(r.close) || 0);
  
  // 计算RSI
  const rsiValues = calculateAllRSI(closes);
  
  // 填充RSI值
  sorted.forEach((record, i) => {
    record.rsi6 = formatRSI(rsiValues[i].rsi6);
    record.rsi12 = formatRSI(rsiValues[i].rsi12);
    record.rsi24 = formatRSI(rsiValues[i].rsi24);
  });
  
  return sorted;
}

/**
 * 保存K线数据（增量更新）
 * @param {string} stockCode 股票代码
 * @param {string} stockName 股票名称
 * @param {Array} klines K线数据
 * @param {Array} existingData 已有数据
 * @param {boolean} forceToday 是否强制更新今日数据
 * @param {Object} marketCap 市值信息 { float_cap, total_cap }
 * @returns {Object} { newRecords, updatedRecords, todayDate }
 */
function saveKlines(stockCode, stockName, klines, existingData, forceToday = false, marketCap = null) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10); // YYYY-MM-DD

  const existingDates = new Set(
    existingData
      .filter((d) => d.stock_code === stockCode)
      .map((d) => d.trade_date)
  );

  // 计算换手率的辅助函数
  const calculateTurnoverRate = (amount) => {
    if (!marketCap || !marketCap.float_cap || marketCap.float_cap <= 0) {
      return "";
    }
    // 换手率 = 成交额 / 流通市值 * 100%
    const rate = (parseFloat(amount) / marketCap.float_cap) * 100;
    return rate.toFixed(2);
  };

  let newRecords = [];
  let updatedRecords = [];

  if (forceToday) {
    // 强制更新今日数据：找出今日的K线数据并标记为需要更新
    const todayKlines = klines.filter((k) => k.trade_date === today);
    if (todayKlines.length > 0) {
      updatedRecords = todayKlines.map((k) => ({
        id: generateId(),
        stock_code: stockCode,
        stock_name: stockName,
        trade_date: k.trade_date,
        is_open: "1",
        open: k.open,
        close: k.close,
        high: k.high,
        low: k.low,
        volume: k.volume,
        amount: k.amount,
        float_cap: marketCap ? String(marketCap.float_cap) : "",
        turnover_rate: calculateTurnoverRate(k.amount),
        pe_ttm: marketCap ? String(marketCap.pe_ttm) : "",
        pb: marketCap ? String(marketCap.pb) : "",
        rsi6: "",
        rsi12: "",
        rsi24: "",
        created_at: now,
      }));
    }
    // 其他日期的数据按增量处理
    newRecords = klines
      .filter((k) => k.trade_date !== today && !existingDates.has(k.trade_date) && k.trade_date <= today)
      .map((k) => ({
        id: generateId(),
        stock_code: stockCode,
        stock_name: stockName,
        trade_date: k.trade_date,
        is_open: "1",
        open: k.open,
        close: k.close,
        high: k.high,
        low: k.low,
        volume: k.volume,
        amount: k.amount,
        float_cap: marketCap ? String(marketCap.float_cap) : "",
        turnover_rate: calculateTurnoverRate(k.amount),
        pe_ttm: marketCap ? String(marketCap.pe_ttm) : "",
        pb: marketCap ? String(marketCap.pb) : "",
        rsi6: "",
        rsi12: "",
        rsi24: "",
        created_at: now,
      }));
  } else {
    // 正常增量更新
    newRecords = klines
      .filter((k) => !existingDates.has(k.trade_date) && k.trade_date <= today)
      .map((k) => ({
        id: generateId(),
        stock_code: stockCode,
        stock_name: stockName,
        trade_date: k.trade_date,
        is_open: "1",
        open: k.open,
        close: k.close,
        high: k.high,
        low: k.low,
        volume: k.volume,
        amount: k.amount,
        float_cap: marketCap ? String(marketCap.float_cap) : "",
        turnover_rate: calculateTurnoverRate(k.amount),
        pe_ttm: marketCap ? String(marketCap.pe_ttm) : "",
        pb: marketCap ? String(marketCap.pb) : "",
        rsi6: "",
        rsi12: "",
        rsi24: "",
        created_at: now,
      }));
  }

  return { newRecords, updatedRecords, todayDate: today };
}

/**
 * 爬取单个股票的K线数据
 * @param {string} stockCode - 股票代码
 * @param {string} stockName - 股票名称
 * @param {number} days - 天数
 * @param {Array} existingData - 已有数据
 * @param {boolean} forceToday - 是否强制更新今日数据
 * @param {string} startDate - 起始日期 (YYYY-MM-DD)
 */
async function crawlStock(stockCode, stockName, days = 30, existingData = [], forceToday = false, startDate = null) {
  console.log(`正在爬取 ${stockCode} ${stockName}...`);

  const latestDate = getLatestDate(existingData, stockCode);
  const needDays = latestDate && !startDate ? Math.min(days, 30) : days;

  // 获取市值信息（用于计算换手率）
  const marketCap = await getMarketCap(stockCode);
  if (marketCap && marketCap.float_cap > 0) {
    const floatCapYi = (marketCap.float_cap / 100000000).toFixed(2);
    console.log(`  流通市值: ${floatCapYi}亿`);
  }

  const { data: klines, source } = await getStockKlines(stockCode, needDays, startDate);

  if (klines.length === 0) {
    console.log(`  获取数据失败 (来源: ${source})`);
    return { newRecords: [], updatedRecords: [], todayDate: null };
  }

  console.log(`  数据来源: ${source}, 获取 ${klines.length} 条`);

  const { newRecords, updatedRecords, todayDate } = saveKlines(stockCode, stockName, klines, existingData, forceToday, marketCap);

  if (forceToday && updatedRecords.length > 0) {
    console.log(`  强制更新今日数据 (${todayDate})`);
  }
  if (newRecords.length > 0) {
    console.log(
      `  新增 ${newRecords.length} 条数据 (${newRecords[0].trade_date} ~ ${
        newRecords[newRecords.length - 1].trade_date
      })`
    );
  }
  if (!forceToday && newRecords.length === 0) {
    console.log(`  无新数据 (已有最新数据: ${latestDate || "无"})`);
  }

  return { newRecords, updatedRecords, todayDate };
}

/**
 * 获取股票已有数据的最早日期
 */
function getEarliestDate(existingData, stockCode) {
  const stockData = existingData.filter((d) => d.stock_code === stockCode);
  if (stockData.length === 0) return null;

  const dates = stockData
    .map((d) => d.trade_date)
    .sort();
  return dates[0];
}

/**
 * 检查需要补充历史数据的股票
 * @param {Array} stocks - 股票列表
 * @param {Array} existingData - 已有数据
 * @param {string} targetDate - 目标起始日期
 * @returns {Array} 需要补充数据的股票列表
 */
function findStocksNeedHistory(stocks, existingData, targetDate) {
  const needHistory = [];
  
  for (const stock of stocks) {
    const earliest = getEarliestDate(existingData, stock.code);
    if (!earliest || earliest > targetDate) {
      needHistory.push({
        ...stock,
        earliestDate: earliest,
        needFrom: targetDate,
      });
    }
  }
  
  return needHistory;
}

/**
 * 爬取所有股票的K线数据
 * @param {number} days - 天数
 * @param {string[]|null} specificCodes - 指定股票代码
 * @param {boolean} forceToday - 是否强制更新今日数据
 * @param {boolean} calcRSI - 是否计算RSI
 * @param {string|null} startDate - 起始日期 (YYYY-MM-DD)
 * @param {number} batchSize - 每批处理的股票数量（0表示全部）
 * @param {number} batchOffset - 起始偏移量
 */
async function crawlAllStocks(days = 30, specificCodes = null, forceToday = false, calcRSI = true, startDate = null, batchSize = 0, batchOffset = 0) {
  console.log("开始爬取股票每日行情数据...\n");

  let stocks = getUniqueStocks();

  if (stocks.length === 0) {
    console.log("未找到任何股票代码");
    return;
  }

  if (specificCodes) {
    const codeSet = new Set(specificCodes);
    stocks = stocks.filter((s) => codeSet.has(s.code));
    if (stocks.length === 0) {
      console.log("指定的股票代码不在 stocks.csv 中");
      return;
    }
  }

  // 如果设置了起始日期，筛选出需要补充历史数据的股票
  if (startDate) {
    const existingData = readStockHistory();
    const needHistory = findStocksNeedHistory(stocks, existingData, startDate);
    
    if (needHistory.length === 0) {
      console.log("所有股票的历史数据已完整，无需补充\n");
      return;
    }
    
    console.log(`发现 ${needHistory.length} 只股票需要补充历史数据（早于${startDate}）\n`);
    stocks = needHistory.map(s => ({ code: s.code, name: s.name, earliestDate: s.earliestDate }));
  }

  // 分批处理
  let processStocks = stocks;
  if (batchSize > 0) {
    processStocks = stocks.slice(batchOffset, batchOffset + batchSize);
    console.log(`分批模式: 处理第 ${batchOffset + 1} - ${batchOffset + processStocks.length} 只股票 (共 ${stocks.length} 只)\n`);
    if (processStocks.length === 0) {
      console.log("当前批次无数据需要处理\n");
      return;
    }
  }

  console.log(`共 ${processStocks.length} 只股票需要爬取${forceToday ? ' (强制更新今日收盘数据)' : ''}${startDate ? ` (从${startDate}开始)` : ''}\n`);

  let existingData = readStockHistory();
  console.log(`已有 ${existingData.length} 条历史数据\n`);

  let totalNew = 0;
  let totalUpdated = 0;
  let failedCount = 0;
  let todayDate = null;

  for (let i = 0; i < processStocks.length; i++) {
    const { code, name, earliestDate } = processStocks[i];
    const actualIdx = batchSize > 0 ? batchOffset + i + 1 : i + 1;
    const totalStocks = batchSize > 0 ? stocks.length : processStocks.length;
    console.log(`[${actualIdx}/${totalStocks}] ${code} ${name || "(未知)"}${earliestDate ? ` (已有数据从${earliestDate}开始)` : ''}`);

    try {
      const { newRecords, updatedRecords, todayDate: td } = await crawlStock(code, name, days, existingData, forceToday, startDate);
      if (!todayDate && td) todayDate = td;

      if (newRecords.length > 0 || updatedRecords.length > 0) {
        // 如果有今日数据更新，先删除旧的今日数据
        let allData = existingData;
        if (forceToday && updatedRecords.length > 0 && td) {
          allData = existingData.filter((d) => !(d.stock_code === code && d.trade_date === td));
        }
        
        // 添加新数据和更新的今日数据
        allData = [...allData, ...newRecords, ...updatedRecords];
        
        // 计算该股票的RSI
        if (calcRSI) {
          const stockRecords = allData.filter(d => d.stock_code === code);
          const withRSI = calculateAndFillRSI(stockRecords);
          // 合并回全部数据
          allData = [
            ...allData.filter(d => d.stock_code !== code),
            ...withRSI
          ];
        }
        
        writeStockHistory(allData);
        
        // 更新 existingData
        existingData = allData;
        
        totalNew += newRecords.length;
        totalUpdated += updatedRecords.length;
      }
    } catch (error) {
      console.error(`  爬取失败:`, error.message);
      failedCount++;
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  console.log(`\n爬取完成! 共新增 ${totalNew} 条数据${totalUpdated > 0 ? `，更新 ${totalUpdated} 条今日数据` : ''}`);
  if (failedCount > 0) {
    console.log(`失败 ${failedCount} 只股票，可稍后重试`);
  }
  
  // 如果是分批模式，显示进度提示
  if (batchSize > 0 && batchOffset + processStocks.length < stocks.length) {
    const nextOffset = batchOffset + batchSize;
    console.log(`\n💡 继续抓取下一批: --batch=${batchSize} --offset=${nextOffset}`);
  } else if (batchSize > 0 && processStocks.length > 0) {
    console.log(`\n✅ 所有批次已完成!`);
  }
}

/**
 * 重新计算所有股票的RSI指标
 */
function recalculateAllRSI() {
  console.log("开始重新计算所有股票的RSI指标...\n");
  
  const allData = readStockHistory();
  if (allData.length === 0) {
    console.log("没有历史数据");
    return;
  }
  
  // 获取所有唯一股票代码
  const stockCodes = [...new Set(allData.map(d => d.stock_code))];
  console.log(`共 ${stockCodes.length} 只股票需要计算RSI\n`);
  
  let processedCount = 0;
  
  for (const code of stockCodes) {
    const stockRecords = allData.filter(d => d.stock_code === code);
    const withRSI = calculateAndFillRSI(stockRecords);
    
    // 更新回全部数据
    for (const record of withRSI) {
      const idx = allData.findIndex(d => d.id === record.id);
      if (idx >= 0) {
        allData[idx] = record;
      }
    }
    
    processedCount++;
    if (processedCount % 10 === 0) {
      console.log(`已处理 ${processedCount}/${stockCodes.length} 只股票...`);
    }
  }
  
  writeStockHistory(allData);
  console.log(`\nRSI计算完成! 共处理 ${stockCodes.length} 只股票`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    days: 30,
    codes: null,
    forceToday: false,
    from2024: false,
    recalcRSI: false,
    startDate: null,
    batchSize: 0,
    batchOffset: 0,
  };

  for (const arg of args) {
    if (arg.startsWith("--days=")) {
      result.days = parseInt(arg.split("=")[1], 10) || 30;
    } else if (arg.startsWith("--codes=")) {
      result.codes = arg
        .split("=")[1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (arg === "--force-today" || arg === "--force") {
      result.forceToday = true;
    } else if (arg === "--from-2024") {
      result.from2024 = true;
      result.startDate = START_DATE_2024;
      // 计算从2024-01-01到今天的天数（大约）
      const startDate = new Date(START_DATE_2024);
      const today = new Date();
      const diffTime = Math.abs(today - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      result.days = diffDays + 100; // 多加一些天数确保覆盖
    } else if (arg === "--recalc-rsi") {
      result.recalcRSI = true;
    } else if (arg.startsWith("--batch=")) {
      result.batchSize = parseInt(arg.split("=")[1], 10) || 0;
    } else if (arg.startsWith("--offset=")) {
      result.batchOffset = parseInt(arg.split("=")[1], 10) || 0;
    }
  }

  return result;
}

// 主函数
async function main() {
  const args = parseArgs();

  const batchInfo = args.batchSize > 0 ? ` --batch=${args.batchSize} --offset=${args.batchOffset}` : "";
  console.log(`
股票每日行情爬虫
================
参数: --days=${args.days}${args.codes ? ` --codes=${args.codes.join(",")}` : ""}${args.forceToday ? " --force-today" : ""}${args.from2024 ? " --from-2024" : ""}${args.recalcRSI ? " --recalc-rsi" : ""}${batchInfo}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 初始化CSV文件（带RSI字段）
  if (!fs.existsSync(STOCK_HISTORY_FILE)) {
    const headerLine = CSV_HEADERS.join(",");
    fs.writeFileSync(STOCK_HISTORY_FILE, "\uFEFF" + headerLine + "\n", "utf-8");
  } else {
    // 检查是否需要迁移旧格式（添加RSI列）
    const content = fs.readFileSync(STOCK_HISTORY_FILE, "utf-8").replace(/^\uFEFF/, "");
    const firstLine = content.split("\n")[0];
    if (!firstLine.includes("rsi6")) {
      console.log("检测到旧数据格式，正在迁移添加RSI字段...\n");
      // 读取现有数据并添加RSI字段
      let existingData = readStockHistory();
      existingData = existingData.map(r => ({
        ...r,
        rsi6: r.rsi6 || "",
        rsi12: r.rsi12 || "",
        rsi24: r.rsi24 || "",
      }));
      writeStockHistory(existingData);
      console.log("迁移完成!\n");
    }
  }

  // 如果只是重新计算RSI
  if (args.recalcRSI) {
    recalculateAllRSI();
    return;
  }

  await crawlAllStocks(args.days, args.codes, args.forceToday, true, args.startDate, args.batchSize, args.batchOffset);
}

main().catch(console.error);
