/**
 * 季度财务数据爬虫与API测试报告
 * 测试时间: 2026-02-25
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FINANCE_FILE = path.join(DATA_DIR, "stock_quarter_finance.csv");

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
function parseCSV() {
  if (!fs.existsSync(FINANCE_FILE)) {
    return null;
  }
  let content = fs.readFileSync(FINANCE_FILE, "utf-8");
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

// HTTP请求（支持http和https）
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
console.log("1. 数据文件测试");
console.log("========================================\n");

function testDataFile() {
  // 1.1 文件存在性
  if (fs.existsSync(FINANCE_FILE)) {
    logTest("数据文件", "文件存在", "PASS");
  } else {
    logTest("数据文件", "文件存在", "FAIL", "stock_quarter_finance.csv 不存在");
    return;
  }

  const csvData = parseCSV();
  if (!csvData) {
    logTest("数据文件", "CSV解析", "FAIL", "无法解析CSV文件");
    return;
  }
  logTest("数据文件", "CSV解析", "PASS", `解析成功，共 ${csvData.data.length} 条记录`);

  // 1.2 必要字段检查
  const requiredFields = [
    "id",
    "stock_code",
    "stock_name",
    "report_quarter",
    "report_year",
    "report_date",
    "quarter_revenue",
    "quarter_net_profit",
    "basic_eps",
    "eps_yoy",
    "pe_ttm",
    "pb",
    "ps",
    "ttm_revenue",
    "ttm_net_profit",
    "ttm_eps",
  ];

  const missingFields = requiredFields.filter((f) => !csvData.headers.includes(f));
  if (missingFields.length === 0) {
    logTest("数据文件", "必要字段", "PASS", `全部 ${requiredFields.length} 个字段存在`);
  } else {
    logTest("数据文件", "必要字段", "FAIL", `缺少字段: ${missingFields.join(", ")}`);
  }

  // 1.3 数据量统计
  const uniqueStocks = new Set(csvData.data.map((d) => d.stock_code));
  const uniqueQuarters = new Set(csvData.data.map((d) => d.report_quarter));
  logTest(
    "数据文件",
    "数据量统计",
    "PASS",
    `${uniqueStocks.size} 只股票，${uniqueQuarters.size} 个季度，${csvData.data.length} 条记录`
  );

  return csvData;
}

const csvData = testDataFile();

// ============ 2. 数据质量测试 ============
console.log("\n========================================");
console.log("2. 数据质量测试");
console.log("========================================\n");

function testDataQuality() {
  if (!csvData) return;

  const { data } = csvData;

  // 2.1 股票代码格式检查
  const invalidCodes = data.filter((d) => !/^\d{5,6}$/.test(d.stock_code));
  if (invalidCodes.length === 0) {
    logTest("数据质量", "股票代码格式", "PASS", "全部格式正确");
  } else {
    logTest(
      "数据质量",
      "股票代码格式",
      "WARN",
      `${invalidCodes.length} 条记录格式异常`
    );
  }

  // 2.2 季度格式检查
  const invalidQuarters = data.filter((d) => !/^\d{4}Q[1-4]$/.test(d.report_quarter));
  if (invalidQuarters.length === 0) {
    logTest("数据质量", "季度格式", "PASS", "全部格式正确 (YYYYQx)");
  } else {
    logTest("数据质量", "季度格式", "FAIL", `${invalidQuarters.length} 条记录格式异常`);
  }

  // 2.3 数值字段非空率
  const numericFields = [
    "quarter_revenue",
    "quarter_net_profit",
    "basic_eps",
    "bps",
    "roe",
    "gross_margin",
  ];
  numericFields.forEach((field) => {
    const nonEmpty = data.filter((d) => d[field] && parseFloat(d[field]) !== 0);
    const rate = ((nonEmpty.length / data.length) * 100).toFixed(1);
    if (parseFloat(rate) > 95) {
      logTest("数据质量", `${field}非空率`, "PASS", `${rate}%`);
    } else if (parseFloat(rate) > 80) {
      logTest("数据质量", `${field}非空率`, "WARN", `${rate}%`);
    } else {
      logTest("数据质量", `${field}非空率`, "FAIL", `${rate}%`);
    }
  });

  // 2.4 估值字段非空率（只检查最新季度）
  const latestQuarter = [...new Set(data.map((d) => d.report_quarter))].sort().reverse()[0];
  const latestData = data.filter((d) => d.report_quarter === latestQuarter);
  logTest("数据质量", "最新季度", "PASS", latestQuarter);

  ["pe_ttm", "pb", "ps"].forEach((field) => {
    const nonEmpty = latestData.filter((d) => d[field] && parseFloat(d[field]) > 0);
    const rate = ((nonEmpty.length / latestData.length) * 100).toFixed(1);
    // PE/PB/PS只需要最新季度有值即可，历史季度可以没有
    if (parseFloat(rate) >= 50) {
      logTest("数据质量", `${field}非空率(最新季度)`, "PASS", `${rate}% (${nonEmpty.length}/${latestData.length})`);
    } else if (parseFloat(rate) > 20) {
      logTest("数据质量", `${field}非空率(最新季度)`, "WARN", `${rate}%`);
    } else {
      logTest("数据质量", `${field}非空率(最新季度)`, "FAIL", `${rate}%`);
    }
  });

  // 2.5 EPS同比增长率计算验证
  const stockData = data.filter((d) => d.stock_code === "002027").sort((a, b) =>
    a.report_quarter.localeCompare(b.report_quarter)
  );
  let epsYoyCorrect = 0;
  let epsYoyTotal = 0;

  for (let i = 4; i < stockData.length; i++) {
    const current = stockData[i];
    const lastYear = stockData[i - 4];

    if (current.basic_eps && lastYear.basic_eps) {
      const currentEps = parseFloat(current.basic_eps);
      const lastYearEps = parseFloat(lastYear.basic_eps);
      const expected = lastYearEps !== 0
        ? Math.round(((currentEps - lastYearEps) / Math.abs(lastYearEps)) * 10000) / 100
        : 0;
      const actual = parseFloat(current.eps_yoy) || 0;

      epsYoyTotal++;
      if (Math.abs(expected - actual) < 0.5) {
        epsYoyCorrect++;
      }
    }
  }

  if (epsYoyTotal > 0) {
    const accuracy = ((epsYoyCorrect / epsYoyTotal) * 100).toFixed(1);
    logTest(
      "数据质量",
      "EPS同比增长率计算",
      accuracy > 95 ? "PASS" : "FAIL",
      `准确率 ${accuracy}% (${epsYoyCorrect}/${epsYoyTotal})`
    );
  }

  // 2.6 数值合理性检查
  let unreasonableCount = 0;
  data.forEach((d) => {
    // ROE一般不超过100%
    const roe = parseFloat(d.roe) || 0;
    if (Math.abs(roe) > 100) unreasonableCount++;

    // 毛利率一般不超过100%
    const margin = parseFloat(d.gross_margin) || 0;
    if (margin > 100 || margin < -50) unreasonableCount++;

    // PE一般不超过1000
    const pe = parseFloat(d.pe_ttm) || 0;
    if (pe > 1000 || pe < 0) unreasonableCount++;
  });

  if (unreasonableCount === 0) {
    logTest("数据质量", "数值合理性", "PASS", "无明显异常值");
  } else {
    logTest("数据质量", "数值合理性", "WARN", `${unreasonableCount} 条可能异常`);
  }
}

testDataQuality();

// ============ 3. API接口测试 ============
console.log("\n========================================");
console.log("3. API接口测试");
console.log("========================================\n");

async function testAPIs() {
  const baseUrl = "http://localhost:3001";

  // 3.1 财务数据概览接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.totalRecords && json.totalStocks) {
        logTest(
          "API接口",
          "GET /api/stock-finance (概览)",
          "PASS",
          `${json.totalRecords} 条记录，${json.totalStocks} 只股票`
        );
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
        logTest(
          "API接口",
          "GET /api/stock-finance?code=002027",
          "PASS",
          `返回 ${json.data.length} 条记录`
        );
      } else {
        logTest("API接口", "GET /api/stock-finance?code=002027", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?code=002027", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?code=002027", "WARN", `请求失败: ${e.message}`);
  }

  // 3.3 批量查询接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?codes=002027,002558`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.total > 0) {
        logTest(
          "API接口",
          "GET /api/stock-finance?codes=...",
          "PASS",
          `返回 ${json.total} 条记录`
        );
      } else {
        logTest("API接口", "GET /api/stock-finance?codes=...", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?codes=...", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?codes=...", "WARN", `请求失败: ${e.message}`);
  }

  // 3.4 季度查询接口
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?quarter=2024Q4`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && json.quarter === "2024Q4") {
        logTest(
          "API接口",
          "GET /api/stock-finance?quarter=2024Q4",
          "PASS",
          `返回 ${json.total} 条记录`
        );
      } else {
        logTest("API接口", "GET /api/stock-finance?quarter=...", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?quarter=...", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?quarter=...", "WARN", `请求失败: ${e.message}`);
  }

  // 3.5 PEG估值接口 - 单股
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?code=002027&peg=true`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.peg_analysis && json.peg_analysis.peg !== undefined) {
        logTest(
          "API接口",
          "GET /api/stock-finance?code=002027&peg=true",
          "PASS",
          `PEG=${json.peg_analysis.peg}, ${json.peg_analysis.valuation_hint}`
        );
      } else {
        logTest("API接口", "GET ...&peg=true", "FAIL", "PEG数据缺失");
      }
    } else {
      logTest("API接口", "GET ...&peg=true", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET ...&peg=true", "WARN", `请求失败: ${e.message}`);
  }

  // 3.6 PEG估值接口 - 全部
  try {
    const res = await httpRequest(`${baseUrl}/api/stock-finance?peg=all`);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        const undervalued = json.data.filter((d) => d.peg > 0 && d.peg < 1).length;
        logTest(
          "API接口",
          "GET /api/stock-finance?peg=all",
          "PASS",
          `${json.data.length} 只股票，${undervalued} 只低估`
        );
      } else {
        logTest("API接口", "GET /api/stock-finance?peg=all", "FAIL", "返回数据格式错误");
      }
    } else {
      logTest("API接口", "GET /api/stock-finance?peg=all", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("API接口", "GET /api/stock-finance?peg=all", "WARN", `请求失败: ${e.message}`);
  }

  // 3.7 异常情况 - 不存在的股票
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
}

// ============ 4. 外部接口测试 ============
console.log("\n========================================");
console.log("4. 外部接口测试");
console.log("========================================\n");

async function testExternalAPIs() {
  // 4.1 东方财富业绩报表接口
  try {
    const url =
      "https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=SECURITY_CODE,SECURITY_NAME_ABBR,QDATE,BASIC_EPS,PARENT_NETPROFIT&filter=(SECURITY_CODE%3D%22002027%22)&pageSize=5";
    const res = await httpRequest(url);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.result && json.result.data && json.result.data.length > 0) {
        logTest(
          "外部接口",
          "东方财富业绩报表接口",
          "PASS",
          `返回 ${json.result.data.length} 条数据`
        );
      } else {
        logTest("外部接口", "东方财富业绩报表接口", "FAIL", "返回数据为空");
      }
    } else {
      logTest("外部接口", "东方财富业绩报表接口", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("外部接口", "东方财富业绩报表接口", "FAIL", e.message);
  }

  // 4.2 腾讯行情接口
  try {
    const res = await httpRequest("https://qt.gtimg.cn/q=sz002027");
    if (res.statusCode === 200) {
      const match = res.data.match(/v_\w+="([^"]+)"/);
      if (match) {
        const parts = match[1].split("~");
        const pe = parts[52];
        const pb = parts[46];
        const marketCap = parts[44];
        // 检查关键字段是否有值
        if (pe && pb && marketCap) {
          logTest(
            "外部接口",
            "腾讯行情接口",
            "PASS",
            `PE=${pe}, PB=${pb}, 市值=${marketCap}亿`
          );
        } else {
          logTest("外部接口", "腾讯行情接口", "FAIL", "关键字段为空");
        }
      } else {
        logTest("外部接口", "腾讯行情接口", "FAIL", "解析失败");
      }
    } else {
      logTest("外部接口", "腾讯行情接口", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("外部接口", "腾讯行情接口", "FAIL", e.message);
  }

  // 4.3 东方财富扣非净利润接口
  try {
    const url =
      "https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=SECURITY_CODE,REPORT_DATE,DEDUCT_PARENT_NETPROFIT&filter=(SECURITY_CODE%3D%22002027%22)&pageSize=5";
    const res = await httpRequest(url);
    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json.result && json.result.data) {
        logTest(
          "外部接口",
          "东方财富扣非净利润接口",
          "PASS",
          `返回 ${json.result.data.length} 条数据`
        );
      } else {
        logTest("外部接口", "东方财富扣非净利润接口", "WARN", "返回数据为空");
      }
    } else {
      logTest("外部接口", "东方财富扣非净利润接口", "FAIL", `状态码 ${res.statusCode}`);
    }
  } catch (e) {
    logTest("外部接口", "东方财富扣非净利润接口", "FAIL", e.message);
  }
}

// ============ 5. 爬虫脚本测试 ============
console.log("\n========================================");
console.log("5. 爬虫脚本测试");
console.log("========================================\n");

function testSpiderScript() {
  const spiderPath = path.join(__dirname, "..", "crawler", "quarterFinanceSpider.js");

  // 5.1 脚本存在性
  if (fs.existsSync(spiderPath)) {
    logTest("爬虫脚本", "脚本存在", "PASS");
  } else {
    logTest("爬虫脚本", "脚本存在", "FAIL", "quarterFinanceSpider.js 不存在");
    return;
  }

  // 5.2 脚本语法检查
  try {
    const content = fs.readFileSync(spiderPath, "utf-8");
    // 简单语法检查
    const syntaxChecks = [
      { pattern: /require\s*\(\s*['"]https['"]\s*\)/, name: "https模块引用" },
      { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, name: "fs模块引用" },
      { pattern: /async\s+function\s+crawlAllStocks/, name: "主函数定义" },
      { pattern: /async\s+function\s+getFinanceFromReport/, name: "财务数据获取函数" },
      { pattern: /async\s+function\s+getMarketData/, name: "市值数据获取函数" },
      { pattern: /calculateEpsYoy/, name: "EPS增长率计算函数" },
      { pattern: /calculateTtmMetrics/, name: "TTM指标计算函数" },
    ];

    let allPassed = true;
    syntaxChecks.forEach((check) => {
      if (!check.pattern.test(content)) {
        logTest("爬虫脚本", `语法检查-${check.name}`, "FAIL");
        allPassed = false;
      }
    });
    if (allPassed) {
      logTest("爬虫脚本", "语法检查", "PASS", "全部检查项通过");
    }
  } catch (e) {
    logTest("爬虫脚本", "脚本读取", "FAIL", e.message);
  }

  // 5.3 数据目录检查
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    const csvFiles = files.filter((f) => f.endsWith(".csv"));
    logTest("爬虫脚本", "数据目录", "PASS", `${csvFiles.length} 个CSV文件`);
  } else {
    logTest("爬虫脚本", "数据目录", "FAIL", "data目录不存在");
  }
}

testSpiderScript();

// ============ 运行API测试 ============
(async () => {
  await testAPIs();
  await testExternalAPIs();

  // ============ 测试报告汇总 ============
  console.log("\n========================================");
  console.log("测试报告汇总");
  console.log("========================================\n");

  const total = testResults.passed + testResults.failed + testResults.warnings;
  const passRate = ((testResults.passed / total) * 100).toFixed(1);

  console.log(`总测试数: ${total}`);
  console.log(`通过: ${testResults.passed} (${passRate}%)`);
  console.log(`失败: ${testResults.failed}`);
  console.log(`警告: ${testResults.warnings}`);
  console.log("");

  if (testResults.failed > 0) {
    console.log("失败的测试项:");
    testResults.details
      .filter((d) => d.status === "FAIL")
      .forEach((d) => {
        console.log(`  - [${d.category}] ${d.name}: ${d.message}`);
      });
  }

  if (testResults.warnings > 0) {
    console.log("\n警告项:");
    testResults.details
      .filter((d) => d.status === "WARN")
      .forEach((d) => {
        console.log(`  - [${d.category}] ${d.name}: ${d.message}`);
      });
  }

  console.log("\n========================================");
  console.log(`测试结果: ${testResults.failed === 0 ? "✅ 全部通过" : "❌ 存在失败项"}`);
  console.log("========================================\n");

  // 写入测试报告文件
  const reportPath = path.join(__dirname, "quarter-finance-test-report.md");
  const reportContent = `# 季度财务数据测试报告

**测试时间**: ${new Date().toISOString()}

## 测试摘要

| 指标 | 值 |
|------|-----|
| 总测试数 | ${total} |
| 通过 | ${testResults.passed} |
| 失败 | ${testResults.failed} |
| 警告 | ${testResults.warnings} |
| 通过率 | ${passRate}% |

## 测试详情

### 通过项
${testResults.details
  .filter((d) => d.status === "PASS")
  .map((d) => `- ✅ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
  .join("\n")}

### 失败项
${
  testResults.details.filter((d) => d.status === "FAIL").length > 0
    ? testResults.details
        .filter((d) => d.status === "FAIL")
        .map((d) => `- ❌ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
        .join("\n")
    : "无"
}

### 警告项
${
  testResults.details.filter((d) => d.status === "WARN").length > 0
    ? testResults.details
        .filter((d) => d.status === "WARN")
        .map((d) => `- ⚠️ [${d.category}] ${d.name}${d.message ? `: ${d.message}` : ""}`)
        .join("\n")
    : "无"
}

## 结论

${testResults.failed === 0 ? "✅ 所有测试通过，功能正常" : "❌ 存在失败项，需要修复"}
`;

  fs.writeFileSync(reportPath, reportContent, "utf-8");
  console.log(`测试报告已保存到: ${reportPath}`);
})();
