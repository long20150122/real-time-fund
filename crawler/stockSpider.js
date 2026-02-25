/**
 * 基金持仓爬虫脚本
 * 用于爬取天天基金的基金前十大持仓和历史持仓数据
 * 
 * 使用方法:
 * node crawler/stockSpider.js <基金代码>
 * node crawler/stockSpider.js 003053
 * node crawler/stockSpider.js --all
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// CSV 文件路径
const DATA_DIR = path.join(__dirname, '..', 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');
const FUNDS_FILE = path.join(DATA_DIR, 'funds.csv');

// 请求头
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://fundf10.eastmoney.com/',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/**
 * HTTP GET 请求封装
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 解析 HTML 中的 JSON 数据内容
 */
function parseJsonContent(html) {
  // 匹配 var apidata={ content:"..." }
  const jsonMatch = html.match(/var apidata=\s*({[\s\S]*?});?\s*$/);
  if (jsonMatch) {
    try {
      const json = jsonMatch[1];
      // 提取 content 字段
      const contentMatch = json.match(/content:"([^"]*(?:\\.[^"]*)*)"/);
      if (contentMatch) {
        // 解码转义字符
        let content = contentMatch[1]
          .replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        return content;
      }
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }
  }
  return html;
}

/**
 * 解析单个持仓表格
 */
function parseHoldingsTable(tableHtml) {
  const holdings = [];
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return holdings;
  
  // 从表头确定占比列的位置
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  let weightColIndex = 4; // 默认第5列（2024及更早的格式）
  
  if (theadMatch) {
    const headers = theadMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
    headers.forEach((h, i) => {
      const text = h.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
      if (text.includes('占净值比例') || text.includes('占净值')) {
        weightColIndex = i;
      }
    });
  }
  
  const rows = tbodyMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (cells.length >= 5) {
      // 第2列: 股票代码
      const code = cells[1].replace(/<[^>]+>/g, '').trim();
      // 第3列: 股票名称
      const name = cells[2].replace(/<[^>]+>/g, '').trim();
      // 占比列（动态确定）
      const weightCell = cells[weightColIndex] ? cells[weightColIndex].replace(/<[^>]+>/g, '').trim() : '';
      const weightMatch = weightCell.match(/([\d.]+)%/);
      const weight = weightMatch ? weightMatch[1] + '%' : '';
      
      // 验证股票代码格式 (5-6位数字)
      if (code && name && /^\d{5,6}$/.test(code)) {
        holdings.push({ stockCode: code, stockName: name, weight });
      }
    }
  }
  
  return holdings.slice(0, 10); // 只取前10大
}

/**
 * 获取指定年份的所有季度持仓数据
 * @param {string} fundCode 基金代码
 * @param {string} year 年份 (如 "2024"，空字符串表示最新年份)
 * @returns {Promise<Array>} 持仓数据列表
 */
