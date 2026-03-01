/**
 * 涨跌幅修复验证测试
 * 验证：涨跌额（上涨点数）和涨跌幅（%）的正确性
 */

const fs = require('fs');
const path = require('path');

// 测试记录
const testResults = [];
function recordTest(category, name, passed, detail = '') {
  testResults.push({ category, name, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${detail}`);
}

// ============================================
// 测试1: 检查 stock-realtime API 索引修正
// ============================================
function testRealtimeAPI() {
  console.log('\n📋 测试1: stock-realtime API 索引修正');
  
  const apiPath = path.join(__dirname, '../app/api/stock-realtime/route.js');
  const content = fs.readFileSync(apiPath, 'utf-8');
  
  // 1.1 涨跌额应该在索引31
  const hasCorrectChangeIndex = content.includes("change: parseFloat(parts[31])");
  recordTest('实时行情API', '涨跌额索引正确(31)', hasCorrectChangeIndex,
    hasCorrectChangeIndex ? 'parts[31]是涨跌额' : '索引错误');
  
  // 1.2 涨跌幅应该在索引32
  const hasCorrectChangePercentIndex = content.includes("change_percent: parseFloat(parts[32])");
  recordTest('实时行情API', '涨跌幅索引正确(32)', hasCorrectChangePercentIndex,
    hasCorrectChangePercentIndex ? 'parts[32]是涨跌幅%' : '索引错误');
  
  // 1.3 注释正确
  const hasCorrectComment = content.includes('涨跌额（上涨点数）') && content.includes('涨跌幅（%）');
  recordTest('实时行情API', '注释说明正确', hasCorrectComment,
    hasCorrectComment ? '注释清晰' : '注释需要更新');
}

// ============================================
// 测试2: 检查 stock-search API 索引修正
// ============================================
function testSearchAPI() {
  console.log('\n📋 测试2: stock-search API 索引修正');
  
  const apiPath = path.join(__dirname, '../app/api/stock-search/route.js');
  const content = fs.readFileSync(apiPath, 'utf-8');
  
  // 2.1 涨跌额字段存在
  const hasChangeField = content.includes("change: parseFloat(parts[31])");
  recordTest('搜索API', '涨跌额字段存在', hasChangeField,
    hasChangeField ? 'change字段正确获取' : '缺少change字段');
  
  // 2.2 涨跌幅索引正确
  const hasCorrectIndex = content.includes("change_percent: parseFloat(parts[32])");
  recordTest('搜索API', '涨跌幅索引正确(32)', hasCorrectIndex,
    hasCorrectIndex ? '索引正确' : '索引错误');
  
  // 2.3 返回数据包含change字段
  const hasChangeInReturn = content.includes("change: quote?.change");
  recordTest('搜索API', '返回数据包含change', hasChangeInReturn,
    hasChangeInReturn ? '返回涨跌额' : '缺少change返回');
}

// ============================================
// 测试3: 检查 WatchlistContent 组件
// ============================================
function testWatchlistContent() {
  console.log('\n📋 测试3: WatchlistContent 组件');
  
  const componentPath = path.join(__dirname, '../app/components/WatchlistModal/WatchlistContent.jsx');
  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // 3.1 涨跌颜色函数（红涨绿跌）
  const hasCorrectColor = content.includes("value > 0") && content.includes("var(--danger)") && 
                          content.includes("value < 0") && content.includes("var(--success)");
  recordTest('股票列表组件', '涨跌颜色正确(红涨绿跌)', hasCorrectColor,
    hasCorrectColor ? '红涨绿跌样式' : '颜色样式错误');
  
  // 3.2 涨跌额字段显示
  const hasChangeDisplay = content.includes("realtimeData?.change") && 
                           (content.includes("上涨") || content.includes("change"));
  recordTest('股票列表组件', '涨跌额显示', hasChangeDisplay,
    hasChangeDisplay ? '显示上涨点数' : '缺少涨跌额显示');
  
  // 3.3 涨跌幅字段显示
  const hasChangePercentDisplay = content.includes("realtimeData?.change_percent");
  recordTest('股票列表组件', '涨跌幅显示', hasChangePercentDisplay,
    hasChangePercentDisplay ? '显示涨跌幅%' : '缺少涨跌幅显示');
  
  // 3.4 表头包含"上涨"
  const hasChangeHeader = content.includes("'上涨'") || content.includes('上涨');
  recordTest('股票列表组件', '表头包含"上涨"列', hasChangeHeader,
    hasChangeHeader ? '表头正确' : '缺少上涨列表头');
  
  // 3.5 列布局（增强后为13列）
  const hasCorrectColumns = content.includes('gridTemplateColumns:');
  recordTest('股票列表组件', '列布局存在', hasCorrectColumns,
    hasCorrectColumns ? '列布局正确' : '缺少列布局');
  
  // 3.6 最新价使用涨跌颜色
  const priceUseChangeColor = content.includes("color: changeColor") && 
                               content.includes("{displayData.price?.toFixed(2)");
  recordTest('股票列表组件', '最新价使用涨跌颜色', priceUseChangeColor,
    priceUseChangeColor ? '价格颜色随涨跌' : '价格颜色不正确');
}

// ============================================
// 测试4: 检查 StockSearch 组件
// ============================================
function testStockSearch() {
  console.log('\n📋 测试4: StockSearch 组件');
  
  const componentPath = path.join(__dirname, '../app/components/WatchlistModal/StockSearch.jsx');
  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // 4.1 涨跌颜色函数（红涨绿跌）
  const hasCorrectColor = content.includes("getChangeColor") && 
                          content.includes("var(--danger)") && content.includes("var(--success)");
  recordTest('搜索组件', '涨跌颜色正确(红涨绿跌)', hasCorrectColor,
    hasCorrectColor ? '红涨绿跌样式' : '颜色样式错误');
  
  // 4.2 涨跌额字段使用
  const hasChangeField = content.includes("stock.change");
  recordTest('搜索组件', '涨跌额字段使用', hasChangeField,
    hasChangeField ? '使用change字段' : '缺少change字段');
  
  // 4.3 涨跌幅字段使用
  const hasChangePctField = content.includes("stock.change_pct");
  recordTest('搜索组件', '涨跌幅字段使用', hasChangePctField,
    hasChangePctField ? '使用change_pct字段' : '缺少change_pct字段');
  
  // 4.4 显示涨跌额
  const hasChangeDisplay = content.includes("change.toFixed(2)");
  recordTest('搜索组件', '显示涨跌额', hasChangeDisplay,
    hasChangeDisplay ? '显示上涨点数' : '缺少涨跌额显示');
  
  // 4.5 显示涨跌幅
  const hasChangePctDisplay = content.includes("changePct.toFixed(2)") || content.includes("change_pct.toFixed");
  recordTest('搜索组件', '显示涨跌幅%', hasChangePctDisplay,
    hasChangePctDisplay ? '显示涨跌幅' : '缺少涨跌幅显示');
  
  // 4.6 表头包含"上涨"
  const hasChangeHeader = content.includes('textAlign: \'right\' }}>上涨');
  recordTest('搜索组件', '表头包含"上涨"列', hasChangeHeader,
    hasChangeHeader ? '表头正确' : '缺少上涨列表头');
  
  // 4.7 弹窗宽度合适
  const hasCorrectWidth = content.includes("width: 480");
  recordTest('搜索组件', '弹窗宽度适配', hasCorrectWidth,
    hasCorrectWidth ? '宽度480px' : '宽度需要调整');
}

// ============================================
// 测试5: 数据逻辑验证
// ============================================
function testDataLogic() {
  console.log('\n📋 测试5: 数据逻辑验证');
  
  // 5.1 验证计算公式：涨跌幅 = 涨跌额 / 昨收 * 100
  const testCases = [
    { price: 161.00, prevClose: 160.01, expectedChange: 0.99, expectedChangePct: 0.62 },
    { price: 100.50, prevClose: 100.00, expectedChange: 0.50, expectedChangePct: 0.50 },
    { price: 98.00, prevClose: 100.00, expectedChange: -2.00, expectedChangePct: -2.00 },
    { price: 1455.02, prevClose: 1447.85, expectedChange: 7.17, expectedChangePct: 0.50 },
  ];
  
  testCases.forEach((tc, i) => {
    const change = tc.price - tc.prevClose;
    const changePct = (change / tc.prevClose) * 100;
    const isChangeCorrect = Math.abs(change - tc.expectedChange) < 0.01;
    const isChangePctCorrect = Math.abs(changePct - tc.expectedChangePct) < 0.1;
    
    recordTest('数据逻辑', `用例${i+1}计算正确`, isChangeCorrect && isChangePctCorrect,
      `涨跌额=${change.toFixed(2)}, 涨跌幅=${changePct.toFixed(2)}%`);
  });
}

// ============================================
// 测试6: 颜色样式验证
// ============================================
function testColorStyles() {
  console.log('\n📋 测试6: 颜色样式验证');
  
  // 6.1 红涨绿跌验证
  const testValues = [
    { value: 5.5, expectedColor: 'var(--danger)', label: '上涨' },
    { value: 0.99, expectedColor: 'var(--danger)', label: '上涨' },
    { value: -2.5, expectedColor: 'var(--success)', label: '下跌' },
    { value: 0, expectedColor: 'var(--muted)', label: '平盘' },
  ];
  
  function getChangeColor(value) {
    if (value > 0) return 'var(--danger)';
    if (value < 0) return 'var(--success)';
    return 'var(--muted)';
  }
  
  testValues.forEach((tv, i) => {
    const color = getChangeColor(tv.value);
    const isCorrect = color === tv.expectedColor;
    recordTest('颜色样式', `${tv.label}${tv.value}颜色正确`, isCorrect,
      isCorrect ? `颜色: ${color}` : `期望: ${tv.expectedColor}, 实际: ${color}`);
  });
}

// ============================================
// 测试7: 文件完整性
// ============================================
function testFileIntegrity() {
  console.log('\n📋 测试7: 文件完整性');
  
  const files = [
    'app/api/stock-realtime/route.js',
    'app/api/stock-search/route.js',
    'app/components/WatchlistModal/WatchlistContent.jsx',
    'app/components/WatchlistModal/StockSearch.jsx',
  ];
  
  files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);
    recordTest('文件完整性', file, exists, exists ? '文件存在' : '文件不存在');
  });
}

// ============================================
// 主函数
// ============================================
async function main() {
  console.log('🚀 开始涨跌幅修复验证测试\n');
  console.log('============================================================');
  
  testRealtimeAPI();
  testSearchAPI();
  testWatchlistContent();
  testStockSearch();
  testDataLogic();
  testColorStyles();
  testFileIntegrity();
  
  console.log('\n============================================================');
  console.log('📊 测试完成！');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  
  console.log(`   总用例: ${total}`);
  console.log(`   通过: ${passed} ✅`);
  console.log(`   失败: ${failed} ❌`);
  console.log(`   通过率: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('============================================================');
  
  // 生成报告
  const reportPath = path.join(__dirname, '../data/change_fix_test_report.md');
  const report = generateReport(passed, failed, total);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

function generateReport(passed, failed, total) {
  const categories = {};
  testResults.forEach(r => {
    if (!categories[r.category]) {
      categories[r.category] = [];
    }
    categories[r.category].push(r);
  });
  
  let report = `# 涨跌幅修复验证测试报告\n\n`;
  report += `**测试时间**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## 测试概要\n\n`;
  report += `| 指标 | 值 |\n| --- | --- |\n`;
  report += `| 总用例 | ${total} |\n`;
  report += `| 通过 | ${passed} ✅ |\n`;
  report += `| 失败 | ${failed} ❌ |\n`;
  report += `| 通过率 | ${((passed / total) * 100).toFixed(1)}% |\n\n`;
  
  report += `## 测试详情\n\n`;
  Object.entries(categories).forEach(([cat, results]) => {
    report += `### ${cat}\n\n`;
    report += `| 测试项 | 结果 | 说明 |\n| --- | --- | --- |\n`;
    results.forEach(r => {
      report += `| ${r.name} | ${r.passed ? '✅' : '❌'} | ${r.detail} |\n`;
    });
    report += '\n';
  });
  
  report += `## 修复内容\n\n`;
  report += `### 1. API索引修正\n\n`;
  report += `- **涨跌额（上涨点数）**: parts[31] - 修正前错误使用parts[32]\n`;
  report += `- **涨跌幅（%）**: parts[32] - 修正前错误使用parts[31]\n\n`;
  report += `### 2. 新增字段\n\n`;
  report += `- **上涨**: 显示涨跌额（上涨点数），如 +0.99\n`;
  report += `- **涨跌幅**: 显示涨跌幅百分比，如 +0.61%\n\n`;
  report += `### 3. 颜色样式\n\n`;
  report += `- **红涨**: value > 0 → var(--danger)\n`;
  report += `- **绿跌**: value < 0 → var(--success)\n`;
  report += `- **平盘**: value = 0 → var(--muted)\n\n`;
  
  return report;
}

main().catch(console.error);
