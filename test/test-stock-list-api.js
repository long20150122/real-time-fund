/**
 * 股票列表 API 测试脚本
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

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

function readCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
    return obj;
  });
}

console.log('========================================');
console.log('  股票列表 API 测试');
console.log('========================================\n');

const holdings = readCSV(STOCKS_FILE);
const stockHistory = readCSV(STOCK_HISTORY_FILE);

console.log('持仓记录数:', holdings.length);
console.log('股票历史记录数:', stockHistory.length);

// 获取最新报告期
const reportDates = [...new Set(holdings.map(h => h.report_date))].sort().reverse();
console.log('\n报告期列表:', reportDates.slice(0, 5).join(', '));

// 筛选最新报告期
const latestDate = reportDates[0];
const latestHoldings = holdings.filter(h => h.report_date === latestDate);
console.log('最新报告期(' + latestDate + ')持仓数:', latestHoldings.length);

// 统计股票
const stockMap = new Map();
latestHoldings.forEach(h => {
  if (!stockMap.has(h.stock_code)) {
    stockMap.set(h.stock_code, { code: h.stock_code, name: h.stock_name, funds: [] });
  }
  stockMap.get(h.stock_code).funds.push(h.fund_code);
});

console.log('\n唯一股票数:', stockMap.size);

// 按持有基金数排序
const sorted = [...stockMap.values()].sort((a, b) => b.funds.length - a.funds.length);
console.log('\n持有基金数最多的5只股票:');
sorted.slice(0, 5).forEach(s => {
  console.log('  ' + s.name + '(' + s.code + '): ' + s.funds.length + '只基金');
});

// 检查股票历史数据
const historyByCode = new Map();
stockHistory.forEach(h => {
  if (!historyByCode.has(h.stock_code)) historyByCode.set(h.stock_code, []);
  historyByCode.get(h.stock_code).push(h);
});

const stockWithData = [...stockMap.keys()].filter(code => historyByCode.has(code));
console.log('\n有历史数据的股票数:', stockWithData.length + '/' + stockMap.size);

// 测试连续涨跌计算
function calculateConsecutiveDays(history) {
  if (!history || history.length < 2) return { upDays: 0, downDays: 0 };
  const sorted = [...history].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  let upDays = 0, downDays = 0;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = parseFloat(sorted[i].close);
    const prev = parseFloat(sorted[i + 1].close);
    if (i === 0) {
      if (current > prev) upDays = 1;
      else if (current < prev) downDays = 1;
    } else {
      if (upDays > 0 && current > prev) upDays++;
      else if (downDays > 0 && current < prev) downDays++;
      else break;
    }
  }
  return { upDays, downDays };
}

// 测试第一只股票的连续涨跌
const firstStockCode = sorted[0].code;
const firstStockHistory = historyByCode.get(firstStockCode) || [];
const { upDays, downDays } = calculateConsecutiveDays(firstStockHistory);
console.log('\n' + sorted[0].name + ' 连续涨跌:');
console.log('  连涨天数:', upDays);
console.log('  连跌天数:', downDays);

console.log('\n========================================');
console.log('测试完成');
console.log('========================================');
