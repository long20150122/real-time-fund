/**
 * 股票季度财务数据爬虫脚本
 * 用于爬取股票的季度财务报表数据
 *
 * 使用方法:
 * node crawler/quarterFinanceSpider.js                     # 爬取所有股票财务数据
 * node crawler/quarterFinanceSpider.js --codes=002027,00700 # 仅爬取指定股票
 * node crawler/quarterFinanceSpider.js --force              # 强制全量更新
 *
 * 数据来源：
 * 1. 东方财富 datacenter - RPT_LICO_FN_CPD (业绩报表)
 * 2. 东方财富 datacenter - RPT_DMSK_FN_INCOME (利润表)
 * 3. 腾讯行情接口 - 实时市值、PE(TTM)、PB
 * 4. 东方财富 datacenter - RPT_DATA_HSYXHIST (历史估值数据)
 *
 * 支持PEG估值法的字段：
 * - pe_ttm: 历史PE(TTM)
 * - pb: 历史PB
 * - ps: 市销率（总市值/营收TTM）
 * - eps_yoy: EPS同比增长率
 * - net_profit_yoy: 净利润同比增长率
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// CSV 文件路径
const DATA_DIR = path.join(__dirname, "..", "data");
const STOCKS_FILE = path.join(DATA_DIR, "stocks.csv");
const QUARTER_FINANCE_FILE = path.join(DATA_DIR, "stock_quarter_finance.csv");

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
 * 从业绩报表接口获取财务数据
 */
