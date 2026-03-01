/**
 * 股票概念分类爬虫脚本
 * 用于爬取股票所属的概念板块
 *
 * 使用方法:
 * node crawler/stockConceptSpider.js                     # 爬取所有股票概念
 * node crawler/stockConceptSpider.js --codes=00700,002027 # 仅爬取指定股票
 *
 * 数据来源：
 * 1. 东方财富个股行情页面 - 获取概念板块
 * 2. 东方财富F10页面 - 备用数据源
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const STOCKS_FILE = path.join(DATA_DIR, "stocks.csv");
const STOCK_CONCEPT_FILE = path.join(DATA_DIR, "stock_concept.csv");

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
function httpRequest(url, retries = 3, delayMs = 1500) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = https.get(
        url,
        { headers: HEADERS, timeout: 20000 },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ data, statusCode: res.statusCode }));
        }
      );

      req.on("error", (err) => {
        if (n > 0) {
          console.log(`  重试 (${n})...`);
          setTimeout(() => attempt(n - 1), delayMs);
        } else {
          reject(err);
        }
      });

      req.on("timeout", () => {
        req.destroy();
        if (n > 0) {
          console.log(`  超时重试 (${n})...`);
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
 * 获取股票市场代码
 */
function getMarketCode(stockCode) {
  if (stockCode.length === 5) return "hk"; // 港股
  if (stockCode.startsWith("6")) return "sh"; // 上海
  return "sz"; // 深圳
}

/**
 * 方法1: 使用东方财富股票行情API获取概念
 * 接口: https://push2.eastmoney.com/api/qt/stock/get
 */
async function getStockConceptsFromQuoteAPI(stockCode) {
  const secid = getEastmoneySecId(stockCode);
  // 获取股票所属板块信息
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f127,f128`;

  try {
    const { data } = await httpRequest(url, 2, 2000);

    try {
      const json = JSON.parse(data);
      if (json && json.data) {
        const concepts = [];
        // f127 = 行业, f128 = 地域
        if (json.data.f127) {
          concepts.push({
            concept_code: "",
            concept_name: json.data.f127,
            type: "industry",
          });
        }
        if (json.data.f128) {
          concepts.push({
            concept_code: "",
            concept_name: json.data.f128,
            type: "region",
          });
        }
        return concepts;
      }
    } catch (e) {
      // JSON解析失败
    }

    return [];
  } catch (error) {
    return [];
  }
}

/**
 * 方法2: 使用东方财富F10公司概况接口获取概念
 */
async function getStockConceptsFromF10(stockCode) {
  const secid = getEastmoneySecId(stockCode);
  const market = stockCode.length === 5 ? "" : (stockCode.startsWith("6") ? "SH" : "SZ");
  const code = stockCode.length === 5 ? stockCode : `${stockCode}.${market}`;
  
  // 使用正确的F10接口格式
  const url = `https://emweb.eastmoney.com/PC_HSF10/CompanySurvey/CompanySurveyAjax?code=${stockCode.startsWith("6") ? "SH" : "SZ"}${stockCode}`;

  try {
    const { data } = await httpRequest(url, 2, 2000);

    try {
      const json = JSON.parse(data);
      if (json && json.jbzl) {
        const concepts = [];
        
        // 从公司基本信息提取行业
        if (json.jbzl.sshy) {
          concepts.push({
            concept_code: "",
            concept_name: json.jbzl.sshy,
            type: "industry",
          });
        }
        
        // 提取地域
        if (json.jbzl.qy) {
          concepts.push({
            concept_code: "",
            concept_name: json.jbzl.qy + "板块",
            type: "region",
          });
        }
        
        return concepts;
      }
    } catch (e) {
      // 不是JSON
    }

    return [];
  } catch (error) {
    return [];
  }
}

/**
 * 方法3: 从同花顺个股页面获取概念（主要方法）
 */
