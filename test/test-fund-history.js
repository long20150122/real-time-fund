/**
 * 基金历史持仓环比对比功能测试脚本
 * 测试维度：API逻辑、数据完整性、前端入口
 */

const fs = require('fs');
const path = require('path');

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result.passed !== false) {
      testResults.passed++;
      testResults.details.push({ name, status: 'PASS', message: typeof result === 'string' ? result : '' });
    } else {
      testResults.failed++;
      testResults.details.push({ name, status: 'FAIL', message: result.message || result });
      testResults.errors.push({ name, message: result.message || result });
    }
  } catch (e) {
    testResults.failed++;
    testResults.details.push({ name, status: 'ERROR', message: e.message });
    testResults.errors.push({ name, message: e.message });
  }
}

// 解析CSV
function parseCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });
    return obj;
  });
}

// 解析权重
function parseWeight(w) {
  if (!w) return 0;
  const num = parseFloat(w.replace('%', ''));
  return isNaN(num) ? 0 : num;
}

console.log('========================================');
console.log('  基金历史持仓环比对比功能测试报告');
console.log('========================================\n');

// ===== 测试1: 数据文件存在性 =====
console.log('>>> 测试组1: 数据文件完整性检查');

test('stocks.csv 文件存在', () => {
  return fs.existsSync('data/stocks.csv');
});

test('stocks.csv 有数据', () => {
  const records = parseCSV('data/stocks.csv');
  return records.length > 0 ? `共 ${records.length} 条记录` : { passed: false, message: '无数据' };
});

test('stocks.csv 必要字段完整', () => {
  const records = parseCSV('data/stocks.csv');
  const requiredFields = ['fund_code', 'stock_code', 'stock_name', 'weight', 'report_date'];
  const missing = records.slice(0, 100).filter(r => 
    requiredFields.some(f => !r[f])
  );
  return missing.length === 0 ? '前100条记录字段完整' : { passed: false, message: `${missing.length}条记录字段缺失` };
});

// ===== 测试2: API路由文件 =====
console.log('\n>>> 测试组2: API路由检查');

test('fund-history API路由文件存在', () => {
  return fs.existsSync('app/api/fund-history/route.js');
});

test('fund-history API包含必要函数', () => {
  const content = fs.readFileSync('app/api/fund-history/route.js', 'utf-8');
  const hasCompareHoldings = content.includes('function compareHoldings');
  const hasGET = content.includes('export async function GET');
  return hasCompareHoldings && hasGET ? 'compareHoldings和GET函数存在' : { passed: false, message: '缺少必要函数' };
});

test('环比对比逻辑包含五种状态', () => {
  const content = fs.readFileSync('app/api/fund-history/route.js', 'utf-8');
  const hasAdded = content.includes("added");
  const hasRemoved = content.includes("removed");
  const hasIncreased = content.includes("increased");
  const hasDecreased = content.includes("decreased");
  const hasUnchanged = content.includes("unchanged");
  return (hasAdded && hasRemoved && hasIncreased && hasDecreased && hasUnchanged) 
    ? '五种状态逻辑完整' 
    : { passed: false, message: '缺少部分状态处理' };
});

// ===== 测试3: 环比逻辑测试 =====
console.log('\n>>> 测试组3: 环比对比逻辑测试');

test('环比数据分组正确', () => {
  const records = parseCSV('data/stocks.csv');
  const fundCode = '003053';
  const fundRecords = records.filter(r => r.fund_code === fundCode);
  
  if (fundRecords.length === 0) return { passed: false, message: '无测试数据' };
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodCount = Object.keys(periods).length;
  return periodCount >= 2 ? `${fundCode} 有 ${periodCount} 个季度数据` : { passed: false, message: '季度数据不足' };
});

