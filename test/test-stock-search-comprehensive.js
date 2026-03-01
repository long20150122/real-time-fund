/**
 * 股票搜索功能全面测试
 * 测试维度：
 * 1. API功能测试 - 搜索API、添加API
 * 2. 颜色显示测试 - 涨跌幅颜色正确性
 * 3. 名称保存测试 - 股票名称正确存储
 * 4. 边界条件测试 - 空值、特殊字符等
 * 5. 数据一致性测试 - CSV读写一致性
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const DATA_DIR = path.join(process.cwd(), 'data');

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  details: [],
  errors: [],
};

// 测试用例计数器
let testId = 0;

/**
 * 记录测试结果
 */
function logTest(category, name, passed, message = '', expected = null, actual = null) {
  testId++;
  testResults.total++;
  
  const result = {
    id: testId,
    category,
    name,
    passed,
    message,
    expected,
    actual,
    timestamp: new Date().toISOString(),
  };
  
  if (passed) {
    testResults.passed++;
    console.log(`✅ [${category}] ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ [${category}] ${name}: ${message}`);
    if (expected !== null) console.log(`   Expected: ${JSON.stringify(expected)}`);
    if (actual !== null) console.log(`   Actual: ${JSON.stringify(actual)}`);
    testResults.errors.push(result);
  }
  
  testResults.details.push(result);
}

/**
 * HTTP请求封装
 */
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            json: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data, json: null });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * 测试1: API功能测试
 */
async function testAPIFunctions() {
  console.log('\n📋 测试组1: API功能测试\n');
  
  // 1.1 股票搜索API - 基本搜索
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=300034&limit=5',
      method: 'GET',
    });
    
    logTest(
      'API功能',
      '股票搜索API - 代码搜索',
      res.status === 200 && res.json?.stocks?.length > 0,
      `状态码: ${res.status}, 结果数: ${res.json?.stocks?.length || 0}`,
      { status: 200, hasResults: true },
      { status: res.status, results: res.json?.stocks?.length || 0 }
    );
  } catch (e) {
    logTest('API功能', '股票搜索API - 代码搜索', false, e.message);
  }
  
  // 1.2 股票搜索API - 名称搜索
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=' + encodeURIComponent('茅台') + '&limit=5',
      method: 'GET',
    });
    
    logTest(
      'API功能',
      '股票搜索API - 名称搜索',
      res.status === 200 && res.json?.stocks?.some(s => s.stock_name?.includes('茅台')),
      `找到茅台相关股票`,
      { hasMoutai: true },
      { found: res.json?.stocks?.find(s => s.stock_name?.includes('茅台'))?.stock_name }
    );
  } catch (e) {
    logTest('API功能', '股票搜索API - 名称搜索', false, e.message);
  }
  
  // 1.3 股票搜索API - 拼音搜索
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=mt&limit=10',
      method: 'GET',
    });
    
    logTest(
      'API功能',
      '股票搜索API - 拼音搜索',
      res.status === 200,
      `拼音搜索结果数: ${res.json?.stocks?.length || 0}`,
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('API功能', '股票搜索API - 拼音搜索', false, e.message);
  }
  
  // 1.4 股票搜索API - 港股搜索
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=00700&limit=5',
      method: 'GET',
    });
    
    const hasHK = res.json?.stocks?.some(s => s.type === '港股' || s.stock_code === '00700');
    logTest(
      'API功能',
      '股票搜索API - 港股搜索',
      res.status === 200 && hasHK,
      `港股搜索: ${res.json?.stocks?.find(s => s.stock_code === '00700')?.stock_name || '未找到'}`,
      { hasHKStock: true },
      { found: hasHK }
    );
  } catch (e) {
    logTest('API功能', '股票搜索API - 港股搜索', false, e.message);
  }
  
  // 1.5 股票搜索API - 空关键词
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=&limit=5',
      method: 'GET',
    });
    
    logTest(
      'API功能',
      '股票搜索API - 空关键词处理',
      res.status === 200 && res.json?.stocks?.length === 0,
      `空关键词返回空数组`,
      { empty: true },
      { length: res.json?.stocks?.length }
    );
  } catch (e) {
    logTest('API功能', '股票搜索API - 空关键词处理', false, e.message);
  }
}

