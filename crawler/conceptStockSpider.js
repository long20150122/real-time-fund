/**
 * 概念成分股爬虫脚本
 * 用于爬取概念板块的成分股列表
 *
 * 使用方法:
 * node crawler/conceptStockSpider.js                     # 爬取所有概念成分股
 * node crawler/conceptStockSpider.js --concept=CPO       # 仅爬取指定概念
 * node crawler/conceptStockSpider.js --top=20            # 获取Top20股票
 *
 * 数据来源：东方财富概念板块接口
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const CONCEPT_STOCK_FILE = path.join(DATA_DIR, "concept_stocks.csv");
const CHAIN_CONCEPTS_FILE = path.join(DATA_DIR, "industry_chain_concepts.csv");

// 请求头
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://data.eastmoney.com/",
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
 * 概念名称到东方财富板块代码映射
 * 数据来源：东方财富概念板块（https://data.eastmoney.com/bk/）
 * 更新时间：2026-03-03
 */
const CONCEPT_CODE_MAP = {
  // AI产业链
  "CPO": "BK1132",           // 光模块共封装光学
  "PCB": "BK0479",           // 印制电路板
  "光模块": "BK0897",        // 光模块
  "AI芯片": "BK0906",        // AI芯片
  "算力租赁": "BK1172",      // 算力租赁
  "AIGC": "BK1144",          // AIGC
  "ChatGPT": "BK1127",       // ChatGPT
  "数据中心": "BK0549",      // 数据中心
  
  // 半导体产业链
  "半导体": "BK0481",        // 半导体
  "芯片": "BK0885",          // 国产芯片（修正）
  "光刻胶": "BK0888",        // 光刻胶
  "EDA": "BK0890",           // EDA
  "封测": "BK0891",          // 半导体封测
  
  // 新能源汽车产业链
  "锂电池": "BK0528",        // 锂电池
  "动力电池": "BK0982",      // 动力电池
  "充电桩": "BK0655",        // 充电桩
  "电机": "BK0731",          // 电机
  "汽车电子": "BK0737",      // 汽车电子（修正）
  
  // 光伏产业链
  "光伏": "BK0638",          // 光伏产业（修正）
  "HJT电池": "BK0988",       // HJT电池
  "Topcon": "BK1097",        // TOPCon电池
  "储能": "BK0538",          // 储能
  
  // 医药产业链
  "创新药": "BK1106",        // 创新药
  "医疗器械": "BK0727",      // 医疗器械
  "CRO": "BK0899",           // CRO
  
  // 5G通信产业链
  "5G": "BK0714",            // 5G概念
  "光通信": "BK1136",        // 光通信模块
  "物联网": "BK0506",        // 物联网
};

/**
 * 根据概念名称搜索板块代码
 */
async function searchConceptCode(conceptName) {
  // 先查本地映射
  if (CONCEPT_CODE_MAP[conceptName]) {
    return CONCEPT_CODE_MAP[conceptName];
  }

  // 搜索接口
  const url = `https://searchapi.eastmoney.com/bussiness/web/QuotationLabelSearch?cb=jQuery&keyword=${encodeURIComponent(conceptName)}&type=bk`;

  try {
    const { data } = await httpRequest(url, 2, 2000);
    // JSONP解析
    const jsonMatch = data.match(/jQuery\((.*)\)/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[1]);
      if (json.Data && json.Data.length > 0) {
        // 找到最匹配的
        const match = json.Data.find(d => d.Name.includes(conceptName) || conceptName.includes(d.Name));
        if (match) {
          return match.Code;
        }
        return json.Data[0].Code;
      }
    }
  } catch (error) {
    console.log(`  搜索概念代码失败: ${error.message}`);
  }

  return null;
}

/**
 * 获取概念成分股
 */