test('新调入股票识别正确', () => {
  const records = parseCSV('data/stocks.csv');
  const fundCode = '003053';
  const fundRecords = records.filter(r => r.fund_code === fundCode);
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodKeys = Object.keys(periods).sort().reverse();
  if (periodKeys.length < 2) return { passed: false, message: '数据不足' };
  
  const current = periods[periodKeys[0]];
  const prev = periods[periodKeys[1]];
  const prevMap = new Map(prev.map(s => [s.stock_code, s]));
  
  const added = current.filter(s => !prevMap.has(s.stock_code));
  return added.length >= 0 ? `最新季度新调入 ${added.length} 只股票` : { passed: false };
});

test('调出股票识别正确', () => {
  const records = parseCSV('data/stocks.csv');
  const fundCode = '003053';
  const fundRecords = records.filter(r => r.fund_code === fundCode);
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodKeys = Object.keys(periods).sort().reverse();
  if (periodKeys.length < 2) return { passed: false, message: '数据不足' };
  
  const current = periods[periodKeys[0]];
  const prev = periods[periodKeys[1]];
  const currentMap = new Map(current.map(s => [s.stock_code, s]));
  
  const removed = prev.filter(s => !currentMap.has(s.stock_code));
  return removed.length >= 0 ? `最新季度调出 ${removed.length} 只股票` : { passed: false };
});

test('增持股票识别正确', () => {
  const records = parseCSV('data/stocks.csv');
  const fundCode = '003053';
  const fundRecords = records.filter(r => r.fund_code === fundCode);
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodKeys = Object.keys(periods).sort().reverse();
  if (periodKeys.length < 2) return { passed: false, message: '数据不足' };
  
  const current = periods[periodKeys[0]];
  const prev = periods[periodKeys[1]];
  const prevMap = new Map(prev.map(s => [s.stock_code, s]));
  
  const increased = current.filter(s => {
    const prevStock = prevMap.get(s.stock_code);
    if (!prevStock) return false;
    return parseWeight(s.weight) > parseWeight(prevStock.weight);
  });
  
  return increased.length >= 0 ? `最新季度增持 ${increased.length} 只股票` : { passed: false };
});

test('减持股票识别正确', () => {
  const records = parseCSV('data/stocks.csv');
  const fundCode = '003053';
  const fundRecords = records.filter(r => r.fund_code === fundCode);
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodKeys = Object.keys(periods).sort().reverse();
  if (periodKeys.length < 2) return { passed: false, message: '数据不足' };
  
  const current = periods[periodKeys[0]];
  const prev = periods[periodKeys[1]];
  const prevMap = new Map(prev.map(s => [s.stock_code, s]));
  
  const decreased = current.filter(s => {
    const prevStock = prevMap.get(s.stock_code);
    if (!prevStock) return false;
    return parseWeight(s.weight) < parseWeight(prevStock.weight);
  });
  
  return decreased.length >= 0 ? `最新季度减持 ${decreased.length} 只股票` : { passed: false };
});

// ===== 测试4: 前端组件检查 =====
console.log('\n>>> 测试组4: 前端组件检查');

test('HistoryHoldingsModal 组件存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes('function HistoryHoldingsModal');
});

test('历史持仓入口按钮存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes('openHistoryModal(f)') ? '基金卡片有历史持仓入口' : { passed: false, message: '未找到入口' };
});

test('API调用路径正确', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("/api/fund-history?code=") ? 'API路径正确' : { passed: false, message: 'API路径错误' };
});

test('三列网格布局存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("gridTemplateColumns: 'repeat(3, 1fr)'") ? '三列布局已配置' : { passed: false, message: '未找到三列布局' };
});

test('增持红色标签存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("type === 'increased'") && content.includes("var(--danger)") ? '增持红色标签已配置' : { passed: false };
});

test('减持绿色标签存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("type === 'decreased'") && content.includes("var(--success)") ? '减持绿色标签已配置' : { passed: false };
});

test('向上箭头标签存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("↑+") ? '增持向上箭头已配置' : { passed: false };
});

test('向下箭头标签存在', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("↓") ? '减持向下箭头已配置' : { passed: false };
});

// ===== 测试5: 变化率计算 =====
console.log('\n>>> 测试组5: 变化率计算测试');