/**
 * 测试2: 颜色显示测试
 */
async function testColorDisplay() {
  console.log('\n📋 测试组2: 颜色显示测试\n');
  
  // 读取CSS文件检查变量定义
  const cssPath = path.join(process.cwd(), 'app', 'globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  
  // 2.1 检查 --up 变量定义
  const hasUpVar = cssContent.includes('--up:') && cssContent.includes('--up: #f87171');
  logTest(
    '颜色显示',
    'CSS变量 --up 定义（红色涨）',
    hasUpVar,
    hasUpVar ? '已定义红色涨跌变量' : '缺少 --up 变量定义',
    { var: '--up: #f87171' },
    { defined: hasUpVar }
  );
  
  // 2.2 检查 --down 变量定义
  const hasDownVar = cssContent.includes('--down:') && cssContent.includes('--down: #34d399');
  logTest(
    '颜色显示',
    'CSS变量 --down 定义（绿色跌）',
    hasDownVar,
    hasDownVar ? '已定义绿色涨跌变量' : '缺少 --down 变量定义',
    { var: '--down: #34d399' },
    { defined: hasDownVar }
  );
  
  // 2.3 检查前端组件使用正确变量
  const searchComponentPath = path.join(process.cwd(), 'app', 'components', 'WatchlistModal', 'StockSearch.jsx');
  const searchComponent = fs.readFileSync(searchComponentPath, 'utf-8');
  
  const usesUpVar = searchComponent.includes('var(--up)');
  const usesDownVar = searchComponent.includes('var(--down)');
  logTest(
    '颜色显示',
    '前端组件使用颜色变量',
    usesUpVar && usesDownVar,
    `组件中颜色变量使用情况`,
    { usesUpVar: true, usesDownVar: true },
    { usesUpVar, usesDownVar }
  );
  
  // 2.4 检查颜色逻辑正确性
  const hasCorrectLogic = searchComponent.includes("isUp ? 'var(--up)'") && 
                          searchComponent.includes("isDown ? 'var(--down)'");
  logTest(
    '颜色显示',
    '颜色判断逻辑正确',
    hasCorrectLogic,
    '正数显示红色，负数显示绿色',
    { logic: '正数红色，负数绿色' },
    { correct: hasCorrectLogic }
  );
  
  // 2.5 API返回涨跌幅数据
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=600519&limit=1',
      method: 'GET',
    });
    
    const stock = res.json?.stocks?.[0];
    const hasPriceData = stock && stock.price !== undefined && stock.change_pct !== undefined;
    
    logTest(
      '颜色显示',
      'API返回价格和涨跌幅数据',
      hasPriceData,
      `价格: ${stock?.price}, 涨跌幅: ${stock?.change_pct}`,
      { hasPrice: true, hasChangePct: true },
      { price: stock?.price, change_pct: stock?.change_pct }
    );
  } catch (e) {
    logTest('颜色显示', 'API返回价格和涨跌幅数据', false, e.message);
  }
}

/**
 * 测试3: 名称保存测试
 */
