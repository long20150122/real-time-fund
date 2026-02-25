/**
 * 修复 dailystock.csv 数据
 * 为现有数据添加成交额(amount)和换手率(turnover_rate)字段
 * 
 * 使用方法:
 * node crawler/fixAmount.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
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
 * HTTP GET 请求封装
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
          setTimeout(() => attempt(n - 1), delayMs);
        } else {
          reject(err);
        }
      });

      req.on("timeout", () => {
        req.destroy();
        if (n > 0) {
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
    const totalCapYi = parseFloat(parts[44]) || 0;
    const floatCapYi = parseFloat(parts[45]) || 0;

    return {
      total_cap: Math.round(totalCapYi * 100000000), // 转换为元
      float_cap: Math.round(floatCapYi * 100000000), // 转换为元
    };
  } catch (error) {
    return null;
  }
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
    "amount",
    "float_cap",
    "turnover_rate",
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
 * 获取所有唯一的股票代码
 */
function getUniqueStockCodes(data) {
  const codes = new Set();
  data.forEach((d) => {
    if (d.stock_code) {
      codes.add(d.stock_code);
    }
  });
  return Array.from(codes);
}

// 主函数
async function main() {
  console.log("开始修复 dailystock.csv 数据...\n");

  // 读取现有数据
  const data = readDailyStocks();
  console.log(`共有 ${data.length} 条数据`);

  // 检查是否已有正确的市值字段
  // 正确的市值应该是：茅台约2万亿，宁德时代约1万亿
  const sampleRecord = data.find(d => d.stock_code === '600519');
  const hasCorrectFloatCap = sampleRecord && parseFloat(sampleRecord.float_cap) > 1000000000000; // 流通市值应该大于1万亿
  
  if (hasCorrectFloatCap) {
    console.log("数据已正确包含 amount 和 float_cap 字段，跳过修复");
    return;
  }

  console.log("市值数据需要更新，开始修复...\n");

  // 获取所有唯一股票代码
  const stockCodes = getUniqueStockCodes(data);
  console.log(`共 ${stockCodes.length} 只股票需要获取市值\n`);

  // 获取每只股票的市值
  const marketCapMap = new Map();
  for (let i = 0; i < stockCodes.length; i++) {
    const code = stockCodes[i];
    console.log(`[${i + 1}/${stockCodes.length}] 获取 ${code} 市值...`);

    const quote = await getStockRealtimeQuote(code);
    if (quote && quote.float_cap > 0) {
      marketCapMap.set(code, quote);
      console.log(`  流通市值: ${(quote.float_cap / 100000000).toFixed(2)}亿`);
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 修复数据
  let fixedCount = 0;
  const fixedData = data.map((d) => {
    // 计算成交额 = 成交量 × 收盘价
    const volume = parseInt(d.volume) || 0;
    const close = parseFloat(d.close) || 0;
    const amount = Math.round(volume * close);

    // 获取市值
    const marketCap = marketCapMap.get(d.stock_code);
    const floatCap = marketCap ? marketCap.float_cap : 0;

    // 计算换手率 = 成交额 / 流通市值 * 100%
    let turnoverRate = "";
    if (floatCap > 0 && amount > 0) {
      turnoverRate = ((amount / floatCap) * 100).toFixed(2);
    }

    fixedCount++;
    return {
      ...d,
      amount: String(amount),
      float_cap: String(floatCap),
      turnover_rate: turnoverRate,
    };
  });

  // 写入修复后的数据
  writeDailyStocks(fixedData);
  console.log(`\n修复完成! 共处理 ${fixedCount} 条数据`);
}

main().catch(console.error);