async function getStockConceptsFromTHS(stockCode) {
  const concepts = [];
  
  // 港股不支持同花顺接口
  if (stockCode.length === 5) {
    return concepts;
  }

  try {
    // 同花顺个股页面
    const url = `https://stockpage.10jqka.com.cn/${stockCode}/`;

    const { data } = await httpRequest(url, 2, 2000);

    // 解析"涉及概念"字段 - 格式: <dt>涉及概念：</dt><dd title="概念1，概念2...">概念1，概念2...</dd>
    const conceptMatch = data.match(/涉及概念[：:]\s*<\/dt>\s*<dd[^>]*title="([^"]+)"/i);
    if (conceptMatch) {
      const conceptText = conceptMatch[1];
      
      // 概念通常是"概念1，概念2，概念3..."格式
      const conceptList = conceptText.split(/[，,]/).map(c => c.trim()).filter(Boolean);
      
      for (const name of conceptList) {
        // 清理概念名称
        const cleanName = name.replace(/\.\.\.|…/g, "").trim();
        if (cleanName && cleanName.length > 1 && !cleanName.includes("板块")) {
          concepts.push({
            concept_code: "",
            concept_name: cleanName,
            type: "concept",
          });
        }
      }
    }

    // 备用匹配方式 - 直接匹配dd标签内容
    if (concepts.length === 0) {
      const conceptMatch2 = data.match(/涉及概念[：:]\s*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);
      if (conceptMatch2) {
        const conceptText = conceptMatch2[1];
        const conceptList = conceptText.split(/[，,]/).map(c => c.trim()).filter(Boolean);
        
        for (const name of conceptList) {
          const cleanName = name.replace(/\.\.\.|…/g, "").trim();
          if (cleanName && cleanName.length > 1 && !cleanName.includes("板块")) {
            concepts.push({
              concept_code: "",
              concept_name: cleanName,
              type: "concept",
            });
          }
        }
      }
    }
  } catch (error) {
    // 忽略错误
  }

  return concepts;
}

/**
 * 方法4: 从东方财富F10核心题材接口获取概念（备用）
 */
async function getStockConceptsFromCoreTheme(stockCode) {
  const market = stockCode.startsWith("6") ? "SH" : "SZ";
  const concepts = [];

  try {
    // 东方财富F10核心题材接口
    const url = `https://emweb.eastmoney.com/PC_HSF10/CoreConception/CoreConceptionAjax?code=${market}${stockCode}`;

    const { data } = await httpRequest(url, 1, 1500);

    try {
      const json = JSON.parse(data);
      if (json && json.hxtc) {
        const conceptText = json.hxtc;
        const conceptList = conceptText.split(/[，,、]/).map(c => c.trim()).filter(Boolean);
        
        for (const name of conceptList) {
          if (!name.includes("板块") && !name.includes("Ⅱ") && name.length > 1) {
            concepts.push({
              concept_code: "",
              concept_name: name,
              type: "concept",
            });
          }
        }
      }
    } catch (e) {
      // 忽略
    }
  } catch (error) {
    // 忽略错误
  }

  return concepts;
}

/**
 * 方法5: 从东方财富个股概念板块接口获取（备用）
 */
async function getStockConceptsFromConceptPage(stockCode) {
  const market = stockCode.startsWith("6") ? "SH" : "SZ";
  const concepts = [];

  try {
    const url = `https://emweb.eastmoney.com/PC_HSF10/Concept/PageAjax?code=${market}${stockCode}`;

    const { data } = await httpRequest(url, 1, 1500);

    try {
      const json = JSON.parse(data);
      if (json && json.gnlist) {
        for (const item of json.gnlist) {
          if (item.GNMC) {
            concepts.push({
              concept_code: item.GNDM || "",
              concept_name: item.GNMC,
              type: "concept",
            });
          }
        }
      }
    } catch (e) {
      // 忽略
    }
  } catch (error) {
    // 忽略
  }

  return concepts;
}

/**
 * 获取概念名称映射
 */
function getConceptName(conceptCode) {
  const nameMap = {
    BK0477: "新能源车",
    BK0481: "半导体",
    BK0501: "人工智能",
    BK0608: "芯片",
    BK0571: "5G",
    BK0528: "锂电池",
    BK0639: "光伏",
    BK0538: "储能",
    BK0645: "氢能源",
    BK0558: "医药",
    BK0735: "白酒",
    BK0559: "食品饮料",
    BK0500: "新能源",
    BK0544: "稀土永磁",
    BK0627: "军工",
    BK0536: "芯片概念",
    BK0753: "数字经济",
    BK0557: "医疗服务",
    BK0572: "云计算",
    BK0575: "大数据",
    BK0578: "互联网",
    BK0580: "软件开发",
    BK0612: "机器人",
    BK0632: "汽车整车",
    BK0635: "汽车零部件",
    BK0647: "电力设备",
    BK0652: "风电",
    BK0655: "充电桩",
    BK0658: "智能电网",
    BK0661: "特高压",
  };
  return nameMap[conceptCode] || conceptCode;
}

/**
 * 获取股票所属概念（主方法）
 */