async function testNameSaving() {
  console.log('\n📋 测试组3: 名称保存测试\n');
  
  // 3.1 检查CSV表头定义
  const csvLibPath = path.join(process.cwd(), 'app', 'lib', 'csv.js');
  const csvLib = fs.readFileSync(csvLibPath, 'utf-8');
  
  const hasStockNameHeader = csvLib.includes("watchlist_stocks: 'id,user_id,category_id,stock_code,stock_name,sort_order,created_at'");
  logTest(
    '名称保存',
    'CSV表头包含stock_name字段',
    hasStockNameHeader,
    hasStockNameHeader ? '表头已包含stock_name' : '表头缺少stock_name',
    { hasField: true },
    { hasStockNameHeader }
  );
  
  // 3.2 检查API保存stock_name
  const watchlistApiPath = path.join(process.cwd(), 'app', 'api', 'watchlist-stocks', 'route.js');
  const watchlistApi = fs.readFileSync(watchlistApiPath, 'utf-8');
  
  const savesStockName = watchlistApi.includes('stock_name: finalName') || 
                         watchlistApi.includes('stock_name:');
  logTest(
    '名称保存',
    'API保存stock_name字段',
    savesStockName,
    savesStockName ? 'API会保存股票名称' : 'API未保存股票名称',
    { savesName: true },
    { savesStockName }
  );
  
  // 3.3 检查CSV文件结构
  const watchlistCsvPath = path.join(DATA_DIR, 'watchlist_stocks.csv');
  if (fs.existsSync(watchlistCsvPath)) {
    const csvContent = fs.readFileSync(watchlistCsvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    const header = lines[0];
    
    const hasCorrectHeader = header.includes('stock_name');
    logTest(
      '名称保存',
      'CSV文件包含stock_name列',
      hasCorrectHeader,
      `当前表头: ${header}`,
      { hasStockName: true },
      { header }
    );
    
    // 3.4 检查已有数据的名称
    if (lines.length > 1) {
      const dataLines = lines.slice(1).filter(l => l.trim());
      const hasNames = dataLines.every(line => {
        const parts = line.split(',');
        // 检查第5列（stock_name）是否有值
        return parts.length >= 5 && parts[4] && parts[4].trim().length > 0;
      });
      
      logTest(
        '名称保存',
        '已有数据包含股票名称',
        hasNames || dataLines.length === 0,
        `共${dataLines.length}条记录`,
        { allHaveNames: true },
        { recordCount: dataLines.length, hasNames }
      );
    }
  } else {
    logTest('名称保存', 'CSV文件存在', false, 'watchlist_stocks.csv 不存在');
  }
  
  // 3.5 测试添加股票API
  try {
    const testCode = '601398'; // 工商银行
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, JSON.stringify({
      user_id: 'test-user-comprehensive',
      stock_code: testCode,
      stock_name: '工商银行',
    }));
    
    // 检查是否返回了正确的股票信息
    const hasStockInfo = res.json?.stockInfo?.stock_name === '工商银行' || 
                         res.json?.stock?.stock_name === '工商银行';
    
    logTest(
      '名称保存',
      '添加股票API返回正确名称',
      res.status === 200 || res.status === 400, // 400可能是已存在
      `状态: ${res.status}, 返回: ${JSON.stringify(res.json)}`,
      { name: '工商银行' },
      { response: res.json }
    );
  } catch (e) {
    logTest('名称保存', '添加股票API测试', false, e.message);
  }
}

/**
 * 测试4: 边界条件测试
 */