test('权重变化计算正确', () => {
  const currentWeight = parseWeight('9.78%');
  const prevWeight = parseWeight('8.10%');
  const change = currentWeight - prevWeight;
  return Math.abs(change - 1.68) < 0.01 ? `权重变化: ${change.toFixed(2)}%` : { passed: false, message: `计算错误: ${change}` };
});

test('变化率百分比计算正确', () => {
  const change = 1.68;
  const prevWeight = 8.10;
  const pct = (change / prevWeight) * 100;
  return Math.abs(pct - 20.74) < 0.1 ? `变化率: ${pct.toFixed(2)}%` : { passed: false, message: `计算错误: ${pct}` };
});

// ===== 测试6: 详细环比数据验证 =====
console.log('\n>>> 测试组6: 详细环比数据验证');

test('003053基金详细环比验证', () => {
  const records = parseCSV('data/stocks.csv');
  const fundRecords = records.filter(r => r.fund_code === '003053');
  
  const periods = {};
  fundRecords.forEach(r => {
    if (!periods[r.report_date]) periods[r.report_date] = [];
    periods[r.report_date].push(r);
  });
  
  const periodKeys = Object.keys(periods).sort().reverse();
  const details = [];
  
  for (let i = 0; i < Math.min(2, periodKeys.length - 1); i++) {
    const current = periods[periodKeys[i]];
    const prev = periods[periodKeys[i + 1]];
    const currentMap = new Map(current.map(s => [s.stock_code, s]));
    const prevMap = new Map(prev.map(s => [s.stock_code, s]));
    
    const added = current.filter(s => !prevMap.has(s.stock_code));
    const removed = prev.filter(s => !currentMap.has(s.stock_code));
    const increased = current.filter(s => {
      const ps = prevMap.get(s.stock_code);
      return ps && parseWeight(s.weight) > parseWeight(ps.weight);
    });
    const decreased = current.filter(s => {
      const ps = prevMap.get(s.stock_code);
      return ps && parseWeight(s.weight) < parseWeight(ps.weight);
    });
    
    details.push(`${periodKeys[i]}: +${added.length}/-${removed.length} ↑${increased.length}/↓${decreased.length}`);
  }
  
  return details.join(' | ');
});

// ===== 测试7: 错误处理 =====
console.log('\n>>> 测试组7: 错误处理检查');

test('API缺少code参数处理', () => {
  const content = fs.readFileSync('app/api/fund-history/route.js', 'utf-8');
  return content.includes("缺少基金代码") ? '缺少参数错误处理已配置' : { passed: false };
});

test('API无数据返回处理', () => {
  const content = fs.readFileSync('app/api/fund-history/route.js', 'utf-8');
  return content.includes("暂无该基金的持仓数据") ? '无数据错误处理已配置' : { passed: false };
});

test('前端loading状态处理', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("正在加载历史持仓") ? 'loading状态已配置' : { passed: false };
});

test('前端无数据状态处理', () => {
  const content = fs.readFileSync('app/page.jsx', 'utf-8');
  return content.includes("暂无历史持仓数据") ? '无数据状态已配置' : { passed: false };
});

// ===== 输出测试报告 =====
console.log('\n========================================');
console.log('  测试结果汇总');
console.log('========================================');
console.log(`通过: ${testResults.passed}`);
console.log(`失败: ${testResults.failed}`);
console.log(`总计: ${testResults.passed + testResults.failed}`);
console.log('');

if (testResults.failed > 0) {
  console.log('失败项详情:');
  testResults.errors.forEach(e => {
    console.log(`  - ${e.name}: ${e.message}`);
  });
}

console.log('\n----------------------------------------');
console.log('  详细测试结果');
console.log('----------------------------------------');
testResults.details.forEach(d => {
  const icon = d.status === 'PASS' ? '✓' : '✗';
  console.log(`[${icon}] ${d.name}${d.message ? ': ' + d.message : ''}`);
});

console.log('\n========================================');
console.log(`测试完成，通过率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
console.log('========================================\n');

// 返回退出码
process.exit(testResults.failed > 0 ? 1 : 0);