async function getFinanceFromReport(stockCode) {
  const url = `https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=ALL&filter=(SECURITY_CODE%3D%22${stockCode}%22)&pageSize=20`;

  try {
    const { data } = await httpRequest(url, 2, 1500);
    const json = JSON.parse(data);

    if (!json.result || !json.result.data) return [];

    return json.result.data.map((item) => ({
      stock_code: item.SECURITY_CODE,
      stock_name: item.SECURITY_NAME_ABBR,
      report_quarter: item.QDATE,
      report_year: item.DATAYEAR,
      report_date: item.REPORTDATE ? item.REPORTDATE.split(" ")[0] : "",
      quarter_revenue: item.TOTAL_OPERATE_INCOME || 0,
      quarter_net_profit: item.PARENT_NETPROFIT || 0,
      revenue_yoy: item.YSTZ || 0,
      net_profit_yoy: item.SJLTZ || 0,
      basic_eps: item.BASIC_EPS || 0,
      bps: item.BPS || 0,
      roe: item.WEIGHTAVG_ROE || 0,
      gross_margin: item.XSMLL || 0,
      operating_cf: item.MGJYXJJE || 0,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * 从利润表接口获取扣非净利润
 */
async function getDeductedProfit(stockCode) {
  const url = `https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=SECURITY_CODE,REPORT_DATE,DEDUCT_PARENT_NETPROFIT&filter=(SECURITY_CODE%3D%22${stockCode}%22)&pageSize=20`;

  try {
    const { data } = await httpRequest(url, 2, 1500);
    const json = JSON.parse(data);

    if (!json.result || !json.result.data) return {};

    const result = {};
    json.result.data.forEach((item) => {
      if (item.REPORT_DATE && item.DEDUCT_PARENT_NETPROFIT !== null) {
        const date = item.REPORT_DATE.split(" ")[0];
        result[date] = item.DEDUCT_PARENT_NETPROFIT;
      }
    });
    return result;
  } catch (error) {
    return {};
  }
}

/**
 * 从腾讯接口获取实时市值数据
 * 字段位置说明：
 * - 1: 股票名称
 * - 3: 现价
 * - 44: 总市值（亿元）
 * - 45: 流通市值（亿元）
 * - 46: 市净率 PB
 * - 52: PE(TTM)
 */
async function getMarketData(stockCode) {
  // 构造市场代码
  let marketCode = "sz";
  if (stockCode.length === 5) {
    marketCode = "hk"; // 港股
  } else if (stockCode.startsWith("6")) {
    marketCode = "sh"; // 上海
  }

  const url = `https://qt.gtimg.cn/q=${marketCode}${stockCode}`;

  try {
    const { data } = await httpRequest(url, 2, 1000);

    // 解析返回数据
    // 格式: v_sz002027="51~名称~代码~现价~...~总市值~流通市值~..."
    const match = data.match(/v_\w+="([^"]+)"/);
    if (!match) return null;

    const parts = match[1].split("~");
    if (parts.length < 55) return null;

    return {
      stock_name: parts[1],
      current_price: parseFloat(parts[3]) || 0,
      total_market_cap: parseFloat(parts[44]) || 0, // 总市值（亿元）
      float_market_cap: parseFloat(parts[45]) || 0, // 流通市值（亿元）
      pe_ttm: parseFloat(parts[52]) || 0, // PE(TTM)
      pb: parseFloat(parts[46]) || 0, // PB
    };
  } catch (error) {
    return null;
  }
}

/**
 * 获取历史估值数据（PE、PB历史数据）
 * 用于PEG估值分析
 */
async function getHistoricalValuation(stockCode) {
  // 构造secid格式
  let secid = "0." + stockCode; // 默认深市
  if (stockCode.length === 5) {
    secid = "116." + stockCode; // 港股
  } else if (stockCode.startsWith("6")) {
    secid = "1." + stockCode; // 沪市
  }

  // 使用东方财富历史估值接口
  const url = `https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_DATA_HSYXHIST&columns=ALL&filter=(SECUCODE%3D%22${secid}%22)&pageSize=30&sortColumns=TRADE_DATE&sortTypes=-1`;

  try {
    const { data } = await httpRequest(url, 2, 1500);
    const json = JSON.parse(data);

    if (!json.result || !json.result.data) return [];

    return json.result.data.map((item) => ({
      trade_date: item.TRADE_DATE ? item.TRADE_DATE.split(" ")[0] : "",
      pe_ttm: item.PE_TTM || 0,
      pb: item.PB || 0,
      ps_ttm: item.PS_TTM || 0,
      total_mv: item.TOTAL_MV || 0, // 总市值
    }));
  } catch (error) {
    return [];
  }
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
 * 读取现有财务数据
 */
function readQuarterFinance() {
  if (!fs.existsSync(QUARTER_FINANCE_FILE)) {
    return new Map();
  }

  let content = fs.readFileSync(QUARTER_FINANCE_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return new Map();

  const headers = lines[0].split(",");
  const codeIndex = headers.indexOf("stock_code");
  const quarterIndex = headers.indexOf("report_quarter");

  const dataMap = new Map();
  lines.slice(1).filter((l) => l.trim()).forEach((line) => {
    const values = parseCSVRow(line);
    const code = values[codeIndex];
    const quarter = values[quarterIndex];
    if (code && quarter) {
      const key = `${code}_${quarter}`;
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      dataMap.set(key, obj);
    }
  });

  return dataMap;
}

/**
 * 写入财务数据
 */
function writeQuarterFinance(dataMap) {
  const headers = [
    "id",
    "stock_code",
    "stock_name",
    "report_quarter",
    "report_year",
    "report_date",
    "quarter_revenue",
    "quarter_net_profit",
    "quarter_deducted_net_profit",
    "revenue_yoy",
    "net_profit_yoy",
    "deducted_net_profit_yoy",
    "basic_eps",
    "eps_yoy",
    "bps",
    "roe",
    "gross_margin",
    "pe_ttm",
    "pb",
    "ps",
    "total_market_cap",
    "float_market_cap",
    "ttm_revenue",
    "ttm_net_profit",
    "ttm_eps",
    "created_at",
  ];
  const headerLine = headers.join(",");
  const lines = [
    headerLine,
    ...Array.from(dataMap.values()).map((s) => {
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
  fs.writeFileSync(QUARTER_FINANCE_FILE, BOM + lines.join("\n") + "\n", "utf-8");
}

/**
 * 计算扣非净利润同比增长率
 */
function calculateDeductedYoy(data, deductedProfitMap) {
  const sortedData = [...data].sort((a, b) =>
    a.report_quarter.localeCompare(b.report_quarter)
  );

  return sortedData.map((item, index) => {
    const deducted = deductedProfitMap[item.report_date] || 0;

    // 查找去年同季度数据
    const lastYearQuarter = item.report_quarter.replace(
      /^\d{4}/,
      (year) => parseInt(year) - 1
    );
    const lastYearData = sortedData.find((d) => d.report_quarter === lastYearQuarter);
    const lastYearDeducted = lastYearData
      ? deductedProfitMap[lastYearData.report_date] || 0
      : 0;

    // 计算同比增长率
    let deductedYoy = 0;
    if (lastYearDeducted > 0 && deducted > 0) {
      deductedYoy = ((deducted - lastYearDeducted) / lastYearDeducted) * 100;
      deductedYoy = Math.round(deductedYoy * 100) / 100;
    }

    return {
      ...item,
      quarter_deducted_net_profit: deducted,
      deducted_net_profit_yoy: deductedYoy,
    };
  });
}

/**
 * 计算EPS同比增长率（PEG估值法核心指标）
 */
function calculateEpsYoy(data) {
  const sortedData = [...data].sort((a, b) =>
    a.report_quarter.localeCompare(b.report_quarter)
  );

  return sortedData.map((item) => {
    // 查找去年同季度数据
    const lastYearQuarter = item.report_quarter.replace(
      /^\d{4}/,
      (year) => parseInt(year) - 1
    );
    const lastYearData = sortedData.find((d) => d.report_quarter === lastYearQuarter);

    // 计算EPS同比增长率
    let epsYoy = 0;
    const currentEps = parseFloat(item.basic_eps) || 0;
    const lastYearEps = lastYearData ? parseFloat(lastYearData.basic_eps) || 0 : 0;

    if (lastYearEps !== 0 && currentEps !== 0) {
      epsYoy = ((currentEps - lastYearEps) / Math.abs(lastYearEps)) * 100;
      epsYoy = Math.round(epsYoy * 100) / 100;
    }

    return {
      ...item,
      eps_yoy: epsYoy,
    };
  });
}

/**
 * 计算TTM指标（最近4个季度滚动数据）
 * 用于计算PE(TTM)、PS(TTM)等
 */
function calculateTtmMetrics(data, historicalValuation) {
  const sortedData = [...data].sort((a, b) =>
    b.report_quarter.localeCompare(a.report_quarter)
  );

  // 计算TTM营收和净利润
  let ttmRevenue = 0;
  let ttmNetProfit = 0;
  const recent4Quarters = sortedData.slice(0, 4);

  recent4Quarters.forEach((item) => {
    ttmRevenue += parseFloat(item.quarter_revenue) || 0;
    ttmNetProfit += parseFloat(item.quarter_net_profit) || 0;
  });

  // TTM每股收益
  const ttmEps = recent4Quarters.reduce((sum, item) => sum + (parseFloat(item.basic_eps) || 0), 0);

  return {
    ttm_revenue: ttmRevenue,
    ttm_net_profit: ttmNetProfit,
    ttm_eps: ttmEps,
  };
}

/**
 * 爬取单个股票的财务数据
 */
async function crawlStockFinance(stockCode, stockName, existingData, forceUpdate) {
  const keyPrefix = `${stockCode}_`;

  // 检查是否已有数据
  if (!forceUpdate) {
    const existingCount = Array.from(existingData.keys()).filter((k) =>
      k.startsWith(keyPrefix)
    ).length;
    if (existingCount >= 8) {
      console.log(`  已有 ${existingCount} 个季度数据，跳过`);
      return [];
    }
  }

  console.log(`  正在获取财务数据...`);

  // 获取业绩报表数据
  const financeData = await getFinanceFromReport(stockCode);
  if (financeData.length === 0) {
    console.log(`  无财务数据`);
    return [];
  }

  // 获取扣非净利润
  const deductedProfitMap = await getDeductedProfit(stockCode);

  // 计算扣非净利润同比增长
  let processedData = calculateDeductedYoy(financeData, deductedProfitMap);

  // 计算EPS同比增长率（PEG估值法核心指标）
  processedData = calculateEpsYoy(processedData);

  // 获取实时市值数据
  const marketData = await getMarketData(stockCode);

  // 获取历史估值数据（用于PEG分析）
  const historicalValuation = await getHistoricalValuation(stockCode);

  // 创建估值数据映射（按季度匹配）
  const valuationMap = new Map();
  historicalValuation.forEach((v) => {
    if (v.trade_date) {
      // 提取季度信息
      const date = new Date(v.trade_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      let quarter = "Q1";
      if (month >= 4 && month <= 6) quarter = "Q1";
      else if (month >= 7 && month <= 9) quarter = "Q2";
      else if (month >= 10 && month <= 12) quarter = "Q3";
      else quarter = "Q4";
      const key = `${year}${quarter}`;
      valuationMap.set(key, v);
    }
  });

  // 计算TTM指标
  const ttmMetrics = calculateTtmMetrics(processedData, historicalValuation);

  // 找出最新季度（processedData 是按季度升序排序的，所以最后一个是最新的）
  const sortedByQuarter = [...processedData].sort((a, b) =>
    b.report_quarter.localeCompare(a.report_quarter)
  );
  const latestQuarter = sortedByQuarter[0]?.report_quarter;

  // 合并数据
  const now = new Date().toISOString();
  const newRecords = processedData.map((item) => {
    const key = `${stockCode}_${item.report_quarter}`;

    // 尝试从历史估值数据获取PE/PB，如果没有则使用实时数据
    const histVal = valuationMap.get(item.report_quarter);
    // 只对最新季度使用实时PE/PB
    const isLatestQuarter = item.report_quarter === latestQuarter;
    const peTtm = histVal?.pe_ttm || (isLatestQuarter ? marketData?.pe_ttm : "") || "";
    const pb = histVal?.pb || (isLatestQuarter ? marketData?.pb : "") || "";
    const ps = histVal?.ps_ttm || "";

    // 计算PS（如果历史数据没有，用市值/TTM营收计算）
    let psCalc = ps;
    if (!psCalc && marketData?.total_market_cap && ttmMetrics.ttm_revenue > 0) {
      // 市值（亿）/ TTM营收（亿）
      const revenueInYi = ttmMetrics.ttm_revenue / 100000000; // 转换为亿
      if (revenueInYi > 0) {
        psCalc = Math.round((marketData.total_market_cap / revenueInYi) * 100) / 100;
      }
    }

    return {
      id: existingData.has(key) ? existingData.get(key).id : generateId(),
      stock_code: stockCode,
      stock_name: item.stock_name || stockName,
      report_quarter: item.report_quarter,
      report_year: item.report_year,
      report_date: item.report_date,
      quarter_revenue: item.quarter_revenue,
      quarter_net_profit: item.quarter_net_profit,
      quarter_deducted_net_profit: item.quarter_deducted_net_profit || "",
      revenue_yoy: item.revenue_yoy,
      net_profit_yoy: item.net_profit_yoy,
      deducted_net_profit_yoy: item.deducted_net_profit_yoy || "",
      basic_eps: item.basic_eps,
      eps_yoy: item.eps_yoy || "",
      bps: item.bps,
      roe: item.roe,
      gross_margin: item.gross_margin,
      pe_ttm: peTtm,
      pb: pb,
      ps: psCalc,
      total_market_cap: marketData?.total_market_cap || "",
      float_market_cap: marketData?.float_market_cap || "",
      ttm_revenue: ttmMetrics.ttm_revenue,
      ttm_net_profit: ttmMetrics.ttm_net_profit,
      ttm_eps: ttmMetrics.ttm_eps,
      created_at: now,
    };
  });

  console.log(`  获取 ${newRecords.length} 个季度数据`);
  return newRecords;
}

/**
 * 爬取所有股票的财务数据
 */
async function crawlAllStocks(specificCodes = null, forceUpdate = false) {
  console.log("开始爬取股票季度财务数据...\n");

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

  const existingData = readQuarterFinance();
  console.log(`已有 ${existingData.size} 条财务数据\n`);

  let newCount = 0;
  let updateCount = 0;
  let failCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const { code, name } = stocks[i];
    console.log(`[${i + 1}/${stocks.length}] ${code} ${name || "(未知)"}`);

    try {
      const records = await crawlStockFinance(
        code,
        name,
        existingData,
        forceUpdate
      );

      if (records.length > 0) {
        records.forEach((r) => {
          const key = `${r.stock_code}_${r.report_quarter}`;
          const isNew = !existingData.has(key);
          existingData.set(key, r);
          if (isNew) {
            newCount++;
          } else {
            updateCount++;
          }
        });

        // 每获取 5 只股票保存一次
        if ((newCount + updateCount) % 20 === 0) {
          writeQuarterFinance(existingData);
        }
      }
    } catch (error) {
      console.log(`  爬取失败: ${error.message}`);
      failCount++;
    }

    // 请求间隔
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // 保存最终数据
  writeQuarterFinance(existingData);

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
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--codes=")) {
      result.codes = arg
        .split("=")[1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (arg === "--force") {
      result.force = true;
    }
  }

  return result;
}

// 主函数
async function main() {
  const args = parseArgs();

  console.log(`
股票季度财务数据爬虫
====================
${args.codes ? `指定股票: ${args.codes.join(", ")}` : "爬取所有股票"}
${args.force ? "强制全量更新" : "增量更新"}
  `);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  await crawlAllStocks(args.codes, args.force);
}

main().catch(console.error);