async function getStockConcepts(stockCode) {
  const allConcepts = [];

  // 方法1: 从行情API获取行业和地域
  const basicInfo = await getStockConceptsFromQuoteAPI(stockCode);
  allConcepts.push(...basicInfo);

  // 方法3: 从同花顺获取概念（主要方法）
  const thsConcepts = await getStockConceptsFromTHS(stockCode);
  if (thsConcepts.length > 0) {
    allConcepts.push(...thsConcepts);
  }

  // 方法4: 从F10核心题材获取概念（备用）
  if (thsConcepts.length === 0) {
    const coreConcepts = await getStockConceptsFromCoreTheme(stockCode);
    allConcepts.push(...coreConcepts);
  }

  // 去重
  const uniqueConcepts = [];
  const seen = new Set();
  for (const c of allConcepts) {
    const key = c.concept_name;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueConcepts.push(c);
    }
  }

  return uniqueConcepts;
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
 * 读取现有股票概念数据
 */
function readStockConcepts() {
  if (!fs.existsSync(STOCK_CONCEPT_FILE)) {
    return new Map(); // stock_code -> [{concept_code, concept_name}]
  }

  let content = fs.readFileSync(STOCK_CONCEPT_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return new Map();

  const headers = lines[0].split(",");
  const codeIndex = headers.indexOf("stock_code");
  const conceptCodeIndex = headers.indexOf("concept_code");
  const conceptNameIndex = headers.indexOf("concept_name");

  const stockMap = new Map();
  lines.slice(1).filter(l => l.trim()).forEach((line) => {
    const values = parseCSVRow(line);
    const stockCode = values[codeIndex];
    const conceptCode = values[conceptCodeIndex];
    const conceptName = values[conceptNameIndex];

    if (stockCode && conceptCode) {
      if (!stockMap.has(stockCode)) {
        stockMap.set(stockCode, []);
      }
      stockMap.get(stockCode).push({
        concept_code: conceptCode,
        concept_name: conceptName,
      });
    }
  });

  return stockMap;
}

/**
 * 写入股票概念数据
 */
function writeStockConcepts(stockMap) {
  const headers = ["stock_code", "stock_name", "concept_code", "concept_name", "type"];
  const headerLine = headers.join(",");

  const lines = [headerLine];

  stockMap.forEach((concepts, stockCode) => {
    concepts.forEach((c) => {
      const row = headers.map((h) => {
        let val = "";
        if (h === "stock_code") val = stockCode;
        else if (h === "stock_name") val = c.stock_name || "";
        else if (h === "concept_code") val = c.concept_code || "";
        else if (h === "concept_name") val = c.concept_name || "";
        else if (h === "type") val = c.type || "concept";

        if (String(val).includes(",") || String(val).includes('"')) {
          return `"${String(val).replace(/"/g, '""')}"`;
        }
        return val;
      });
      lines.push(row.join(","));
    });
  });

  const BOM = "\uFEFF";
  fs.writeFileSync(STOCK_CONCEPT_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 爬取股票概念分类
 */
async function crawlStockConcepts(specificCodes = null) {
  console.log("开始爬取股票概念分类...\n");

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

  const existingData = readStockConcepts();
  console.log(`已有 ${existingData.size} 只股票的概念数据\n`);

  let newCount = 0;
  let updateCount = 0;
  let failCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const { code, name } = stocks[i];
    console.log(`[${i + 1}/${stocks.length}] ${code} ${name || "(未知)"}`);

    try {
      // 获取股票所属概念
      const concepts = await getStockConcepts(code);

      if (concepts.length > 0) {
        // 为每个概念添加股票名称
        const conceptsWithName = concepts.map((c) => ({
          ...c,
          stock_name: name,
        }));

        const isNew = !existingData.has(code);
        existingData.set(code, conceptsWithName);

        if (isNew) {
          newCount++;
        } else {
          updateCount++;
        }

        console.log(`  概念: ${concepts.map((c) => c.concept_name).join(", ")}`);

        // 每获取10条保存一次
        if ((newCount + updateCount) % 10 === 0) {
          writeStockConcepts(existingData);
        }
      } else {
        console.log(`  未找到概念数据`);
        failCount++;
      }
    } catch (error) {
      console.log(`  爬取失败: ${error.message}`);
      failCount++;
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // 保存最终数据
  writeStockConcepts(existingData);

  console.log(`\n爬取完成!`);
  console.log(`  新增: ${newCount} 只股票`);
  console.log(`  更新: ${updateCount} 只股票`);
  console.log(`  失败: ${failCount} 只股票`);
  console.log(`\n数据已保存到: ${STOCK_CONCEPT_FILE}`);
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
股票概念分类爬虫
================
${args.codes ? `指定股票: ${args.codes.join(", ")}` : "爬取所有股票"}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  await crawlStockConcepts(args.codes);
}

main().catch(console.error);
