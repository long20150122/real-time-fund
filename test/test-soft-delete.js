/**
 * 软删除机制测试脚本
 * 测试内容：
 * 1. 数据结构扩展字段验证
 * 2. 删除基金时持仓软删除
 * 3. stock-list API 历史持仓展示
 * 4. 前端入口可用性
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');
const FUNDS_FILE = path.join(DATA_DIR, 'funds.csv');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(type, msg) {
  const icons = { pass: '✓', fail: '✗', info: '→', test: '◆' };
  const colorMap = { pass: colors.green, fail: colors.red, info: colors.cyan, test: colors.yellow };
  console.log(`${colorMap[type]}${icons[type]} ${msg}${colors.reset}`);
}

function parseCSV(content) {
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return { headers: [], rows: [] };
  
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = lines[0].split(',');
  const rows = lines.slice(1).filter(l => l.trim()).map(parseRow);
  return { headers, rows };
}

// 测试用例
const testCases = [];

// ========== 测试1: stocks.csv 扩展字段 ==========
testCases.push({
  id: 'TC-001',
  name: 'stocks.csv 扩展字段验证',
  category: '数据结构',
  run: () => {
    if (!fs.existsSync(STOCKS_FILE)) {
      return { pass: false, message: 'stocks.csv 文件不存在' };
    }
    
    const content = fs.readFileSync(STOCKS_FILE, 'utf-8');
    const { headers } = parseCSV(content);
    
    const requiredFields = ['fund_deleted_at', 'extra_data'];
    const missing = requiredFields.filter(f => !headers.includes(f));
    
    if (missing.length > 0) {
      return { pass: false, message: `缺少扩展字段: ${missing.join(', ')}` };
    }
    
    return { pass: true, message: `扩展字段完整: ${headers.join(', ')}` };
  }
});

// ========== 测试2: funds.csv 扩展字段 ==========
testCases.push({
  id: 'TC-002',
  name: 'funds.csv 扩展字段验证',
  category: '数据结构',
  run: () => {
    if (!fs.existsSync(FUNDS_FILE)) {
      return { pass: false, message: 'funds.csv 文件不存在' };
    }
    
    const content = fs.readFileSync(FUNDS_FILE, 'utf-8');
    const { headers } = parseCSV(content);
    
    const requiredFields = ['is_deleted', 'deleted_at', 'extra_data'];
    const missing = requiredFields.filter(f => !headers.includes(f));
    
    if (missing.length > 0) {
      return { pass: false, message: `缺少扩展字段: ${missing.join(', ')}` };
    }
    
    return { pass: true, message: `扩展字段完整: ${headers.join(', ')}` };
  }
});

// ========== 测试3: stock-realtime API 缓存配置 ==========
testCases.push({
  id: 'TC-003',
  name: 'stock-realtime API 缓存配置验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/stock-realtime/route.js');
    if (!fs.existsSync(routePath)) {
      return { pass: false, message: 'stock-realtime/route.js 文件不存在' };
    }
    
    const content = fs.readFileSync(routePath, 'utf-8');
    
    // 检查是否移除了固定缓存
    if (content.includes("revalidate: 60") || content.includes("revalidate:60")) {
      return { pass: false, message: '仍使用固定60秒缓存，未移除' };
    }
    
    // 检查是否使用 no-store
    if (content.includes("cache: 'no-store'")) {
      return { pass: true, message: "已正确配置 cache: 'no-store'" };
    }
    
    return { pass: false, message: '未找到正确的缓存配置' };
  }
});

// ========== 测试4: stocks DELETE 软删除逻辑 ==========
testCases.push({
  id: 'TC-004',
  name: 'stocks DELETE 软删除逻辑验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/stocks/route.js');
    if (!fs.existsSync(routePath)) {
      return { pass: false, message: 'stocks/route.js 文件不存在' };
    }
    
    const content = fs.readFileSync(routePath, 'utf-8');
    
    const checks = [
      { pattern: /mode.*soft.*hard/, msg: '支持 mode 参数' },
      { pattern: /fund_deleted_at/, msg: '包含 fund_deleted_at 字段操作' },
      { pattern: /soft.*delete|软删除/, msg: '包含软删除逻辑' }
    ];
    
    const failed = checks.filter(c => !c.pattern.test(content));
    
    if (failed.length > 0) {
      return { pass: false, message: `缺少: ${failed.map(c => c.msg).join(', ')}` };
    }
    
    return { pass: true, message: '软删除逻辑完整' };
  }
});

// ========== 测试5: funds DELETE 调用持仓软删除 ==========
testCases.push({
  id: 'TC-005',
  name: 'funds DELETE 调用持仓软删除验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/funds/route.js');
    if (!fs.existsSync(routePath)) {
      return { pass: false, message: 'funds/route.js 文件不存在' };
    }
    
    const content = fs.readFileSync(routePath, 'utf-8');
    
    if (!content.includes('/api/stocks')) {
      return { pass: false, message: '未调用 /api/stocks 进行软删除' };
    }
    
    if (!content.includes('method: \'DELETE\'')) {
      return { pass: false, message: '未正确调用 DELETE 方法' };
    }
    
    return { pass: true, message: '正确调用持仓软删除接口' };
  }
});

// ========== 测试6: sync DELETE 调用持仓软删除 ==========
testCases.push({
  id: 'TC-006',
  name: 'sync DELETE 调用持仓软删除验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/sync/route.js');
    if (!fs.existsSync(routePath)) {
      return { pass: false, message: 'sync/route.js 文件不存在' };
    }
    
    const content = fs.readFileSync(routePath, 'utf-8');
    
    if (!content.includes('/api/stocks')) {
      return { pass: false, message: '未调用 /api/stocks 进行软删除' };
    }
    
    return { pass: true, message: '正确调用持仓软删除接口' };
  }
});

// ========== 测试7: stock-list API 历史持仓逻辑 ==========
testCases.push({
  id: 'TC-007',
  name: 'stock-list API 历史持仓逻辑验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/stock-list/route.js');
    if (!fs.existsSync(routePath)) {
      return { pass: false, message: 'stock-list/route.js 文件不存在' };
    }
    
    const content = fs.readFileSync(routePath, 'utf-8');
    
    const checks = [
      { pattern: /historicalFunds/, msg: 'historicalFunds 字段' },
      { pattern: /is_historical/, msg: 'is_historical 标记' },
      { pattern: /historical_fund_count/, msg: 'historical_fund_count 字段' },
      { pattern: /activeFundCount/, msg: 'activeFundCount 字段' }
    ];
    
    const failed = checks.filter(c => !c.pattern.test(content));
    
    if (failed.length > 0) {
      return { pass: false, message: `缺少: ${failed.map(c => c.msg).join(', ')}` };
    }
    
    return { pass: true, message: '历史持仓逻辑完整' };
  }
});

// ========== 测试8: stock-list 返回活跃/历史统计 ==========
testCases.push({
  id: 'TC-008',
  name: 'stock-list 返回活跃/历史统计验证',
  category: 'API',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/stock-list/route.js');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    const checks = [
      { pattern: /active_count/, msg: 'active_count 字段' },
      { pattern: /historical_count/, msg: 'historical_count 字段' }
    ];
    
    const failed = checks.filter(c => !c.pattern.test(content));
    
    if (failed.length > 0) {
      return { pass: false, message: `缺少: ${failed.map(c => c.msg).join(', ')}` };
    }
    
    return { pass: true, message: '返回结构包含统计信息' };
  }
});

// ========== 测试9: 前端 StockListModal 历史展示 ==========
testCases.push({
  id: 'TC-009',
  name: '前端 StockListModal 历史持仓展示验证',
  category: '前端',
  run: () => {
    const pagePath = path.join(process.cwd(), 'app/page.jsx');
    if (!fs.existsSync(pagePath)) {
      return { pass: false, message: 'page.jsx 文件不存在' };
    }
    
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    const checks = [
      { pattern: /is_historical/, msg: 'is_historical 判断' },
      { pattern: /historical_fund_count/, msg: 'historical_fund_count 显示' },
      { pattern: /active_count.*historical_count/, msg: '活跃/历史统计显示' },
      { pattern: /历史.*标签|历史基金/, msg: '历史标记显示' }
    ];
    
    const failed = checks.filter(c => !c.pattern.test(content));
    
    if (failed.length > 0) {
      return { pass: false, message: `缺少: ${failed.map(c => c.msg).join(', ')}` };
    }
    
    return { pass: true, message: '前端历史持仓展示完整' };
  }
});

// ========== 测试10: 前端刷新频率入口 ==========
testCases.push({
  id: 'TC-010',
  name: '前端刷新频率下拉入口验证',
  category: '前端',
  run: () => {
    const pagePath = path.join(process.cwd(), 'app/page.jsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    // 检查刷新频率下拉选项
    const options = [
      { value: 0, label: '暂停' },
      { value: 15000, label: '15秒' },
      { value: 30000, label: '30秒' },
      { value: 60000, label: '60秒' }
    ];
    
    // 检查是否有对应的选项值
    if (!content.includes('value: 0') && !content.includes('value:0')) {
      return { pass: false, message: '缺少暂停(0)选项' };
    }
    
    if (!content.includes('15000') && !content.includes('15秒')) {
      return { pass: false, message: '缺少15秒选项' };
    }
    
    if (!content.includes('60000') && !content.includes('60秒')) {
      return { pass: false, message: '缺少60秒选项' };
    }
    
    return { pass: true, message: '刷新频率下拉选项完整' };
  }
});

// ========== 测试11: stocks.csv 写入支持扩展字段 ==========
testCases.push({
  id: 'TC-011',
  name: 'stocks.csv 写入函数支持扩展字段',
  category: '数据结构',
  run: () => {
    const routePath = path.join(process.cwd(), 'app/api/stocks/route.js');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    // 检查 writeAllStocks 函数是否包含扩展字段
    const writeFuncMatch = content.match(/function writeAllStocks[\s\S]*?\n\}/);
    if (!writeFuncMatch) {
      return { pass: false, message: '未找到 writeAllStocks 函数' };
    }
    
    const writeFunc = writeFuncMatch[0];
    
    if (!writeFunc.includes('fund_deleted_at')) {
      return { pass: false, message: '写入函数未包含 fund_deleted_at 字段' };
    }
    
    if (!writeFunc.includes('extra_data')) {
      return { pass: false, message: '写入函数未包含 extra_data 字段' };
    }
    
    return { pass: true, message: '写入函数支持扩展字段' };
  }
});

// ========== 测试12: csv.js 扩展字段定义 ==========
testCases.push({
  id: 'TC-012',
  name: 'csv.js 扩展字段定义验证',
  category: '数据结构',
  run: () => {
    const csvPath = path.join(process.cwd(), 'app/lib/csv.js');
    if (!fs.existsSync(csvPath)) {
      return { pass: false, message: 'csv.js 文件不存在' };
    }
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    
    // 检查 funds 表头是否包含扩展字段
    if (!content.includes("funds: 'id,user_id,code,name,group_id,is_deleted,deleted_at,extra_data,created_at'")) {
      return { pass: false, message: 'funds 表头未包含扩展字段' };
    }
    
    return { pass: true, message: 'csv.js 扩展字段定义正确' };
  }
});

// ========== 运行测试 ==========
console.log('\n' + '='.repeat(60));
console.log('软删除机制功能测试报告');
console.log('测试时间: ' + new Date().toLocaleString('zh-CN'));
console.log('='.repeat(60) + '\n');

let passCount = 0;
let failCount = 0;
const results = [];

// 按类别分组
const categories = [...new Set(testCases.map(t => t.category))];

categories.forEach(category => {
  console.log(`\n${colors.cyan}【${category}】${colors.reset}`);
  
  testCases.filter(t => t.category === category).forEach(tc => {
    const result = tc.run();
    results.push({ ...tc, ...result });
    
    if (result.pass) {
      passCount++;
      log('pass', `[${tc.id}] ${tc.name}: ${result.message}`);
    } else {
      failCount++;
      log('fail', `[${tc.id}] ${tc.name}: ${result.message}`);
    }
  });
});

// 输出统计
console.log('\n' + '='.repeat(60));
console.log('测试结果统计');
console.log('='.repeat(60));
console.log(`总测试用例: ${testCases.length}`);
console.log(`${colors.green}通过: ${passCount}${colors.reset}`);
console.log(`${colors.red}失败: ${failCount}${colors.reset}`);
console.log(`通过率: ${(passCount / testCases.length * 100).toFixed(1)}%`);

// 输出详细报告
console.log('\n' + '='.repeat(60));
console.log('详细测试结果');
console.log('='.repeat(60));

results.forEach(r => {
  console.log(`\n[${r.id}] ${r.name}`);
  console.log(`  类别: ${r.category}`);
  console.log(`  结果: ${r.pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  说明: ${r.message}`);
});

console.log('\n' + '='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60) + '\n');

// 导出结果
module.exports = { results, passCount, failCount, total: testCases.length };