async function getYearHoldings(fundCode, year) {
  const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${fundCode}&topline=10&year=${year}&month=`;
  
  try {
    const html = await httpGet(url);
    const content = parseJsonContent(html);
    
    // 按季度标题分割 - 匹配格式: <h4 class='t'>...2024年4季度股票投资明细...</h4>...<table>...</table>
    const quarterPattern = /<h4[^>]*class='t'[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<table[^>]*class='[^']*comm[^']*'[^>]*>([\s\S]*?)<\/table>/gi;
    
    const results = [];
    let match;
    
    while ((match = quarterPattern.exec(content)) !== null) {
      const header = match[1];
      const tableContent = match[2];
      
      // 提取季度标题
      const quarterMatch = header.match(/(\d{4})年(\d)季度/);
      if (!quarterMatch) continue;
      
      const year = quarterMatch[1];
      const quarter = quarterMatch[2];
      
      // 提取截止日期
      const dateMatch = header.match(/截止至[：:]\s*<[^>]*>(\d{4}-\d{2}-\d{2})/);
      const reportDate = dateMatch ? dateMatch[1] : `${year}-${String(quarter * 3).padStart(2, '0')}-31`;
      
      // 解析持仓
      const fullTable = `<table>${tableContent}</table>`;
      const holdings = parseHoldingsTable(fullTable);
      
      if (holdings.length > 0) {
        results.push({
          year,
          quarter,
          reportDate,
          holdings
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error(`获取持仓数据失败 (${fundCode} - ${year}):`, error.message);
    return [];
  }
}

/**
 * 获取可用的年份列表
 * @param {string} fundCode 基金代码
 * @returns {Promise<Array<string>>} 年份列表
 */
async function getAvailableYears(fundCode) {
  const currentYear = new Date().getFullYear();
  const years = [];
  const startYear = 2022; // 从2022年开始累加
  
  // 检查从2022年到当前年的数据
  for (let year = currentYear; year >= startYear; year--) {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${fundCode}&topline=10&year=${year}&month=`;
    const html = await httpGet(url);
    const content = parseJsonContent(html);
    
    // 检查是否有该年的数据
    const quarterMatches = content.match(/\d{4}年\d季度股票投资明细/g) || [];
    const yearData = [...new Set(quarterMatches.map(m => m.match(/(\d{4})年/)[1]))];
    
    if (yearData.includes(String(year))) {
      years.push(String(year));
    }
    
    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return years.sort((a, b) => b - a); // 降序排列
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 读取现有持仓数据
 */
function readStocks() {
  if (!fs.existsSync(STOCKS_FILE)) {
    return [];
  }
  const content = fs.readFileSync(STOCKS_FILE, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(',');
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 写入持仓数据
 */
function writeStocks(stocks) {
  const headers = ['id', 'fund_code', 'stock_code', 'stock_name', 'weight', 'report_date', 'created_at'];
  const headerLine = headers.join(',');
  const lines = [headerLine, ...stocks.map(s => {
    return headers.map(h => {
      const val = s[h] ?? '';
      if (String(val).includes(',') || String(val).includes('"')) {
        return `"${String(val).replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  })];
  
  // UTF-8 BOM 标记，确保 Windows 下正确识别编码
  const BOM = '\uFEFF';
  fs.writeFileSync(STOCKS_FILE, BOM + lines.join('\n') + '\n', 'utf-8');
}

/**
 * 保存持仓数据
 */
function saveHoldings(fundCode, holdings, reportDate) {
  const existingStocks = readStocks();
  const now = new Date().toISOString();
  
  // 删除该基金该报告期的旧数据
  const filteredStocks = existingStocks.filter(s => 
    !(s.fund_code === fundCode && s.report_date === reportDate)
  );
  
  // 添加新数据
  const newStocks = holdings.map(h => ({
    id: generateId(),
    fund_code: fundCode,
    stock_code: h.stockCode,
    stock_name: h.stockName,
    weight: h.weight,
    report_date: reportDate,
    created_at: now
  }));
  
  writeStocks([...filteredStocks, ...newStocks]);
  console.log(`  已保存 ${fundCode} ${reportDate} 的 ${newStocks.length} 条持仓数据`);
  
  return newStocks;
}

/**
 * 爬取单个基金的所有历史持仓（最近3年/12个季度）
 * @param {string} fundCode 基金代码
 * @param {number} maxQuarters 最大季度数，默认12（3年）
 */
async function crawlFundHoldings(fundCode, maxQuarters = 12) {
  console.log(`\n开始爬取基金 ${fundCode} 的历史持仓...`);
  
  // 获取可用年份
  const years = await getAvailableYears(fundCode);
  
  if (years.length === 0) {
    console.log('未找到任何历史持仓数据');
    return;
  }
  
  console.log(`找到 ${years.length} 个年份的数据: ${years.join(', ')}`);
  
  let totalQuarters = 0;
  
  for (const year of years) {
    if (totalQuarters >= maxQuarters) break;
    
    console.log(`\n正在爬取 ${year} 年数据...`);
    
    const yearData = await getYearHoldings(fundCode, year);
    
    for (const quarter of yearData) {
      if (totalQuarters >= maxQuarters) break;
      
      console.log(`  ${quarter.year}年${quarter.quarter}季度 (${quarter.reportDate}): ${quarter.holdings.length} 条`);
      
      if (quarter.holdings.length > 0) {
        saveHoldings(fundCode, quarter.holdings, quarter.reportDate);
        totalQuarters++;
      }
    }
    
    // 年份间延迟
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n基金 ${fundCode} 爬取完成! 共 ${totalQuarters} 个季度`);
}

/**
 * 从 funds.csv 获取所有基金代码
 */
function getAllFundCodes() {
  if (!fs.existsSync(FUNDS_FILE)) {
    return [];
  }
  let content = fs.readFileSync(FUNDS_FILE, 'utf-8');
  // 移除 UTF-8 BOM 标记（如果存在）
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(',');
  const codeIndex = headers.indexOf('code');
  
  if (codeIndex === -1) return [];
  
  const codes = new Set();
  lines.slice(1).forEach(line => {
    const values = parseCSVRow(line);
    if (values[codeIndex]) {
      codes.add(values[codeIndex]);
    }
  });
  
  return Array.from(codes);
}

/**
 * 爬取所有基金的历史持仓
 */
async function crawlAllFunds(maxQuarters = 12) {
  console.log('开始爬取所有基金的历史持仓...\n');
  
  const fundCodes = getAllFundCodes();
  
  if (fundCodes.length === 0) {
    console.log('未找到任何基金代码，请先在 funds.csv 中添加基金');
    return;
  }
  
  console.log(`找到 ${fundCodes.length} 只基金\n`);
  
  for (const code of fundCodes) {
    await crawlFundHoldings(code, maxQuarters);
    // 基金间延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n所有基金爬取完成!');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
使用方法:
  node crawler/stockSpider.js <基金代码>     爬取单个基金
  node crawler/stockSpider.js --all          爬取所有基金
  node crawler/stockSpider.js 003053         爬取基金 003053

示例:
  node crawler/stockSpider.js 110011
  node crawler/stockSpider.js --all
    `);
    return;
  }
  
  // 确保 data 目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // 确保 stocks.csv 存在 (UTF-8 with BOM)
  if (!fs.existsSync(STOCKS_FILE)) {
    fs.writeFileSync(STOCKS_FILE, '\uFEFFid,fund_code,stock_code,stock_name,weight,report_date,created_at\n', 'utf-8');
  }
  
  if (args[0] === '--all') {
    await crawlAllFunds();
  } else {
    const fundCode = args[0];
    await crawlFundHoldings(fundCode);
  }
}

main().catch(console.error);
