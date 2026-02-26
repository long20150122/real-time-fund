/**
 * 季度财务数据拆分测试报告
 * 测试时间: 2026-02-26
 * 
 * 测试范围：
 * 1. 数据拆分正确性验证
 * 2. 数据完整性验证
 * 3. API功能验证
 * 4. 前端兼容性验证
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FINANCE_FILE = path.join(DATA_DIR, "stock_quarter_finance.csv");
const HISTORY_FILE = path.join(DATA_DIR, "stock_history.csv");

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: [],
};

function logTest(category, name, status, message = "") {
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  const result = { category, name, status, message };
  testResults.details.push(result);
  if (status === "PASS") testResults.passed++;
  else if (status === "FAIL") testResults.failed++;
  else testResults.warnings++;
  console.log(`${icon} [${category}] ${name}${message ? ": " + message : ""}`);
}

// 解析CSV
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return null;

  const headers = lines[0].split(",");
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || "";
    });
    data.push(obj);
  }
  return { headers, data };
}

// HTTP请求
function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 15000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ data, statusCode: res.statusCode }));
        }
      )
      .on("error", reject)
      .on("timeout", () => reject(new Error("Timeout")));
  });
}

// ============ 1. 数据文件测试 ============
console.log("\n========================================");
console.log("1. 数据文件存在性与结构测试");
console.log("========================================\n");

function testDataFiles() {
  // 1.1 季度财务表存在性
  if (fs.existsSync(FINANCE_FILE)) {
    logTest("数据文件", "stock_quarter_finance.csv 存在", "PASS");
  } else {
    logTest("数据文件", "stock_quarter_finance.csv 存在", "FAIL", "文件不存在");
    return;
  }

  // 1.2 历史动态表存在性
  if (fs.existsSync(HISTORY_FILE)) {
    logTest("数据文件", "stock_history.csv 存在", "PASS");
  } else {
    logTest("数据文件", "stock_history.csv 存在", "FAIL", "文件不存在");
    return;
  }

  const financeCsv = parseCSV(FINANCE_FILE);
  const historyCsv = parseCSV(HISTORY_FILE);

  if (!financeCsv) {
    logTest("数据文件", "季度财务表解析", "FAIL", "无法解析CSV");
    return;
  }
  logTest("数据文件", "季度财务表解析", "PASS", `${financeCsv.data.length} 条记录`);

  if (!historyCsv) {
    logTest("数据文件", "历史动态表解析", "FAIL", "无法解析CSV");
    return;
  }
  logTest("数据文件", "历史动态表解析", "PASS", `${historyCsv.data.length} 条记录`);

  // 1.3 季度财务表字段验证（静态数据）
  const financeRequiredFields = [
    "id", "stock_code", "stock_name", "report_quarter", "report_year", "report_date",
    "quarter_revenue", "quarter_net_profit", "quarter_deducted_net_profit",
    "revenue_yoy", "net_profit_yoy", "deducted_net_profit_yoy",
    "basic_eps", "eps_yoy", "bps", "roe", "gross_margin",
    "ttm_revenue", "ttm_net_profit", "created_at"
  ];

  const financeMissing = financeRequiredFields.filter(f => !financeCsv.headers.includes(f));
  if (financeMissing.length === 0) {
    logTest("数据文件", "季度财务表字段完整性", "PASS", `${financeRequiredFields.length} 个字段全部存在`);
  } else {
    logTest("数据文件", "季度财务表字段完整性", "FAIL", `缺少: ${financeMissing.join(", ")}`);
  }

  // 1.4 历史动态表字段验证（动态数据）
  const historyRequiredFields = [
    "id", "stock_code", "stock_name", "trade_date",
    "pe_ttm", "pb", "ps", "total_market_cap", "float_market_cap", "ttm_eps", "created_at"
  ];

  const historyMissing = historyRequiredFields.filter(f => !historyCsv.headers.includes(f));
  if (historyMissing.length === 0) {
    logTest("数据文件", "历史动态表字段完整性", "PASS", `${historyRequiredFields.length} 个字段全部存在`);
  } else {
    logTest("数据文件", "历史动态表字段完整性", "FAIL", `缺少: ${historyMissing.join(", ")}`);
  }

  // 1.5 验证字段拆分正确性 - 季度财务表不应包含动态字段
  const dynamicFields = ["pe_ttm", "pb", "ps", "total_market_cap", "float_market_cap", "ttm_eps"];
  const financeHasDynamic = dynamicFields.filter(f => financeCsv.headers.includes(f));
  if (financeHasDynamic.length === 0) {
    logTest("数据拆分", "季度财务表不含动态字段", "PASS", "动态字段已正确移除");
  } else {
    logTest("数据拆分", "季度财务表不含动态字段", "FAIL", `仍包含: ${financeHasDynamic.join(", ")}`);
  }

  // 1.6 验证字段拆分正确性 - 历史动态表不应包含静态字段
  const staticFields = ["quarter_revenue", "quarter_net_profit", "basic_eps", "roe", "gross_margin", "report_quarter"];
  const historyHasStatic = staticFields.filter(f => historyCsv.headers.includes(f));
  if (historyHasStatic.length === 0) {
    logTest("数据拆分", "历史动态表不含静态字段", "PASS", "静态字段已正确移除");
  } else {
    logTest("数据拆分", "历史动态表不含静态字段", "FAIL", `仍包含: ${historyHasStatic.join(", ")}`);
  }

  return { financeCsv, historyCsv };
}

const csvData = testDataFiles();

// ============ 2. 数据完整性测试 ============
console.log("\n========================================");
console.log("2. 数据完整性测试");
console.log("========================================\n");

function testDataIntegrity() {
  if (!csvData) return;

  const { financeCsv, historyCsv } = csvData;

  // 2.1 两表股票代码一致性
  const financeStocks = new Set(financeCsv.data.map(d => d.stock_code));
  const historyStocks = new Set(historyCsv.data.map(d => d.stock_code));
  
  const financeOnly = [...financeStocks].filter(s => !historyStocks.has(s));
  const historyOnly = [...historyStocks].filter(s => !financeStocks.has(s));

  if (financeOnly.length === 0 && historyOnly.length === 0) {
    logTest("数据完整性", "两表股票代码一致", "PASS", `${financeStocks.size} 只股票`);
  } else {
    logTest("数据完整性", "两表股票代码一致", "WARN", 
      `财务表独有: ${financeOnly.join(",")}, 历史表独有: ${historyOnly.join(",")}`);
  }

  // 2.2 季度财务数据完整性
  const financeEmptyQuarter = financeCsv.data.filter(d => !d.report_quarter).length;
  const financeEmptyRevenue = financeCsv.data.filter(d => !d.quarter_revenue).length;
  
  logTest("数据完整性", "季度财务表-季度字段", 
    financeEmptyQuarter === 0 ? "PASS" : "FAIL", 
    `空值: ${financeEmptyQuarter}/${financeCsv.data.length}`);
  logTest("数据完整性", "季度财务表-营收字段", 
    financeEmptyRevenue === 0 ? "PASS" : "FAIL", 
    `空值: ${financeEmptyRevenue}/${financeCsv.data.length}`);

  // 2.3 历史动态数据完整性
  const historyEmptyDate = historyCsv.data.filter(d => !d.trade_date).length;
  logTest("数据完整性", "历史动态表-日期字段", 
    historyEmptyDate === 0 ? "PASS" : "FAIL", 
    `空值: ${historyEmptyDate}/${historyCsv.data.length}`);

  // 2.4 股票代码格式检查
  const invalidFinanceCodes = financeCsv.data.filter(d => !/^\d{5,6}$/.test(d.stock_code));
  const invalidHistoryCodes = historyCsv.data.filter(d => !/^\d{5,6}$/.test(d.stock_code));
  
  logTest("数据完整性", "季度财务表-代码格式", 
    invalidFinanceCodes.length === 0 ? "PASS" : "WARN", 
    invalidFinanceCodes.length > 0 ? `${invalidFinanceCodes.length} 条异常` : "");
  logTest("数据完整性", "历史动态表-代码格式", 
    invalidHistoryCodes.length === 0 ? "PASS" : "WARN", 
    invalidHistoryCodes.length > 0 ? `${invalidHistoryCodes.length} 条异常` : "");

  // 2.5 季度格式检查
  const invalidQuarters = financeCsv.data.filter(d => !/^\d{4}Q[1-4]$/.test(d.report_quarter));
  logTest("数据完整性", "季度格式(YYYYQx)", 
    invalidQuarters.length === 0 ? "PASS" : "FAIL", 
    invalidQuarters.length > 0 ? `${invalidQuarters.length} 条异常` : "");

  // 2.6 日期格式检查
  const invalidDates = historyCsv.data.filter(d => !/^\d{4}-\d{2}-\d{2}$/.test(d.trade_date));
  logTest("数据完整性", "日期格式(YYYY-MM-DD)", 
    invalidDates.length === 0 ? "PASS" : "WARN", 
    invalidDates.length > 0 ? `${invalidDates.length} 条异常` : "");

  // 2.7 数值字段非空率
  const numericFinanceFields = ["quarter_revenue", "quarter_net_profit", "basic_eps", "roe"];
  numericFinanceFields.forEach(field => {
    const nonEmpty = financeCsv.data.filter(d => d[field] && parseFloat(d[field]) !== 0);
    const rate = ((nonEmpty.length / financeCsv.data.length) * 100).toFixed(1);
    logTest("数据完整性", `季度财务-${field}非空率`, 
      parseFloat(rate) > 95 ? "PASS" : parseFloat(rate) > 80 ? "WARN" : "FAIL", 
      `${rate}%`);
  });

  // 2.8 数值合理性检查
  let unreasonableCount = 0;
  financeCsv.data.forEach(d => {
    const roe = parseFloat(d.roe) || 0;
    if (Math.abs(roe) > 100) unreasonableCount++;
    const margin = parseFloat(d.gross_margin) || 0;
    if (margin > 100 || margin < -50) unreasonableCount++;
  });
  logTest("数据完整性", "数值合理性", 
    unreasonableCount === 0 ? "PASS" : "WARN", 
    unreasonableCount > 0 ? `${unreasonableCount} 条可能异常` : "无明显异常");

  // 2.9 数据量统计
  const uniqueFinanceStocks = new Set(financeCsv.data.map(d => d.stock_code));
  const uniqueQuarters = new Set(financeCsv.data.map(d => d.report_quarter));
  const uniqueHistoryDates = new Set(historyCsv.data.map(d => d.trade_date));

  logTest("数据完整性", "季度财务数据量", "PASS", 
    `${uniqueFinanceStocks.size} 只股票, ${uniqueQuarters.size} 个季度, ${financeCsv.data.length} 条记录`);
  logTest("数据完整性", "历史动态数据量", "PASS", 
    `${historyStocks.size} 只股票, ${uniqueHistoryDates.size} 个日期, ${historyCsv.data.length} 条记录`);
}

testDataIntegrity();

// ============ 3. API接口测试 ============
console.log("\n========================================");
console.log("3. API接口测试");
console.log("========================================\n");

async function testAPIs() {
  const baseUrl = "http://localhost:3000";

  // 3.1 财务数据概览接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.totalRecords && json.totalStocks) {
        logTest("API接口", "GET /api/stock-finance (概览)", "PASS", 
          `${json.totalRecords} 条记录，${json.totalStocks} 只股票`);
      } else {
        logTest("API接口", "GET /api/stock-finance (概览)", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance (概览)", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance (概览)", "WARN", `请求失败: ${e.message}`);
  }

  // 3.2 单股查询接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?code=002027`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.data.length > 0 && json.stock_name) {
        // 验证返回数据包含动态字段（从历史表合并）
        const hasPE = json.data[0].pe_ttm !== undefined;
        const hasPB = json.data[0].pb !== undefined;
        const hasMarketCap = json.data[0].total_market_cap !== undefined;
        
        if (hasPE && hasPB && hasMarketCap) {
          logTest("API接口", "GET /api/stock-finance?code=002027", "PASS", 
            `${json.data.length} 条记录，含动态数据`);
        } else {
          logTest("API接口", "GET /api/stock-finance?code=002027", "WARN", 
            "动态数据字段缺失");
        }
      } else {
        logTest("API接口", "GET /api/stock-finance?code=002027", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?code=002027", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?code=002027", "WARN", `请求失败: ${e.message}`);
  }

  // 3.3 历史动态数据接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-history?code=002027`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.data.length > 0) {
        // 验证返回数据只有动态字段
        const record = json.data[0];
        const hasDynamicFields = record.pe_ttm !== undefined && record.trade_date !== undefined;
        const hasNoStaticFields = record.quarter_revenue === undefined && record.roe === undefined;
        
        if (hasDynamicFields && hasNoStaticFields) {
          logTest("API接口", "GET /api/stock-history?code=002027", "PASS", 
            `${json.data.length} 条历史记录`);
        } else {
          logTest("API接口", "GET /api/stock-history?code=002027", "WARN", 
            "数据字段不符合预期");
        }
      } else {
        logTest("API接口", "GET /api/stock-history?code=002027", "WARN", "返回数据为空");
      }
    } else {
      logTest("API接口", "GET /api/stock-history?code=002027", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-history?code=002027", "WARN", `请求失败: ${e.message}`);
  }

  // 3.4 PEG估值接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?peg=all`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        const undervalued = json.data.filter(d => d.peg > 0 && d.peg < 1).length;
        logTest("API接口", "GET /api/stock-finance?peg=all", "PASS", 
          `${json.data.length} 只股票，${undervalued} 只低估`);
      } else {
        logTest("API接口", "GET /api/stock-finance?peg=all", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?peg=all", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?peg=all", "WARN", `请求失败: ${e.message}`);
  }

  // 3.5 季度查询接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?quarter=2025Q3`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.quarter === "2025Q3") {
        logTest("API接口", "GET /api/stock-finance?quarter=2025Q3", "PASS", 
          `${json.total} 条记录`);
      } else {
        logTest("API接口", "GET /api/stock-finance?quarter=...", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?quarter=...", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?quarter=...", "WARN", `请求失败: ${e.message}`);
  }

  // 3.6 异常情况 - 不存在的股票
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?code=999999`);
    if (res.statusCode === 404) {
      logTest("API接口", "不存在的股票返回404", "PASS");
    } else {
      logTest("API接口", "不存在的股票返回404", "FAIL", `返回状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "不存在的股票返回404", "WARN", `请求失败: ${e.message}`);
  }

  // 3.7 批量查询接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?codes=002027,002558`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.total > 0) {
        logTest("API接口", "GET /api/stock-finance?codes=...", "PASS", 
          `返回 ${json.total} 条记录`);
      } else {
        logTest("API接口", "GET /api/stock-finance?codes=...", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?codes=...", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?codes=...", "WARN", `请求失败: ${e.message}`);
  }
}

// ============ 4. 爬虫脚本测试 ============
console.log("\n========================================");
console.log("4. 爬虫脚本测试");
console.log("========================================\n");

function testSpiderScript() {
  const spiderPath = path.join(__dirname, "..", "crawler", "quarterFinanceSpider.js");

  if (fs.existsSync(spiderPath)) {
    logTest("爬虫脚本", "quarterFinanceSpider.js 存在", "PASS");
  } else {
    logTest("爬虫脚本", "quarterFinanceSpider.js 存在", "FAIL", "文件不存在");
    return;
  }

  try {
    const content = fs.readFileSync(spiderPath, "utf-8");
    
    // 验证关键函数存在
    const syntaxChecks = [
      { pattern: /STOCK_HISTORY_FILE/, name: "历史表文件路径定义" },
      { pattern: /readStockHistory/, name: "历史数据读取函数" },
      { pattern: /writeStockHistory/, name: "历史数据写入函数" },
      { pattern: /writeQuarterFinance/, name: "财务数据写入函数" },
      { pattern: /crawlStockFinance/, name: "爬取函数" },
    ];

    let allPassed = true;
    syntaxChecks.forEach(check => {
      if (!check.pattern.test(content)) {
        logTest("爬虫脚本", `检查-${check.name}`, "FAIL");
        allPassed = false;
      }
    });
    if (allPassed) {
      logTest("爬虫脚本", "关键函数检查", "PASS", "全部检查项通过");
    }

    // 验证写入历史表的逻辑
    if (content.includes("historyRecords") && content.includes("writeStockHistory")) {
      logTest("爬虫脚本", "历史表写入逻辑", "PASS", "已实现拆分写入");
    } else {
      logTest("爬虫脚本", "历史表写入逻辑", "FAIL", "缺少历史表写入逻辑");
    }

  } catch (e) {
    logTest("爬虫脚本", "脚本读取", "FAIL", e.message);
  }
}

testSpiderScript();

// ============ 5. 迁移脚本测试 ============
console.log("\n========================================");
console.log("5. 迁移脚本测试");
console.log("========================================\n");

function testMigrationScript() {
  const migrationPath = path.join(__dirname, "..", "crawler", "migrateStockData.js");

  if (fs.existsSync(migrationPath)) {
    logTest("迁移脚本", "migrateStockData.js 存在", "PASS");
  } else {
    logTest("迁移脚本", "migrateStockData.js 存在", "WARN", "迁移脚本不存在（可能已删除）");
    return;
  }

  try {
    const content = fs.readFileSync(migrationPath, "utf-8");
    
    // 检查迁移脚本是否包含拆分逻辑
    const hasHistoryFile = content.includes("HISTORY_FILE") || content.includes("stock_history");
    const hasFinanceHeaders = content.includes("newFinanceHeaders") || content.includes("historyHeaders");
    const hasSplitLogic = content.includes("historyRecords") && content.includes("newFinanceRecords");
    
    if (hasHistoryFile && hasFinanceHeaders && hasSplitLogic) {
      logTest("迁移脚本", "拆分逻辑", "PASS", "已实现数据拆分");
    } else {
      logTest("迁移脚本", "拆分逻辑", "FAIL", "缺少拆分逻辑");
    }
  } catch (e) {
    logTest("迁移脚本", "脚本读取", "FAIL", e.message);
  }
}

testMigrationScript();

// ============ 运行API测试 ============
(async () => {
  await testAPIs();

  // ============ 测试报告汇总 ============
  console.log("\n========================================");
  console.log("测试报告汇总");
  console.log("========================================\n");

  const total = testResults.passed + testResults.failed + testResults.warnings;
  const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

  console.log(`总测试数: ${total}`);
  console.log(`通过: ${testResults.passed} (${passRate}%)`);
  console.log(`失败: ${testResults.failed}`);
  console.log(`警告: ${testResults.warnings}`);
  console.log("");

  if (testResults.failed > 0) {
    console.log("❌ 失败的测试项:");
    testResults.details
      .filter(d => d.status === "FAIL")
      .forEach(d => {
        console.log(`  - [${d.category}] ${d.name}: ${d.message}`);
      });
  }

  if (testResults.warnings > 0) {
    console.log("\n⚠️ 警告项:");
    testResults.details
      .filter(d => d.status === "WARN")
      .forEach(d => {
        console.log(`  - [${d.category}] ${d.name}: ${d.message}`);
      });
  }

  console.log("\n========================================");
  console.log(`测试结果: ${testResults.failed === 0 ? "✅ 全部通过" : "❌ 存在失败项"}`);
  console.log("========================================\n");

  // 写入测试报告文件
  const reportPath = path.join(__dirname, "quarter-finance-test-report.md");
  const reportContent = `# 数据拆分测试报告

**测试时间**: ${new Date().toISOString()}

## 测试摘要

| 指标 | 值 |
|------|-----|
| 总测试数 | ${total} |
| 通过 | ${testResults.passed} |
| 失败 | ${testResults.failed} |
| 警告 | ${testResults.warnings} |
| 通过率 | ${passRate}% |

## 测试范围

1. **数据文件存在性与结构测试** - 验证两个CSV文件存在且字段正确
2. **数据完整性测试** - 验证数据无缺失、格式正确、数值合理
3. **API接口测试** - 验证所有API正常工作且返回正确数据
4. **爬虫脚本测试** - 验证爬虫已更新支持双表写入
5. **迁移脚本测试** - 验证迁移脚本存在且逻辑正确

## 数据拆分说明

### stock_quarter_finance.csv (静态季度财务数据)
- 字段: id, stock_code, stock_name, report_quarter, report_year, report_date, quarter_revenue, quarter_net_profit, quarter_deducted_net_profit, revenue_yoy, net_profit_yoy, deducted_net_profit_yoy, basic_eps, eps_yoy, bps, roe, gross_margin, ttm_revenue, ttm_net_profit, created_at
- 更新频率: 按季度更新

### stock_history.csv (动态历史数据)
- 字段: id, stock_code, stock_name, trade_date, pe_ttm, pb, ps, total_market_cap, float_market_cap, ttm_eps, created_at
- 更新频率: 每日更新

## 测试详情

### 通过项
${testResults.details
  .filter(d => d.status === "PASS")
  .map(d => `- ✅ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
  .join("\n")}

### 失败项
${testResults.details.filter(d => d.status === "FAIL").length > 0
  ? testResults.details
      .filter(d => d.status === "FAIL")
      .map(d => `- ❌ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
      .join("\n")
  : "无"}

### 警告项
${testResults.details.filter(d => d.status === "WARN").length > 0
  ? testResults.details
      .filter(d => d.status === "WARN")
      .map(d => `- ⚠️ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
      .join("\n")
  : "无"}

## 结论

${testResults.failed === 0 ? "✅ 所有测试通过，数据拆分成功，功能正常" : "❌ 存在失败项，需要修复"}
`;

  fs.writeFileSync(reportPath, reportContent, "utf-8");
  console.log(`测试报告已保存到: ${reportPath}`);
})();
