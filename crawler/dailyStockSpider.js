/**
 * 股票每日行情爬虫脚本
 * 用于爬取股票的历史K线数据（开盘价、收盘价、最高价、最低价、成交量等）
 *
 * 使用方法:
 * node crawler/dailyStockSpider.js                     # 抓取所有股票最近30天数据
 * node crawler/dailyStockSpider.js --days=365          # 抓取所有股票最近365天数据
 * node crawler/dailyStockSpider.js --codes=00700,002027 # 仅抓取指定股票
 *
 * 技术特点：
 * 1、双接口支持：腾讯接口（主要）+ 东方财富接口（备用）
 * 2、增量更新：自动检测已有数据，只抓取新日期
 * 3、A股/港股兼容：自动识别市场代码
 * 4、重试机制：请求失败自动重试
 * 5、UTF-8 BOM：确保 Windows 正确识别编码
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const STOCKS_FILE = path.join(DATA_DIR, "stocks.csv");
const DAILY_STOCKS_FILE = path.join(DATA_DIR, "dailystock.csv");

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
    return klines.map((item) => ({
      trade_date: item[0],
      open: item[1],
      close: item[2],
      high: item[3],
      low: item[4],
      volume: item[5] || "0",
    }));
  } catch (error) {
    return null;
  }
}

/**
 * 从东方财富接口获取股票K线数据（备用接口）
 */
async function getStockKlinesFromEastmoney(stockCode, limit = 30) {
  const secid = getEastmoneySecId(stockCode);
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?` +
    `secid=${secid}&` +
    `fields1=f1,f2,f3,f4,f5,f6&` +
    `fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&` +
    `klt=101&fqt=1&end=20500101&lmt=${limit}`;

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
      };
    });
  } catch (error) {
    return null;
  }
}

/**
 * 获取股票K线数据（自动切换接口）
 */
async function getStockKlines(stockCode, limit = 30) {
  // 先尝试腾讯接口
  let klines = await getStockKlinesFromTencent(stockCode, limit);

  if (klines && klines.length > 0) {
    return { data: klines, source: "tencent" };
  }

  // 腾讯失败，尝试东方财富
  klines = await getStockKlinesFromEastmoney(stockCode, limit);

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
 * 读取现有每日股票数据
 */
function readDailyStocks() {
  if (!fs.existsSync(DAILY_STOCKS_FILE)) {
    return [];
  }

  let content = fs.readFileSync(DAILY_STOCKS_FILE, "utf-8");
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
 * 写入每日股票数据
 */
function writeDailyStocks(records) {
  const headers = [
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
    "created_at",
  ];
  const headerLine = headers.join(",");
  const lines = [
    headerLine,
    ...records.map((r) => {
      return headers
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
  fs.writeFileSync(DAILY_STOCKS_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 保存K线数据（增量更新）
 */
function saveKlines(stockCode, stockName, klines, existingData) {
  const now = new Date().toISOString();
  const existingDates = new Set(
    existingData
      .filter((d) => d.stock_code === stockCode)
      .map((d) => d.trade_date)
  );

  const newRecords = klines
    .filter((k) => !existingDates.has(k.trade_date))
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
      created_at: now,
    }));

  return newRecords;
}

/**
 * 爬取单个股票的K线数据
 */
async function crawlStock(stockCode, stockName, days = 30, existingData = []) {
  console.log(`正在爬取 ${stockCode} ${stockName}...`);

  const latestDate = getLatestDate(existingData, stockCode);
  const needDays = latestDate ? Math.min(days, 30) : days;

  const { data: klines, source } = await getStockKlines(stockCode, needDays);

  if (klines.length === 0) {
    console.log(`  获取数据失败 (来源: ${source})`);
    return [];
  }

  console.log(`  数据来源: ${source}, 获取 ${klines.length} 条`);

  const newRecords = saveKlines(stockCode, stockName, klines, existingData);

  if (newRecords.length > 0) {
    console.log(
      `  新增 ${newRecords.length} 条数据 (${newRecords[0].trade_date} ~ ${
        newRecords[newRecords.length - 1].trade_date
      })`
    );
  } else {
    console.log(`  无新数据 (已有最新数据: ${latestDate || "无"})`);
  }

  return newRecords;
}

/**
 * 爬取所有股票的K线数据
 */
async function crawlAllStocks(days = 30, specificCodes = null) {
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

  console.log(`共 ${stocks.length} 只股票需要爬取\n`);

  const existingData = readDailyStocks();
  console.log(`已有 ${existingData.length} 条历史数据\n`);

  let totalNew = 0;
  let failedCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const { code, name } = stocks[i];
    console.log(`[${i + 1}/${stocks.length}] ${code} ${name || "(未知)"}`);

    try {
      const newRecords = await crawlStock(code, name, days, existingData);

      if (newRecords.length > 0) {
        const allData = [...existingData, ...newRecords];
        writeDailyStocks(allData);
        existingData.push(...newRecords);
        totalNew += newRecords.length;
      }
    } catch (error) {
      console.error(`  爬取失败:`, error.message);
      failedCount++;
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  console.log(`\n爬取完成! 共新增 ${totalNew} 条数据`);
  if (failedCount > 0) {
    console.log(`失败 ${failedCount} 只股票，可稍后重试`);
  }
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    days: 30,
    codes: null,
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
    }
  }

  return result;
}

// 主函数
async function main() {
  const args = parseArgs();

  console.log(`
股票每日行情爬虫
================
参数: --days=${args.days}${args.codes ? ` --codes=${args.codes.join(",")}` : ""}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DAILY_STOCKS_FILE)) {
    fs.writeFileSync(
      DAILY_STOCKS_FILE,
      "\uFEFFid,stock_code,stock_name,trade_date,is_open,open,close,high,low,volume,created_at\n",
      "utf-8"
    );
  }

  await crawlAllStocks(args.days, args.codes);
}

main().catch(console.error);
