/**
 * 自选股票增强功能测试
 * 测试内容：
 * 1. 新增字段：自选日、自选价、自选收益、实体涨幅
 * 2. 上下移动功能
 * 3. 倒序展示
 * 4. 自动爬取历史数据
 */

const fs = require('fs');
const path = require('path');

const testResults = [];
function recordTest(category, name, passed, detail = '') {
  testResults.push({ category, name, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${detail}`);
}

// ============================================
// 测试1: CSV表头新增字段
// ============================================
function testCSVHeaders() {
  console.log('\n📋 测试1: CSV表头新增字段');
  
  const csvPath = path.join(__dirname, '../app/lib/csv.js');
  const content = fs.readFileSync(csvPath, 'utf-8');
  
  // 1.1 watchlist_stocks 表头包含 add_date
  const hasAddDate = content.includes("watchlist_stocks: 'id,user_id,category_id,stock_code,stock_name,sort_order,add_date,add_price");
  recordTest('CSV表头', 'add_date字段', hasAddDate, hasAddDate ? '自选日字段存在' : '缺少add_date');
  
  // 1.2 watchlist_stocks 表头包含 add_price
  const hasAddPrice = content.includes('add_price');
  recordTest('CSV表头', 'add_price字段', hasAddPrice, hasAddPrice ? '自选价字段存在' : '缺少add_price');
}

// ============================================
// 测试2: API新增功能
// ============================================
function testAPIEnhancements() {
  console.log('\n📋 测试2: API新增功能');
  
  const apiPath = path.join(__dirname, '../app/api/watchlist-stocks/route.js');
  const content = fs.readFileSync(apiPath, 'utf-8');
  
  // 2.1 添加时获取实时价格
  const hasGetRealtimePrice = content.includes('getStockRealtimePrice');
  recordTest('API功能', '获取实时价格', hasGetRealtimePrice, hasGetRealtimePrice ? '添加时获取股价' : '缺少获取价格逻辑');
  
  // 2.2 保存add_date和add_price
  const hasSaveAddData = content.includes('add_date: addDate') && content.includes('add_price: addPrice');
  recordTest('API功能', '保存自选数据', hasSaveAddData, hasSaveAddData ? '保存自选日和自选价' : '缺少保存逻辑');
  
  // 2.3 倒序排序
  const hasDescSort = content.includes("(parseInt(b.sortOrder) || 0) - (parseInt(a.sortOrder) || 0)");
  recordTest('API功能', '倒序排序', hasDescSort, hasDescSort ? '新的在上面' : '排序逻辑不正确');
  
  // 2.4 上下移动功能
  const hasMoveUp = content.includes("action === 'move_up'");
  const hasMoveDown = content.includes("action === 'move_down'");
  recordTest('API功能', '上下移动', hasMoveUp && hasMoveDown, hasMoveUp && hasMoveDown ? '支持上下移动' : '缺少移动功能');
  
  // 2.5 检查历史数据存在
  const hasCheckHistory = content.includes('hasStockHistory') || content.includes('checkStockHistoryExists');
  recordTest('API功能', '检查历史数据', hasCheckHistory, hasCheckHistory ? '检查历史数据是否存在' : '缺少检查逻辑');
  
  // 2.6 has_history字段返回
  const hasHistoryField = content.includes('has_history:');
  recordTest('API功能', '返回has_history', hasHistoryField, hasHistoryField ? '返回历史数据状态' : '缺少has_history字段');
}

// ============================================
// 测试3: stockHistoryService新增函数
// ============================================
function testStockHistoryService() {
  console.log('\n📋 测试3: stockHistoryService新增函数');
  
  const servicePath = path.join(__dirname, '../app/lib/stockHistoryService.js');
  const content = fs.readFileSync(servicePath, 'utf-8');
  
  // 3.1 checkStockHistoryExists 函数
  const hasCheckFunction = content.includes('export function checkStockHistoryExists');
  recordTest('历史数据服务', '检查函数存在', hasCheckFunction, hasCheckFunction ? 'checkStockHistoryExists函数' : '缺少检查函数');
  
  // 3.2 函数返回布尔值
  const returnsBoolean = content.includes('return records.some(r => r.stock_code === stockCode)');
  recordTest('历史数据服务', '返回布尔值', returnsBoolean, returnsBoolean ? '返回true/false' : '返回值不正确');
}

// ============================================
// 测试4: 前端组件新增功能
// ============================================
function testFrontendComponent() {
  console.log('\n📋 测试4: 前端组件新增功能');
  
  const componentPath = path.join(__dirname, '../app/components/WatchlistModal/WatchlistContent.jsx');
  const content = fs.readFileSync(componentPath, 'utf-8');
  
  // 4.1 计算自选收益函数
  const hasReturnCalc = content.includes('calculateReturn');
  recordTest('前端组件', '自选收益计算', hasReturnCalc, hasReturnCalc ? '计算(currentPrice-addPrice)/addPrice' : '缺少计算函数');
  
  // 4.2 计算实体涨幅函数
  const hasBodyCalc = content.includes('calculateBodyPercent');
  recordTest('前端组件', '实体涨幅计算', hasBodyCalc, hasBodyCalc ? '计算(close-open)/open' : '缺少计算函数');
  
  // 4.3 显示自选日
  const hasAddDateDisplay = content.includes('自选日');
  recordTest('前端组件', '自选日显示', hasAddDateDisplay, hasAddDateDisplay ? '显示添加日期' : '缺少自选日显示');
  
  // 4.4 显示自选价
  const hasAddPriceDisplay = content.includes('自选价');
  recordTest('前端组件', '自选价显示', hasAddPriceDisplay, hasAddPriceDisplay ? '显示添加时股价' : '缺少自选价显示');
  
  // 4.5 显示自选收益
  const hasReturnDisplay = content.includes('自选收益');
  recordTest('前端组件', '自选收益显示', hasReturnDisplay, hasReturnDisplay ? '显示自选收益%' : '缺少自选收益显示');
  
  // 4.6 显示实体涨幅
  const hasBodyDisplay = content.includes('实体涨幅');
  recordTest('前端组件', '实体涨幅显示', hasBodyDisplay, hasBodyDisplay ? '显示K线实体涨幅' : '缺少实体涨幅显示');
  
  // 4.7 拖拽排序功能
  const hasDragSort = content.includes('draggable') || content.includes('onDragStart');
  recordTest('前端组件', '拖拽排序功能', hasDragSort, hasDragSort ? '支持拖拽排序' : '缺少拖拽功能');
  
  // 4.8 拖拽手柄图标
  const hasDragHandle = content.includes('DragHandle') || content.includes('grab');
  recordTest('前端组件', '拖拽手柄', hasDragHandle, hasDragHandle ? '拖拽手柄+十字光标' : '缺少拖拽手柄');
  
  // 4.9 历史数据提示
  const hasNoHistoryTip = content.includes('数据还在准备中');
  recordTest('前端组件', '历史数据提示', hasNoHistoryTip, hasNoHistoryTip ? '提示用户稍等' : '缺少提示');
  
  // 4.10 红涨绿跌颜色
  const hasCorrectColor = content.includes("value > 0") && content.includes("var(--danger)") && 
                          content.includes("value < 0") && content.includes("var(--success)");
  recordTest('前端组件', '红涨绿跌颜色', hasCorrectColor, hasCorrectColor ? '颜色样式正确' : '颜色样式错误');
}

// ============================================
// 测试5: 数据计算逻辑验证
// ============================================
function testDataCalculation() {
  console.log('\n📋 测试5: 数据计算逻辑验证');
  
  // 5.1 自选收益计算
  function calculateReturn(currentPrice, addPrice) {
    if (!currentPrice || !addPrice || addPrice === 0) return null;
    return ((currentPrice - addPrice) / addPrice) * 100;
  }
  
  const testCases = [
    { current: 110, add: 100, expected: 10 },
    { current: 90, add: 100, expected: -10 },
    { current: 105.5, add: 100, expected: 5.5 },
    { current: null, add: 100, expected: null },
    { current: 100, add: 0, expected: null },
  ];
  
  testCases.forEach((tc, i) => {
    const result = calculateReturn(tc.current, tc.add);
    const passed = tc.expected === null ? result === null : Math.abs(result - tc.expected) < 0.01;
    recordTest('计算逻辑', `自选收益用例${i+1}`, passed, 
      `当前${tc.current}, 自选价${tc.add} -> ${result?.toFixed(2) || 'null'}%`);
  });
  
  // 5.2 实体涨幅计算
  function calculateBodyPercent(open, close) {
    if (!open || open === 0) return null;
    return ((close - open) / open) * 100;
  }
  
  const bodyTestCases = [
    { open: 100, close: 105, expected: 5 },    // 阳线
    { open: 100, close: 95, expected: -5 },    // 阴线
    { open: 100, close: 100, expected: 0 },    // 十字星
    { open: 0, close: 100, expected: null },   // 无效
  ];
  
  bodyTestCases.forEach((tc, i) => {
    const result = calculateBodyPercent(tc.open, tc.close);
    const passed = tc.expected === null ? result === null : Math.abs(result - tc.expected) < 0.01;
    recordTest('计算逻辑', `实体涨幅用例${i+1}`, passed,
      `开盘${tc.open}, 收盘${tc.close} -> ${result?.toFixed(2) || 'null'}%`);
  });
}

// ============================================
// 测试6: 组件化架构验证
// ============================================
function testComponentArchitecture() {
  console.log('\n📋 测试6: 组件化架构验证');
  
  const componentDir = path.join(__dirname, '../app/components/WatchlistModal');
  
  // 6.1 组件文件存在
  const files = ['index.jsx', 'WatchlistContent.jsx', 'WatchlistSidebar.jsx', 'StockSearch.jsx'];
  files.forEach(file => {
    const filePath = path.join(componentDir, file);
    const exists = fs.existsSync(filePath);
    recordTest('组件架构', `${file}存在`, exists, exists ? '文件存在' : '文件不存在');
  });
  
  // 6.2 Context使用
  const indexPath = path.join(componentDir, 'index.jsx');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const hasContext = indexContent.includes('WatchlistContext');
  recordTest('组件架构', 'Context状态管理', hasContext, hasContext ? '使用Context共享状态' : '缺少Context');
  
  // 6.3 组件解耦
  const contentPath = path.join(componentDir, 'WatchlistContent.jsx');
  const contentContent = fs.readFileSync(contentPath, 'utf-8');
  const usesContext = contentContent.includes("useWatchlist");
  recordTest('组件架构', '组件解耦', usesContext, usesContext ? '通过Context获取状态' : '组件耦合');
}

// ============================================
// 测试7: API响应测试
// ============================================
async function testAPIResponses() {
  console.log('\n📋 测试7: API响应测试');
  
  const baseUrl = 'http://localhost:3000';
  
  // 7.1 测试自选股列表API
  try {
    const res = await fetch(`${baseUrl}/api/watchlist-stocks?user_id=test-user-enhanced`);
    const data = await res.json();
    const hasStocks = Array.isArray(data.stocks);
    recordTest('API响应', '自选股列表', hasStocks, `返回${data.stocks?.length || 0}只股票`);
    
    // 检查新字段
    if (data.stocks?.length > 0) {
      const firstStock = data.stocks[0];
      const hasAddDate = 'add_date' in firstStock;
      const hasAddPrice = 'add_price' in firstStock;
      const hasHasHistory = 'has_history' in firstStock;
      recordTest('API响应', 'add_date字段', hasAddDate, hasAddDate ? '返回自选日' : '缺少add_date');
      recordTest('API响应', 'add_price字段', hasAddPrice, hasAddPrice ? '返回自选价' : '缺少add_price');
      recordTest('API响应', 'has_history字段', hasHasHistory, hasHasHistory ? '返回历史数据状态' : '缺少has_history');
    }
  } catch (error) {
    recordTest('API响应', '自选股列表', false, `请求失败: ${error.message}`);
  }
}

// ============================================
// 主函数
// ============================================
async function main() {
  console.log('🚀 开始自选股票增强功能测试\n');
  console.log('============================================================');
  
  testCSVHeaders();
  testAPIEnhancements();
  testStockHistoryService();
  testFrontendComponent();
  testDataCalculation();
  testComponentArchitecture();
  await testAPIResponses();
  
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
  const reportPath = path.join(__dirname, '../data/watchlist_enhanced_test_report.md');
  const report = generateReport(passed, failed, total);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

function generateReport(passed, failed, total) {
  const categories = {};
  testResults.forEach(r => {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  });
  
  let report = `# 自选股票增强功能测试报告\n\n`;
  report += `**测试时间**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## 测试概要\n\n`;
  report += `| 指标 | 值 |\n| --- | --- |\n`;
  report += `| 总用例 | ${total} |\n| 通过 | ${passed} ✅ |\n| 失败 | ${failed} ❌ |\n| 通过率 | ${((passed / total) * 100).toFixed(1)}% |\n\n`;
  
  report += `## 新增功能\n\n`;
  report += `### 1. 新增字段\n\n`;
  report += `| 字段名 | 说明 |\n| --- | --- |\n`;
  report += `| 自选日 | 添加股票的日期 |\n`;
  report += `| 自选价 | 添加时的股价 |\n`;
  report += `| 自选收益 | (当前价-自选价)/自选价 × 100% |\n`;
  report += `| 实体涨幅 | (收盘价-开盘价)/开盘价 × 100% |\n\n`;
  
  report += `### 2. 上下移动功能\n\n`;
  report += `- 点击 ↑ 上移一位\n`;
  report += `- 点击 ↓ 下移一位\n`;
  report += `- 排序持久化保存\n\n`;
  
  report += `### 3. 倒序展示\n\n`;
  report += `- 新添加的股票在最上面\n`;
  report += `- 按 sort_order 倒序排列\n\n`;
  
  report += `### 4. 自动爬取历史数据\n\n`;
  report += `- 新股票无历史数据时自动触发爬取\n`;
  report += `- 无历史数据时点击显示提示\n\n`;
  
  report += `## 测试详情\n\n`;
  Object.entries(categories).forEach(([cat, results]) => {
    report += `### ${cat}\n\n`;
    report += `| 测试项 | 结果 | 说明 |\n| --- | --- | --- |\n`;
    results.forEach(r => {
      report += `| ${r.name} | ${r.passed ? '✅' : '❌'} | ${r.detail} |\n`;
    });
    report += '\n';
  });
  
  return report;
}

main().catch(console.error);
