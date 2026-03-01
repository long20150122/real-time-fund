/**
 * API模拟测试 - 完整模拟 fund-history API 逻辑
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');

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

function readHoldings() {
  let content = fs.readFileSync(STOCKS_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function parseWeight(w) {
  if (!w) return 0;
  const num = parseFloat(w.replace('%', ''));
  return isNaN(num) ? 0 : num;
}

function compareHoldings(currentPeriod, prevPeriod) {
  const currentMap = new Map();
  const prevMap = new Map();
  currentPeriod.stocks.forEach(s => currentMap.set(s.stock_code, s));
  prevPeriod.stocks.forEach(s => prevMap.set(s.stock_code, s));

  const added = [], removed = [], increased = [], decreased = [], unchanged = [];
  
  currentPeriod.stocks.forEach(stock => {
    const prevStock = prevMap.get(stock.stock_code);
    const currentWeight = parseWeight(stock.weight);
    if (!prevStock) {
      added.push({ ...stock, current_weight: currentWeight, prev_weight: 0, weight_change: currentWeight });
    } else {
      const prevWeight = parseWeight(prevStock.weight);
      const weightChange = currentWeight - prevWeight;
      if (Math.abs(weightChange) < 0.01) {
        unchanged.push({ ...stock, current_weight: currentWeight, prev_weight: prevWeight, weight_change: 0 });
      } else if (weightChange > 0) {
        increased.push({ ...stock, current_weight: currentWeight, prev_weight: prevWeight, weight_change: weightChange });
      } else {
        decreased.push({ ...stock, current_weight: currentWeight, prev_weight: prevWeight, weight_change: weightChange });
      }
    }
  });
  
  prevPeriod.stocks.forEach(stock => {
    if (!currentMap.has(stock.stock_code)) {
      const prevWeight = parseWeight(stock.weight);
      removed.push({ ...stock, current_weight: 0, prev_weight: prevWeight, weight_change: -prevWeight });
    }
  });

  return { added, removed, increased, decreased, unchanged };
}

// 测试所有基金
const allHoldings = readHoldings();
const fundCodes = [...new Set(allHoldings.map(h => h.fund_code))];

console.log('========================================');
console.log('  基金历史持仓环比对比 - API模拟测试');
console.log('========================================\n');

fundCodes.forEach(code => {
  const fundHoldings = allHoldings.filter(h => h.fund_code === code);
  
  const periodsMap = new Map();
  fundHoldings.forEach(holding => {
    const reportDate = holding.report_date;
    if (!periodsMap.has(reportDate)) {
      periodsMap.set(reportDate, { report_date: reportDate, stocks: [] });
    }
    periodsMap.get(reportDate).stocks.push({
      stock_code: holding.stock_code,
      stock_name: holding.stock_name,
      weight: holding.weight,
      ratio: parseFloat(holding.weight) || 0
    });
  });

  const periods = Array.from(periodsMap.values())
    .sort((a, b) => new Date(b.report_date) - new Date(a.report_date));

  for (let i = 0; i < periods.length - 1; i++) {
    const comparison = compareHoldings(periods[i], periods[i + 1]);
    periods[i].comparison = comparison;
  }

  console.log('=== 基金: ' + code + ' ===');
  console.log('季度数: ' + periods.length);
  
  if (periods.length > 0 && periods[0].comparison) {
    const latest = periods[0];
    const c = latest.comparison;
    console.log('\n最新季度 ' + latest.report_date + ' 环比分析:');
    console.log('  新调入(' + c.added.length + '只): ' + c.added.map(s => s.stock_name).join(', '));
    console.log('  调出(' + c.removed.length + '只): ' + c.removed.map(s => s.stock_name).join(', '));
    console.log('  增持(' + c.increased.length + '只):');
    c.increased.forEach(s => {
      console.log('    - ' + s.stock_name + ': ' + s.prev_weight.toFixed(1) + '% → ' + s.current_weight.toFixed(1) + '% (↑+' + s.weight_change.toFixed(2) + '%)');
    });
    console.log('  减持(' + c.decreased.length + '只):');
    c.decreased.forEach(s => {
      console.log('    - ' + s.stock_name + ': ' + s.prev_weight.toFixed(1) + '% → ' + s.current_weight.toFixed(1) + '% (↓' + s.weight_change.toFixed(2) + '%)');
    });
    console.log('  不变(' + c.unchanged.length + '只): ' + c.unchanged.map(s => s.stock_name).join(', '));
  }
  console.log('\n');
});

console.log('========================================');
console.log('  API模拟测试完成');
console.log('========================================');