async function getConceptStocks(conceptCode, topN = 10) {
  const stocks = [];

  try {
    // 东方财富概念成分股接口
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${topN}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:${conceptCode}&fields=f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124,f1,f13`;

    const { data } = await httpRequest(url, 2, 2000);

    try {
      const json = JSON.parse(data);
      if (json.data && json.data.diff) {
        for (const item of json.data.diff) {
          stocks.push({
            stock_code: item.f12,
            stock_name: item.f14,
            price: item.f2,
            change_pct: item.f3,
            market_cap: item.f20,
            pe_ttm: item.f9,
          });
        }
      }
    } catch (e) {
      console.log(`  JSON解析失败`);
    }
  } catch (error) {
    console.log(`  获取成分股失败: ${error.message}`);
  }

  return stocks;
}

/**
 * 读取产业链概念列表
 */
function readChainConcepts() {
  if (!fs.existsSync(CHAIN_CONCEPTS_FILE)) {
    return [];
  }

  let content = fs.readFileSync(CHAIN_CONCEPTS_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",");
  const nameIndex = headers.indexOf("concept_name");

  const concepts = [];
  const seen = new Set();
  lines.slice(1).filter(l => l.trim()).forEach((line) => {
    const values = line.split(",");
    const name = values[nameIndex];
    if (name && !seen.has(name)) {
      seen.add(name);
      concepts.push(name);
    }
  });

  return concepts;
}

/**
 * 读取现有概念成分股数据
 */
function readConceptStocks() {
  if (!fs.existsSync(CONCEPT_STOCK_FILE)) {
    return new Map();
  }

  let content = fs.readFileSync(CONCEPT_STOCK_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return new Map();

  const headers = lines[0].split(",");
  const conceptIndex = headers.indexOf("concept_name");
  const codeIndex = headers.indexOf("stock_code");

  const map = new Map();
  lines.slice(1).filter(l => l.trim()).forEach((line) => {
    const values = line.split(",");
    const concept = values[conceptIndex];
    const code = values[codeIndex];
    if (concept && code) {
      if (!map.has(concept)) {
        map.set(concept, []);
      }
      map.get(concept).push({
        concept_name: concept,
        stock_code: code,
        stock_name: values[headers.indexOf("stock_name")] || "",
        rank: parseInt(values[headers.indexOf("rank")] || "0"),
        market_cap: values[headers.indexOf("market_cap")] || "",
        pe_ttm: values[headers.indexOf("pe_ttm")] || "",
      });
    }
  });

  return map;
}

/**
 * 写入概念成分股数据
 */
function writeConceptStocks(map) {
  const headers = ["concept_name", "stock_code", "stock_name", "rank", "market_cap", "pe_ttm", "updated_at"];
  const headerLine = headers.join(",");

  const lines = [headerLine];
  const now = new Date().toISOString();

  map.forEach((stocks, concept) => {
    stocks.forEach((s) => {
      const row = headers.map((h) => {
        let val = "";
        if (h === "concept_name") val = concept;
        else if (h === "stock_code") val = s.stock_code;
        else if (h === "stock_name") val = s.stock_name || "";
        else if (h === "rank") val = s.rank || "";
        else if (h === "market_cap") val = s.market_cap || "";
        else if (h === "pe_ttm") val = s.pe_ttm || "";
        else if (h === "updated_at") val = now;

        if (String(val).includes(",") || String(val).includes('"')) {
          return `"${String(val).replace(/"/g, '""')}"`;
        }
        return val;
      });
      lines.push(row.join(","));
    });
  });

  const BOM = "\uFEFF";
  fs.writeFileSync(CONCEPT_STOCK_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 爬取概念成分股
 */
async function crawlConceptStocks(specificConcept = null, topN = 10) {
  console.log("开始爬取概念成分股...\n");

  let concepts = specificConcept ? [specificConcept] : readChainConcepts();

  if (concepts.length === 0) {
    console.log("未找到概念列表，请先运行 industryChainSpider.js");
    return;
  }

  console.log(`共 ${concepts.length} 个概念需要爬取\n`);

  const existingData = readConceptStocks();
  let newCount = 0;
  let updateCount = 0;
  let failCount = 0;

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    console.log(`[${i + 1}/${concepts.length}] ${concept}`);

    try {
      // 搜索概念代码
      const conceptCode = await searchConceptCode(concept);
      if (!conceptCode) {
        console.log(`  未找到概念代码`);
        failCount++;
        continue;
      }

      console.log(`  概念代码: ${conceptCode}`);

      // 获取成分股
      const stocks = await getConceptStocks(conceptCode, topN);

      if (stocks.length > 0) {
        const stocksWithRank = stocks.map((s, idx) => ({
          ...s,
          rank: idx + 1,
        }));

        const isNew = !existingData.has(concept);
        existingData.set(concept, stocksWithRank);

        if (isNew) {
          newCount++;
        } else {
          updateCount++;
        }

        console.log(`  成分股: ${stocks.slice(0, 3).map(s => s.stock_name).join(", ")}...`);

        // 每5个概念保存一次
        if ((newCount + updateCount) % 5 === 0) {
          writeConceptStocks(existingData);
        }
      } else {
        console.log(`  未获取到成分股`);
        failCount++;
      }
    } catch (error) {
      console.log(`  爬取失败: ${error.message}`);
      failCount++;
    }

    // 请求间隔（增加到2秒避免限流）
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // 保存最终数据
  writeConceptStocks(existingData);

  console.log(`\n爬取完成!`);
  console.log(`  新增: ${newCount} 个概念`);
  console.log(`  更新: ${updateCount} 个概念`);
  console.log(`  失败: ${failCount} 个概念`);
  console.log(`\n数据已保存到: ${CONCEPT_STOCK_FILE}`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    concept: null,
    top: 10,
  };

  for (const arg of args) {
    if (arg.startsWith("--concept=")) {
      result.concept = arg.split("=")[1];
    } else if (arg.startsWith("--top=")) {
      result.top = parseInt(arg.split("=")[1]) || 10;
    }
  }

  return result;
}

// 主函数
async function main() {
  const args = parseArgs();

  console.log(`
概念成分股爬虫
================
${args.concept ? `指定概念: ${args.concept}` : "爬取所有概念"}
Top N: ${args.top}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  await crawlConceptStocks(args.concept, args.top);
}

main().catch(console.error);