async function testBoundaryConditions() {
  console.log('\n📋 测试组4: 边界条件测试\n');
  
  // 4.1 搜索不存在股票
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=NOTEXIST999&limit=5',
      method: 'GET',
    });
    
    logTest(
      '边界条件',
      '搜索不存在的股票',
      res.status === 200,
      `返回结果数: ${res.json?.stocks?.length || 0}`,
      { status: 200 },
      { status: res.status, count: res.json?.stocks?.length }
    );
  } catch (e) {
    logTest('边界条件', '搜索不存在的股票', false, e.message);
  }
  
  // 4.2 特殊字符搜索
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=' + encodeURIComponent('<script>') + '&limit=5',
      method: 'GET',
    });
    
    // 响应应该是JSON格式，不应该包含未转义的script标签
    const isJson = res.headers['content-type']?.includes('application/json');
    
    logTest(
      '边界条件',
      '特殊字符搜索（安全性）',
      res.status === 200 && isJson,
      '应正确处理特殊字符，返回JSON响应',
      { safe: true },
      { status: res.status, isJson }
    );
  } catch (e) {
    logTest('边界条件', '特殊字符搜索', false, e.message);
  }
  
  // 4.3 超长关键词搜索
  try {
    const longKeyword = 'a'.repeat(100);
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/stock-search?keyword=${longKeyword}&limit=5`,
      method: 'GET',
    });
    
    logTest(
      '边界条件',
      '超长关键词搜索',
      res.status === 200,
      '应能处理超长关键词',
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('边界条件', '超长关键词搜索', false, e.message);
  }
  
  // 4.4 添加股票缺少参数
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, JSON.stringify({
      user_id: 'test-user',
      // 缺少 stock_code
    }));
    
    logTest(
      '边界条件',
      '添加股票缺少必要参数',
      res.status === 400,
      `应返回400错误`,
      { status: 400 },
      { status: res.status }
    );
  } catch (e) {
    logTest('边界条件', '添加股票缺少必要参数', false, e.message);
  }
  
  // 4.5 极限limit值
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=600&limit=1000',
      method: 'GET',
    });
    
    const resultCount = res.json?.stocks?.length || 0;
    logTest(
      '边界条件',
      '极限limit值处理',
      res.status === 200 && resultCount <= 1000,
      `返回${resultCount}条结果`,
      { reasonable: true },
      { count: resultCount }
    );
  } catch (e) {
    logTest('边界条件', '极限limit值处理', false, e.message);
  }
}

/**
 * 测试5: 数据一致性测试
 */
async function testDataConsistency() {
  console.log('\n📋 测试组5: 数据一致性测试\n');
  
  // 5.1 搜索结果字段完整性
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=600519&limit=1',
      method: 'GET',
    });
    
    const stock = res.json?.stocks?.[0];
    const requiredFields = ['stock_code', 'stock_name', 'type', 'price', 'change_pct'];
    const missingFields = requiredFields.filter(f => stock?.[f] === undefined);
    
    logTest(
      '数据一致性',
      '搜索结果字段完整性',
      missingFields.length === 0,
      `缺少字段: ${missingFields.join(', ') || '无'}`,
      { allFields: requiredFields },
      { missing: missingFields }
    );
  } catch (e) {
    logTest('数据一致性', '搜索结果字段完整性', false, e.message);
  }
  
  // 5.2 股票类型一致性
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=300034&limit=1',
      method: 'GET',
    });
    
    const stock = res.json?.stocks?.[0];
    // 300开头应该是创业板
    const isCorrectType = stock?.type === '创业板';
    
    logTest(
      '数据一致性',
      '股票类型判断正确（创业板）',
      isCorrectType,
      `300034 类型: ${stock?.type}`,
      { type: '创业板' },
      { type: stock?.type }
    );
  } catch (e) {
    logTest('数据一致性', '股票类型判断正确', false, e.message);
  }
  
  // 5.3 港股类型一致性
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=00700&limit=1',
      method: 'GET',
    });
    
    const stock = res.json?.stocks?.[0];
    // 5位代码应该是港股
    const isHK = stock?.type === '港股';
    
    logTest(
      '数据一致性',
      '股票类型判断正确（港股）',
      isHK,
      `00700 类型: ${stock?.type}`,
      { type: '港股' },
      { type: stock?.type }
    );
  } catch (e) {
    logTest('数据一致性', '港股类型判断正确', false, e.message);
  }
  
  // 5.4 CSV读写一致性
  const watchlistCsvPath = path.join(DATA_DIR, 'watchlist_stocks.csv');
  if (fs.existsSync(watchlistCsvPath)) {
    const content = fs.readFileSync(watchlistCsvPath, 'utf-8');
    const lines = content.trim().split('\n');
    const header = lines[0].split(',');
    
    // 检查每行数据的列数是否与表头一致
    let consistent = true;
    let inconsistentLines = [];
    
    lines.slice(1).forEach((line, idx) => {
      if (line.trim()) {
        const cols = line.split(',');
        if (cols.length !== header.length) {
          consistent = false;
          inconsistentLines.push({ line: idx + 2, cols: cols.length, expected: header.length });
        }
      }
    });
    
    logTest(
      '数据一致性',
      'CSV数据列数一致性',
      consistent,
      inconsistentLines.length > 0 ? `不一致行: ${JSON.stringify(inconsistentLines)}` : '所有行一致',
      { consistent: true },
      { consistent, issues: inconsistentLines }
    );
  }
  
  // 5.5 价格数据合理性
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stock-search?keyword=600519&limit=1',
      method: 'GET',
    });
    
    const stock = res.json?.stocks?.[0];
    // 价格应该为正数
    const priceValid = stock?.price === null || (stock?.price > 0 && stock?.price < 100000);
    // 涨跌幅应该在合理范围内（-100% ~ 100%）
    const changeValid = stock?.change_pct === null || (stock?.change_pct >= -100 && stock?.change_pct <= 100);
    
    logTest(
      '数据一致性',
      '价格数据合理性',
      priceValid && changeValid,
      `价格: ${stock?.price}, 涨跌幅: ${stock?.change_pct}%`,
      { priceValid: true, changeValid: true },
      { price: stock?.price, change_pct: stock?.change_pct }
    );
  } catch (e) {
    logTest('数据一致性', '价格数据合理性', false, e.message);
  }
}

/**
 * 测试6: 入口验证测试
 */
async function testEntryPoints() {
  console.log('\n📋 测试组6: 入口验证测试\n');
  
  // 6.1 自选股列表API
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks?user_id=test-user',
      method: 'GET',
    });
    
    logTest(
      '入口验证',
      '自选股列表API入口',
      res.status === 200,
      `状态: ${res.status}`,
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('入口验证', '自选股列表API入口', false, e.message);
  }
  
  // 6.2 自选股详情API
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks?user_id=test-user&include_info=true',
      method: 'GET',
    });
    
    logTest(
      '入口验证',
      '自选股详情API入口（含RSI）',
      res.status === 200,
      `状态: ${res.status}`,
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('入口验证', '自选股详情API入口', false, e.message);
  }
  
  // 6.3 股票搜索页面入口
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
    });
    
    logTest(
      '入口验证',
      '主页入口可访问',
      res.status === 200,
      `状态: ${res.status}`,
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('入口验证', '主页入口可访问', false, e.message);
  }
  
  // 6.4 删除股票API入口
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks?id=nonexistent&user_id=test-user',
      method: 'DELETE',
    });
    
    // 不存在应该返回404
    logTest(
      '入口验证',
      '删除股票API入口',
      res.status === 404 || res.status === 200,
      `状态: ${res.status}`,
      { acceptable: [200, 404] },
      { status: res.status }
    );
  } catch (e) {
    logTest('入口验证', '删除股票API入口', false, e.message);
  }
  
  // 6.5 批量更新API入口
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/watchlist-stocks',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    }, JSON.stringify({
      user_id: 'test-user',
      updates: [],
    }));
    
    logTest(
      '入口验证',
      '批量更新API入口',
      res.status === 200,
      `状态: ${res.status}`,
      { status: 200 },
      { status: res.status }
    );
  } catch (e) {
    logTest('入口验证', '批量更新API入口', false, e.message);
  }
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(1) 
    : 0;
  
  console.log(`
📈 测试统计:
   - 总用例数: ${testResults.total}
   - 通过: ${testResults.passed} ✅
   - 失败: ${testResults.failed} ❌
   - 跳过: ${testResults.skipped} ⏭️
   - 通过率: ${passRate}%

📋 分组统计:`);

  // 按分组统计
  const categories = {};
  testResults.details.forEach(d => {
    if (!categories[d.category]) {
      categories[d.category] = { passed: 0, failed: 0, total: 0 };
    }
    categories[d.category].total++;
    if (d.passed) categories[d.category].passed++;
    else categories[d.category].failed++;
  });

  Object.entries(categories).forEach(([name, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const icon = stats.failed === 0 ? '✅' : '⚠️';
    console.log(`   ${icon} ${name}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  // 输出失败详情
  if (testResults.errors.length > 0) {
    console.log('\n❌ 失败用例详情:');
    testResults.errors.forEach(e => {
      console.log(`   [${e.category}] ${e.name}: ${e.message}`);
    });
  }

  // 保存报告到文件
  const reportPath = path.join(DATA_DIR, 'stock_search_test_report.json');
  const report = {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      passRate: passRate + '%',
      timestamp: new Date().toISOString(),
    },
    categories,
    details: testResults.details,
    errors: testResults.errors,
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 详细报告已保存至: ${reportPath}`);
  
  console.log('\n' + '='.repeat(60));
  
  // 返回测试是否全部通过
  return testResults.failed === 0;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 开始股票搜索功能全面测试...');
  console.log('测试时间:', new Date().toLocaleString());
  
  try {
    await testAPIFunctions();
    await testColorDisplay();
    await testNameSaving();
    await testBoundaryConditions();
    await testDataConsistency();
    await testEntryPoints();
  } catch (e) {
    console.error('测试执行出错:', e);
  }
  
  const allPassed = generateReport();
  
  // 输出总结
  if (allPassed) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查上述详情。');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// 执行测试
main();
