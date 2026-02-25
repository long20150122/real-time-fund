/**
 * 股票基本信息爬虫脚本
 * 用于爬取股票的行业、地区等基本信息
 *
 * 使用方法:
 * node crawler/stockBaseInfoSpider.js                     # 爬取所有股票基本信息
 * node crawler/stockBaseInfoSpider.js --codes=00700,002027 # 仅爬取指定股票
 *
 * 数据来源：
 * 1. 东方财富 push2 接口 - 获取行业、地域
 * 2. 东方财富 datacenter 接口 - 获取行业分类
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const STOCKS_FILE = path.join(DATA_DIR, "stocks.csv");
const STOCK_BASE_INFO_FILE = path.join(DATA_DIR, "stock_base_info.csv");

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
 * 根据股票代码获取东方财富 secid
 */
function getEastmoneySecId(stockCode) {
  // 港股：5位数字
  if (stockCode.length === 5) {
    return `116.${stockCode}`;
  }
  // 上海A股：6开头
  if (stockCode.startsWith("6")) {
    return `1.${stockCode}`;
  }
  // 深圳A股：0/3开头
  return `0.${stockCode}`;
}

/**
 * 从东方财富获取股票基本信息
 */
async function getStockBaseInfo(stockCode) {
  const secid = getEastmoneySecId(stockCode);
  
  // 使用 push2 接口获取基本信息
  // f57=代码, f58=名称, f127=行业, f128=地域板块
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f127,f128`;

  try {
    const { data } = await httpRequest(url, 2, 1500);
    const json = JSON.parse(data);

    if (!json.data) return null;

    const d = json.data;
    
    // 处理地域（如"上海板块" -> 省份="上海", 城市=""）
    let province = "";
    let city = "";
    const region = d.f128 || "";
    
    // 常见地域映射
    const regionMap = {
      "上海板块": { province: "上海", city: "" },
      "北京板块": { province: "北京", city: "" },
      "深圳板块": { province: "广东", city: "深圳" },
      "广东板块": { province: "广东", city: "" },
      "浙江板块": { province: "浙江", city: "" },
      "江苏板块": { province: "江苏", city: "" },
      "四川板块": { province: "四川", city: "" },
      "湖北板块": { province: "湖北", city: "" },
      "湖南板块": { province: "湖南", city: "" },
      "福建板块": { province: "福建", city: "" },
      "山东板块": { province: "山东", city: "" },
      "安徽板块": { province: "安徽", city: "" },
      "河南板块": { province: "河南", city: "" },
      "河北板块": { province: "河北", city: "" },
      "陕西板块": { province: "陕西", city: "" },
      "天津板块": { province: "天津", city: "" },
      "重庆板块": { province: "重庆", city: "" },
      "辽宁板块": { province: "辽宁", city: "" },
      "吉林板块": { province: "吉林", city: "" },
      "黑龙江板块": { province: "黑龙江", city: "" },
      "江西板块": { province: "江西", city: "" },
      "山西板块": { province: "山西", city: "" },
      "广西板块": { province: "广西", city: "" },
      "云南板块": { province: "云南", city: "" },
      "贵州板块": { province: "贵州", city: "" },
      "甘肃板块": { province: "甘肃", city: "" },
      "海南板块": { province: "海南", city: "" },
      "新疆板块": { province: "新疆", city: "" },
      "西藏板块": { province: "西藏", city: "" },
      "内蒙古板块": { province: "内蒙古", city: "" },
      "宁夏板块": { province: "宁夏", city: "" },
      "青海板块": { province: "青海", city: "" },
      "香港板块": { province: "香港", city: "" },
    };
    
    if (regionMap[region]) {
      province = regionMap[region].province;
      city = regionMap[region].city;
    } else if (region) {
      // 尝试从板块名称提取省份
      const match = region.match(/^(.+?)板块$/);
      if (match) {
        province = match[1];
      }
    }

    return {
      stock_code: String(d.f57 || stockCode),
      stock_name: d.f58 || "",
      industry: d.f127 || "",           // 所属行业
      sub_industry: "",                 // 细分行业（暂无数据源）
      province: province,               // 省份
      city: city,                       // 城市
      establish_date: "",               // 成立时间（暂无数据源）
      main_business: "",                // 主营业务（暂无数据源）
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
 * 读取现有股票基本信息
 */
function readStockBaseInfo() {
  if (!fs.existsSync(STOCK_BASE_INFO_FILE)) {
    return new Map();
  }

  let content = fs.readFileSync(STOCK_BASE_INFO_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return new Map();

  const headers = lines[0].split(",");
  const codeIndex = headers.indexOf("stock_code");

  const stockMap = new Map();
  lines.slice(1).filter(l => l.trim()).forEach((line) => {
    const values = parseCSVRow(line);
    const code = values[codeIndex];
    if (code) {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      stockMap.set(code, obj);
    }
  });

  return stockMap;
}

/**
 * 写入股票基本信息
 */
function writeStockBaseInfo(stockMap) {
  const headers = [
    "stock_code",
    "stock_name",
    "industry",
    "sub_industry",
    "province",
    "city",
    "establish_date",
    "main_business",
  ];
  const headerLine = headers.join(",");
  const lines = [
    headerLine,
    ...Array.from(stockMap.values()).map((s) => {
      return headers
        .map((h) => {
          const val = s[h] ?? "";
          if (String(val).includes(",") || String(val).includes('"')) {
            return `"${String(val).replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",");
    }),
  ];

  const BOM = "\uFEFF";
  fs.writeFileSync(STOCK_BASE_INFO_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 爬取股票基本信息
 */
async function crawlStockBaseInfo(specificCodes = null) {
  console.log("开始爬取股票基本信息...\n");

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

  const existingData = readStockBaseInfo();
  console.log(`已有 ${existingData.size} 条基本信息\n`);

  let newCount = 0;
  let updateCount = 0;
  let failCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const { code, name } = stocks[i];
    console.log(`[${i + 1}/${stocks.length}] ${code} ${name || "(未知)"}`);

    try {
      const info = await getStockBaseInfo(code);

      if (info && info.industry) {
        const isNew = !existingData.has(code);
        existingData.set(code, info);
        if (isNew) {
          newCount++;
        } else {
          updateCount++;
        }
        console.log(`  行业: ${info.industry} | 地区: ${info.province}${info.city ? " " + info.city : ""}`);
        
        // 每获取20条保存一次
        if ((newCount + updateCount) % 20 === 0) {
          writeStockBaseInfo(existingData);
        }
      } else {
        console.log(`  获取失败（无数据）`);
        failCount++;
        // 保存一个空记录，避免重复请求
        existingData.set(code, {
          stock_code: code,
          stock_name: name,
          industry: "",
          sub_industry: "",
          province: "",
          city: "",
          establish_date: "",
          main_business: "",
        });
      }
    } catch (error) {
      console.log(`  爬取失败: ${error.message}`);
      failCount++;
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // 保存最终数据
  writeStockBaseInfo(existingData);

  console.log(`\n爬取完成!`);
  console.log(`  新增: ${newCount} 条`);
  console.log(`  更新: ${updateCount} 条`);
  console.log(`  失败: ${failCount} 条`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    codes: null,
  };

  for (const arg of args) {
    if (arg.startsWith("--codes=")) {
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
股票基本信息爬虫
================
${args.codes ? `指定股票: ${args.codes.join(", ")}` : "爬取所有股票"}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  await crawlStockBaseInfo(args.codes);
}

main().catch(console.error);
