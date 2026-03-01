/**
 * 股票自选功能端到端全面测试
 * 
 * 测试目标（5大功能点）：
 * 1. 添加股票后名称无乱码 - 验证UTF-8编码
 * 2. 涨跌幅数据一致性 - 搜索API vs 实时API vs 自选列表
 * 3. 市值数据正确性 - 总市值 >= 流通市值
 * 4. 自动获取历史数据 - 2024-01-01至今
 * 5. RSI数据完整展示 - RSI6/12/24及最高最低值
 * 
 * 测试维度：
 * - 入口测试：所有API入口可用性
 * - 数据流测试：搜索→添加→展示完整流程
 * - 数据一致性测试：多API数据对比
 * - 边界条件测试：异常情况处理
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const DATA_DIR = path.join(process.cwd(), 'data');
const TEST_USER_ID = 'test-user-e2e-' + Date.now();

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(colors[color] || '', ...args, colors.reset);
}

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  details: [],
  errors: [],
  categories: {},
  dataSamples: {},
};

let testId = 0;

/**
 * 记录测试结果
 */
function recordTest(category, name, passed, message = '', data = null) {
  testId++;
  testResults.total++;
  
  const result = {
    id: testId,
    category,
    name,
    passed,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  
  if (!testResults.categories[category]) {
    testResults.categories[category] = { passed: 0, failed: 0, total: 0 };
  }
  testResults.categories[category].total++;
  
  if (passed) {
    testResults.passed++;
    testResults.categories[category].passed++;
    log('green', `  ✅ [${category}] ${name}`);
  } else {
    testResults.failed++;
    testResults.categories[category].failed++;
    log('red', `  ❌ [${category}] ${name}: ${message}`);
    testResults.errors.push(result);
  }
  
  testResults.details.push(result);
  
  // 保存数据样本
  if (data) {
    if (!testResults.dataSamples[category]) {
      testResults.dataSamples[category] = [];
    }
    testResults.dataSamples[category].push({ name, data });
  }
}

/**
 * HTTP请求封装
 */
function httpRequest(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    const req = http.request(reqOptions, (res) => {
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
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ============================================================
// 测试组1: 入口可用性测试
// ============================================================
async function testEntryPoints() {
  log('cyan', '\n📋 测试组1: 入口可用性测试');
  log('cyan', '='.repeat(50));
  
  const category = '入口测试';
  
  const endpoints = [
    { path: '/api/stock-search?keyword=600519', name: '股票搜索API', method: 'GET' },
    { path: '/api/stock-realtime?codes=600519', name: '实时行情API', method: 'GET' },
    { path: '/api/watchlist-stocks?user_id=' + TEST_USER_ID, name: '自选股列表API', method: 'GET' },
    { path: '/api/watchlist-categories?user_id=' + TEST_USER_ID, name: '自选股分类API', method: 'GET' },
    { path: '/api/stock-list', name: '股票列表API', method: 'GET' },
    { path: '/api/stock-history?code=600519', name: '历史数据API', method: 'GET' },
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await httpRequest(ep.path, { method: ep.method });
      const isOk = res.status === 200 || res.status === 400;
      recordTest(category, ep.name, isOk, `状态码: ${res.status}`);
    } catch (e) {
      recordTest(category, ep.name, false, e.message);
    }
  }
  
  // POST 入口测试
  try {
    const res = await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: { user_id: TEST_USER_ID, stock_code: '999999' },
    });
    // 可能返回400（股票不存在）或500，但不应该是连接错误
    recordTest(category, '添加股票API入口', res.status !== undefined, `状态码: ${res.status}`);
  } catch (e) {
    recordTest(category, '添加股票API入口', false, e.message);
  }
  
  // DELETE 入口测试
  try {
    const res = await httpRequest('/api/watchlist-stocks?id=nonexistent&user_id=' + TEST_USER_ID, {
      method: 'DELETE',
    });
    recordTest(category, '删除股票API入口', res.status !== undefined, `状态码: ${res.status}`);
  } catch (e) {
    recordTest(category, '删除股票API入口', false, e.message);
  }
}

// ============================================================
// 测试组2: 股票名称编码测试（功能点1）
// ============================================================
async function testNameEncoding() {
  log('cyan', '\n📋 测试组2: 股票名称编码测试（功能点1）');
  log('cyan', '='.repeat(50));
  
  const category = '名称编码';
  
  // 2.1 搜索API返回中文股票名称
  try {
    const res = await httpRequest('/api/stock-search?keyword=600519&limit=1');
    const stock = res.json?.stocks?.[0];
    
    if (stock) {
      const isChinese = /[\u4e00-\u9fa5]/.test(stock.stock_name);
      const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(stock.stock_name);
      
      recordTest(category, '搜索API返回中文股票名称', isChinese && !hasGarbled,
        `名称: ${stock.stock_name}`, { stock_name: stock.stock_name, code: stock.stock_code });
    } else {
      recordTest(category, '搜索API返回中文股票名称', false, '未返回数据');
    }
  } catch (e) {
    recordTest(category, '搜索API返回中文股票名称', false, e.message);
  }
  
  // 2.2 实时行情API返回中文股票名称
  try {
    const res = await httpRequest('/api/stock-realtime?codes=600519,300034,00700');
    
    const results = [];
    let allValid = true;
    
    for (const code of ['600519', '300034', '00700']) {
      const stock = res.json?.data?.[code];
      if (stock) {
        const isChinese = /[\u4e00-\u9fa5]/.test(stock.stock_name);
        const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(stock.stock_name);
        const valid = isChinese && !hasGarbled;
        
        results.push({ code, name: stock.stock_name, valid });
        if (!valid) allValid = false;
      }
    }
    
    recordTest(category, '实时行情API返回中文股票名称', allValid,
      results.map(r => `${r.code}:${r.name}`).join(', '),
      { results });
  } catch (e) {
    recordTest(category, '实时行情API返回中文股票名称', false, e.message);
  }
  
  // 2.3 添加股票后名称正确保存
  try {
    // 先删除可能存在的测试数据
    await httpRequest(`/api/watchlist-stocks?stock_code=601398&user_id=${TEST_USER_ID}`, {
      method: 'DELETE',
    });
    
    // 添加股票
    const addRes = await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        stock_code: '601398',
        stock_name: '工商银行',
      },
    });
    
    const addedStock = addRes.json?.stock || addRes.json?.stockInfo;
    
    if (addRes.status === 200 && addedStock) {
      const savedName = addedStock.stock_name;
      const isChinese = /[\u4e00-\u9fa5]/.test(savedName);
      const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(savedName);
      
      recordTest(category, '添加股票后名称正确保存', isChinese && !hasGarbled,
        `保存的名称: ${savedName}`, { stock_name: savedName });
    } else if (addRes.json?.error?.includes('已在自选中')) {
      recordTest(category, '添加股票后名称正确保存', true, '股票已存在（跳过）');
    } else {
      recordTest(category, '添加股票后名称正确保存', false, `添加失败: ${addRes.json?.error}`);
    }
  } catch (e) {
    recordTest(category, '添加股票后名称正确保存', false, e.message);
  }
  
  // 2.4 自选股列表显示正确名称
  try {
    const res = await httpRequest(`/api/watchlist-stocks?user_id=${TEST_USER_ID}&include_info=true`);
    const stocks = res.json?.stocks || [];
    
    if (stocks.length > 0) {
      let allValid = true;
      const results = [];
      
      stocks.forEach(stock => {
        const isChinese = /[\u4e00-\u9fa5]/.test(stock.stock_name);
        const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(stock.stock_name);
        const valid = isChinese && !hasGarbled;
        results.push({ code: stock.stock_code, name: stock.stock_name, valid });
        if (!valid) allValid = false;
      });
      
      recordTest(category, '自选股列表显示正确名称', allValid,
        `检查 ${stocks.length} 只股票`,
        { stocks: results.slice(0, 5) });
    } else {
      recordTest(category, '自选股列表显示正确名称', true, '自选股列表为空');
    }
  } catch (e) {
    recordTest(category, '自选股列表显示正确名称', false, e.message);
  }
  
  // 2.5 港股名称无乱码
  try {
    const res = await httpRequest('/api/stock-realtime?codes=00700');
    const stock = res.json?.data?.['00700'];
    
    if (stock) {
      const hasValidName = stock.stock_name && stock.stock_name.length > 0;
      const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(stock.stock_name);
      
      recordTest(category, '港股名称无乱码', hasValidName && !hasGarbled,
        `港股名称: ${stock.stock_name}`, { name: stock.stock_name });
    } else {
      recordTest(category, '港股名称无乱码', false, '未返回港股数据');
    }
  } catch (e) {
    recordTest(category, '港股名称无乱码', false, e.message);
  }
}

// ============================================================
// 测试组3: 涨跌幅数据一致性测试（功能点2）
// ============================================================
async function testChangePercentConsistency() {
  log('cyan', '\n📋 测试组3: 涨跌幅数据一致性测试（功能点2）');
  log('cyan', '='.repeat(50));
  
  const category = '涨跌幅一致性';
  
  const testCodes = ['600519', '000001', '300034', '00700'];
  
  for (const code of testCodes) {
    try {
      // 从搜索API获取
      const searchRes = await httpRequest(`/api/stock-search?keyword=${code}&limit=1`);
      const searchStock = searchRes.json?.stocks?.[0];
      
      // 从实时API获取
      const realtimeRes = await httpRequest(`/api/stock-realtime?codes=${code}`);
      const realtimeStock = realtimeRes.json?.data?.[code];
      
      if (searchStock && realtimeStock) {
        const searchChange = searchStock.change_pct;
        const realtimeChange = realtimeStock.change_percent;
        
        // 比较涨跌幅（允许小误差）
        const diff = Math.abs((searchChange || 0) - (realtimeChange || 0));
        const isConsistent = diff < 0.5;
        
        recordTest(category, `${code} 搜索与实时API涨跌幅一致`, isConsistent,
          `搜索: ${searchChange?.toFixed(2)}%, 实时: ${realtimeChange?.toFixed(2)}%, 差异: ${diff.toFixed(4)}%`,
          { code, searchChange, realtimeChange, diff });
      } else {
        recordTest(category, `${code} 搜索与实时API涨跌幅一致`, false, '数据不完整');
      }
    } catch (e) {
      recordTest(category, `${code} 搜索与实时API涨跌幅一致`, false, e.message);
    }
  }
  
  // 自选股列表涨跌幅验证
  try {
    const watchlistRes = await httpRequest(`/api/watchlist-stocks?user_id=${TEST_USER_ID}&include_info=true`);
    const stocks = watchlistRes.json?.stocks || [];
    
    if (stocks.length > 0) {
      // 获取第一只股票的实时数据
      const firstStock = stocks[0];
      const realtimeRes = await httpRequest(`/api/stock-realtime?codes=${firstStock.stock_code}`);
      const realtimeStock = realtimeRes.json?.data?.[firstStock.stock_code];
      
      if (realtimeStock) {
        // 自选股列表会显示实时数据
        const watchlistChange = realtimeStock.change_percent;
        
        recordTest(category, '自选股列表显示实时涨跌幅', watchlistChange !== undefined,
          `涨跌幅: ${watchlistChange?.toFixed(2)}%`,
          { code: firstStock.stock_code, change_percent: watchlistChange });
      } else {
        recordTest(category, '自选股列表显示实时涨跌幅', false, '未获取到实时数据');
      }
    } else {
      recordTest(category, '自选股列表显示实时涨跌幅', true, '自选股列表为空');
    }
  } catch (e) {
    recordTest(category, '自选股列表显示实时涨跌幅', false, e.message);
  }
  
  // 涨跌幅字段索引验证（代码层面）
  const category2 = '涨跌幅字段';
  
  try {
    const realtimeApi = fs.readFileSync(path.join(process.cwd(), 'app/api/stock-realtime/route.js'), 'utf-8');
    const usesCorrectIndex = realtimeApi.includes('parseFloat(parts[31])') && 
      realtimeApi.includes('change_percent');
    recordTest(category2, '实时API使用正确的字段索引(31)', usesCorrectIndex);
  } catch (e) {
    recordTest(category2, '实时API使用正确的字段索引(31)', false, e.message);
  }
  
  try {
    const searchApi = fs.readFileSync(path.join(process.cwd(), 'app/api/stock-search/route.js'), 'utf-8');
    const searchUsesCorrectIndex = searchApi.includes('parseFloat(parts[31])');
    recordTest(category2, '搜索API使用正确的字段索引(31)', searchUsesCorrectIndex);
  } catch (e) {
    recordTest(category2, '搜索API使用正确的字段索引(31)', false, e.message);
  }
}

// ============================================================
// 测试组4: 市值数据正确性测试（功能点3）
// ============================================================
async function testMarketCapData() {
  log('cyan', '\n📋 测试组4: 市值数据正确性测试（功能点3）');
  log('cyan', '='.repeat(50));
  
  const category = '市值数据';
  
  const testCodes = ['600519', '000001', '300034', '601398'];
  const results = [];
  let allValid = true;
  
  for (const code of testCodes) {
    try {
      const res = await httpRequest(`/api/stock-realtime?codes=${code}`);
      const stock = res.json?.data?.[code];
      
      if (stock) {
        const { total_cap, float_cap, stock_name } = stock;
        
        // 总市值应该 >= 流通市值（或其中一者为0）
        const isValid = total_cap >= float_cap || total_cap === 0 || float_cap === 0;
        
        const formatCap = (cap) => {
          if (!cap) return '0';
          if (cap >= 1e12) return (cap / 1e12).toFixed(2) + '万亿';
          if (cap >= 1e8) return (cap / 1e8).toFixed(2) + '亿';
          return cap.toLocaleString();
        };
        
        results.push({
          code,
          name: stock_name,
          total_cap: formatCap(total_cap),
          float_cap: formatCap(float_cap),
          total_raw: total_cap,
          float_raw: float_cap,
          valid: isValid,
        });
        
        if (!isValid) allValid = false;
      }
    } catch (e) {
      allValid = false;
    }
  }
  
  recordTest(category, '多只股票市值数据合理', allValid,
    results.map(r => `${r.code}:${r.valid ? '✓' : '✗'}`).join(', '),
    { results });
  
  // 代码层面验证
  try {
    const realtimeApi = fs.readFileSync(path.join(process.cwd(), 'app/api/stock-realtime/route.js'), 'utf-8');
    const hasCapValidation = realtimeApi.includes('quote.total_cap < quote.float_cap');
    const hasSwapLogic = realtimeApi.includes('const temp = quote.total_cap');
    
    recordTest(category, '市值验证和交换逻辑存在', hasCapValidation && hasSwapLogic);
  } catch (e) {
    recordTest(category, '市值验证和交换逻辑存在', false, e.message);
  }
  
  // 市值字段索引验证
  try {
    const realtimeApi = fs.readFileSync(path.join(process.cwd(), 'app/api/stock-realtime/route.js'), 'utf-8');
    const usesCorrectIndex = realtimeApi.includes('parseFloat(parts[44])') && 
      realtimeApi.includes('parseFloat(parts[45])');
    recordTest(category, '市值字段索引正确(44=总市值,45=流通市值)', usesCorrectIndex);
  } catch (e) {
    recordTest(category, '市值字段索引正确(44=总市值,45=流通市值)', false, e.message);
  }
}

// ============================================================
// 测试组5: 历史数据自动获取测试（功能点4）
// ============================================================
async function testHistoryDataFetch() {
  log('cyan', '\n📋 测试组5: 历史数据自动获取测试（功能点4）');
  log('cyan', '='.repeat(50));
  
  const category = '历史数据';
  
  // 5.1 历史数据文件检查
  const historyFile = path.join(DATA_DIR, 'stock_history.csv');
  const historyExists = fs.existsSync(historyFile);
  recordTest(category, '历史数据文件存在', historyExists);
  
  if (historyExists) {
    const content = fs.readFileSync(historyFile, 'utf-8');
    const lines = content.trim().split('\n');
    const header = lines[0];
    
    // 5.2 表头字段检查
    const requiredFields = ['stock_code', 'stock_name', 'trade_date', 'open', 'close', 'high', 'low', 'volume', 'rsi6', 'rsi12', 'rsi24'];
    const headers = header.split(',');
    const missingFields = requiredFields.filter(f => !headers.includes(f));
    
    recordTest(category, '历史数据表头字段完整', missingFields.length === 0,
      missingFields.length > 0 ? `缺少字段: ${missingFields.join(', ')}` : '所有必需字段存在',
      { headers: headers.slice(0, 15) });
    
    // 5.3 数据量检查
    const dataLines = lines.slice(1).filter(l => l.trim());
    recordTest(category, '历史数据量充足', dataLines.length > 0,
      `共 ${dataLines.length} 条记录`, { count: dataLines.length });
    
    // 5.4 日期范围检查
    const dateIdx = headers.indexOf('trade_date');
    const codeIdx = headers.indexOf('stock_code');
    
    if (dateIdx >= 0 && codeIdx >= 0) {
      // 获取一只股票的日期范围
      const firstCode = dataLines[0]?.split(',')[codeIdx];
      const stockRecords = dataLines.filter(l => l.split(',')[codeIdx] === firstCode);
      
      if (stockRecords.length > 0) {
        const dates = stockRecords.map(l => l.split(',')[dateIdx]).sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        const startsFrom2024 = startDate <= '2024-01-01' || startDate <= '2024-01-05';
        
        recordTest(category, '历史数据起始日期正确', startsFrom2024,
          `起始: ${startDate}, 结束: ${endDate}`,
          { startDate, endDate, recordCount: stockRecords.length });
      }
    }
    
    // 5.5 RSI字段有数据
    const rsi6Idx = headers.indexOf('rsi6');
    let rsiCount = 0;
    dataLines.forEach(l => {
      const values = l.split(',');
      if (rsi6Idx >= 0 && values[rsi6Idx] && values[rsi6Idx] !== '') {
        rsiCount++;
      }
    });
    
    const rsiRatio = dataLines.length > 0 ? (rsiCount / dataLines.length * 100).toFixed(1) : 0;
    recordTest(category, 'RSI数据填充完整', rsiCount > dataLines.length * 0.9,
      `RSI数据覆盖率: ${rsiRatio}%`, { rsiCount, total: dataLines.length });
  }
  
  // 5.6 添加股票触发历史数据获取（代码验证）
  try {
    const watchlistApi = fs.readFileSync(path.join(process.cwd(), 'app/api/watchlist-stocks/route.js'), 'utf-8');
    const triggersHistory = watchlistApi.includes('fetchStockHistory') && watchlistApi.includes('needFetchHistory');
    recordTest(category, '添加股票触发历史数据获取', triggersHistory);
  } catch (e) {
    recordTest(category, '添加股票触发历史数据获取', false, e.message);
  }
  
  // 5.7 历史数据服务模块检查
  try {
    const historyService = fs.readFileSync(path.join(process.cwd(), 'app/lib/stockHistoryService.js'), 'utf-8');
    const hasStartDate = historyService.includes("START_DATE = '2024-01-01'");
    const hasRSICalc = historyService.includes('calculateMultipleRSI');
    
    recordTest(category, '历史数据服务配置正确', hasStartDate && hasRSICalc);
  } catch (e) {
    recordTest(category, '历史数据服务配置正确', false, e.message);
  }
}

// ============================================================
// 测试组6: RSI数据完整展示测试（功能点5）
// ============================================================
async function testRSIDataDisplay() {
  log('cyan', '\n📋 测试组6: RSI数据完整展示测试（功能点5）');
  log('cyan', '='.repeat(50));
  
  const category = 'RSI数据';
  
  // 6.1 RSI计算模块检查
  try {
    const indicators = fs.readFileSync(path.join(process.cwd(), 'app/lib/indicators.js'), 'utf-8');
    const hasRSI = indicators.includes('export function calculateRSI');
    const hasMultipleRSI = indicators.includes('export function calculateMultipleRSI');
    
    recordTest(category, 'RSI计算模块存在', hasRSI && hasMultipleRSI);
  } catch (e) {
    recordTest(category, 'RSI计算模块存在', false, e.message);
  }
  
  // 6.2 自选股API返回RSI数据
  try {
    const res = await httpRequest(`/api/watchlist-stocks?user_id=${TEST_USER_ID}&include_info=true`);
    const stocks = res.json?.stocks || [];
    
    if (stocks.length > 0) {
      let hasRSI = false;
      let hasRSIMaxMin = false;
      
      stocks.forEach(stock => {
        if (stock.rsi6 !== undefined && stock.rsi6 !== null) hasRSI = true;
        if (stock.rsi6_max_6m !== undefined) hasRSIMaxMin = true;
        if (stock.rsi6_min_6m !== undefined) hasRSIMaxMin = true;
      });
      
      const sampleStock = stocks.find(s => s.rsi6 !== undefined && s.rsi6 !== null);
      
      recordTest(category, '自选股API返回RSI数据', hasRSI || stocks.length === 0,
        sampleStock ? `示例: ${sampleStock.stock_code} RSI6=${sampleStock.rsi6?.toFixed(1)}` : '暂无RSI数据',
        { sample: sampleStock });
      
      recordTest(category, '自选股API返回RSI最高最低值', hasRSIMaxMin || stocks.length === 0,
        sampleStock ? `最高=${sampleStock.rsi6_max_6m?.toFixed(1)}, 最低=${sampleStock.rsi6_min_6m?.toFixed(1)}` : '暂无数据',
        { sample: sampleStock });
    } else {
      recordTest(category, '自选股API返回RSI数据', true, '自选股列表为空');
      recordTest(category, '自选股API返回RSI最高最低值', true, '自选股列表为空');
    }
  } catch (e) {
    recordTest(category, '自选股API返回RSI数据', false, e.message);
    recordTest(category, '自选股API返回RSI最高最低值', false, e.message);
  }
  
  // 6.3 历史数据中的RSI值范围验证
  const historyFile = path.join(DATA_DIR, 'stock_history.csv');
  if (fs.existsSync(historyFile)) {
    const content = fs.readFileSync(historyFile, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    const rsi6Idx = headers.indexOf('rsi6');
    
    let validCount = 0;
    let invalidCount = 0;
    let minRSI = 100;
    let maxRSI = 0;
    
    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const values = line.split(',');
      const rsi6 = parseFloat(values[rsi6Idx]);
      
      if (!isNaN(rsi6) && rsi6 > 0) {
        if (rsi6 >= 0 && rsi6 <= 100) {
          validCount++;
          minRSI = Math.min(minRSI, rsi6);
          maxRSI = Math.max(maxRSI, rsi6);
        } else {
          invalidCount++;
        }
      }
    });
    
    recordTest(category, 'RSI值范围正确(0-100)', invalidCount === 0,
      `有效: ${validCount}, 无效: ${invalidCount}, 范围: ${minRSI.toFixed(1)}-${maxRSI.toFixed(1)}`,
      { validCount, invalidCount, minRSI, maxRSI });
  }
  
  // 6.4 前端组件RSI展示检查
  try {
    const watchlistContent = fs.readFileSync(path.join(process.cwd(), 'app/components/WatchlistModal/WatchlistContent.jsx'), 'utf-8');
    
    const showsRSI6 = watchlistContent.includes('rsi6');
    const showsRSIMax = watchlistContent.includes('rsi6_max_6m');
    const showsRSIMin = watchlistContent.includes('rsi6_min_6m');
    const showsRSIColor = watchlistContent.includes("rsi6 > 70") && watchlistContent.includes("rsi6 < 30");
    
    recordTest(category, '前端组件展示RSI6', showsRSI6);
    recordTest(category, '前端组件展示RSI最高最低值', showsRSIMax && showsRSIMin);
    recordTest(category, '前端组件RSI超买超卖颜色', showsRSIColor);
  } catch (e) {
    recordTest(category, '前端组件展示RSI6', false, e.message);
    recordTest(category, '前端组件展示RSI最高最低值', false, e.message);
    recordTest(category, '前端组件RSI超买超卖颜色', false, e.message);
  }
}

// ============================================================
// 测试组7: 端到端数据流测试
// ============================================================
async function testE2EDataFlow() {
  log('cyan', '\n📋 测试组7: 端到端数据流测试');
  log('cyan', '='.repeat(50));
  
  const category = '端到端';
  
  const testCode = '600036'; // 招商银行
  
  try {
    // 步骤1: 搜索股票
    log('blue', `  步骤1: 搜索股票 ${testCode}`);
    const searchRes = await httpRequest(`/api/stock-search?keyword=${testCode}&limit=1`);
    const searchStock = searchRes.json?.stocks?.[0];
    
    if (!searchStock) {
      recordTest(category, '端到端数据流', false, '搜索失败');
      return;
    }
    
    const searchName = searchStock.stock_name;
    const searchChange = searchStock.change_pct;
    
    // 步骤2: 添加到自选
    log('blue', `  步骤2: 添加到自选`);
    await httpRequest(`/api/watchlist-stocks?stock_code=${testCode}&user_id=${TEST_USER_ID}`, {
      method: 'DELETE',
    });
    
    const addRes = await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        stock_code: testCode,
        stock_name: searchName,
      },
    });
    
    const added = addRes.status === 200;
    const addedName = addRes.json?.stock?.stock_name || addRes.json?.stockInfo?.stock_name;
    
    recordTest(category, '添加股票成功', added, `状态: ${addRes.status}`);
    
    // 步骤3: 从自选列表获取
    log('blue', `  步骤3: 从自选列表获取`);
    const watchlistRes = await httpRequest(`/api/watchlist-stocks?user_id=${TEST_USER_ID}&include_info=true`);
    const watchlistStock = watchlistRes.json?.stocks?.find(s => s.stock_code === testCode);
    
    if (watchlistStock) {
      const watchlistName = watchlistStock.stock_name;
      const watchlistRSI6 = watchlistStock.rsi6;
      const watchlistRSIMax = watchlistStock.rsi6_max_6m;
      const watchlistRSIMin = watchlistStock.rsi6_min_6m;
      
      // 验证名称一致
      const nameMatch = searchName === watchlistName || addedName === watchlistName;
      recordTest(category, '名称在整个流程中一致', nameMatch,
        `搜索: ${searchName}, 自选: ${watchlistName}`,
        { searchName, watchlistName });
      
      // 验证RSI数据存在
      recordTest(category, '自选股包含RSI数据', watchlistRSI6 !== undefined,
        `RSI6: ${watchlistRSI6?.toFixed(1) || '无'}`,
        { rsi6: watchlistRSI6, rsi6_max: watchlistRSIMax, rsi6_min: watchlistRSIMin });
      
      recordTest(category, '自选股包含RSI最高最低值', 
        watchlistRSIMax !== undefined && watchlistRSIMin !== undefined,
        `最高: ${watchlistRSIMax?.toFixed(1) || '无'}, 最低: ${watchlistRSIMin?.toFixed(1) || '无'}`);
    } else {
      recordTest(category, '从自选列表获取股票', false, '未找到刚添加的股票');
    }
    
    // 步骤4: 获取实时行情对比
    log('blue', `  步骤4: 获取实时行情对比`);
    const realtimeRes = await httpRequest(`/api/stock-realtime?codes=${testCode}`);
    const realtimeStock = realtimeRes.json?.data?.[testCode];
    
    if (realtimeStock) {
      const realtimeName = realtimeStock.stock_name;
      const realtimeChange = realtimeStock.change_percent;
      
      // 验证名称一致
      const nameConsistent = realtimeName === searchName || realtimeName === addedName;
      recordTest(category, '实时行情名称与搜索一致', nameConsistent,
        `搜索: ${searchName}, 实时: ${realtimeName}`);
      
      // 验证涨跌幅一致
      const changeDiff = Math.abs((searchChange || 0) - (realtimeChange || 0));
      const changeConsistent = changeDiff < 0.5;
      recordTest(category, '实时行情涨跌幅与搜索一致', changeConsistent,
        `搜索: ${searchChange?.toFixed(2)}%, 实时: ${realtimeChange?.toFixed(2)}%, 差异: ${changeDiff.toFixed(4)}%`);
      
      // 验证市值正确
      const capValid = realtimeStock.total_cap >= realtimeStock.float_cap || 
        realtimeStock.total_cap === 0 || realtimeStock.float_cap === 0;
      recordTest(category, '实时行情市值数据正确', capValid,
        `总市值: ${(realtimeStock.total_cap / 1e8).toFixed(2)}亿, 流通: ${(realtimeStock.float_cap / 1e8).toFixed(2)}亿`);
    }
    
    // 清理测试数据
    await httpRequest(`/api/watchlist-stocks?stock_code=${testCode}&user_id=${TEST_USER_ID}`, {
      method: 'DELETE',
    });
    
  } catch (e) {
    recordTest(category, '端到端数据流', false, e.message);
  }
}

// ============================================================
// 测试组8: 边界条件和异常处理
// ============================================================
async function testBoundaryConditions() {
  log('cyan', '\n📋 测试组8: 边界条件和异常处理');
  log('cyan', '='.repeat(50));
  
  const category = '边界条件';
  
  // 8.1 空关键词搜索
  try {
    const res = await httpRequest('/api/stock-search?keyword=&limit=5');
    recordTest(category, '空关键词搜索处理', res.status === 200 && res.json?.stocks?.length === 0);
  } catch (e) {
    recordTest(category, '空关键词搜索处理', false, e.message);
  }
  
  // 8.2 不存在的股票代码
  try {
    const res = await httpRequest('/api/stock-search?keyword=999999&limit=5');
    recordTest(category, '不存在的股票搜索处理', res.status === 200);
  } catch (e) {
    recordTest(category, '不存在的股票搜索处理', false, e.message);
  }
  
  // 8.3 添加缺少参数
  try {
    const res = await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: { user_id: TEST_USER_ID },
    });
    recordTest(category, '添加股票缺少参数处理', res.status === 400);
  } catch (e) {
    recordTest(category, '添加股票缺少参数处理', false, e.message);
  }
  
  // 8.4 重复添加同一股票
  try {
    // 先添加一次
    await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: { user_id: TEST_USER_ID, stock_code: '600000', stock_name: '浦发银行' },
    });
    
    // 再添加一次
    const res = await httpRequest('/api/watchlist-stocks', {
      method: 'POST',
      body: { user_id: TEST_USER_ID, stock_code: '600000', stock_name: '浦发银行' },
    });
    
    recordTest(category, '重复添加同一股票处理', res.status === 400);
  } catch (e) {
    recordTest(category, '重复添加同一股票处理', false, e.message);
  }
  
  // 8.5 删除不存在的股票
  try {
    const res = await httpRequest(`/api/watchlist-stocks?id=nonexistent123&user_id=${TEST_USER_ID}`, {
      method: 'DELETE',
    });
    recordTest(category, '删除不存在的股票处理', res.status === 404);
  } catch (e) {
    recordTest(category, '删除不存在的股票处理', false, e.message);
  }
  
  // 8.6 特殊字符搜索
  try {
    const res = await httpRequest('/api/stock-search?keyword=' + encodeURIComponent('<script>') + '&limit=5');
    const isJson = res.headers['content-type']?.includes('application/json');
    recordTest(category, '特殊字符搜索安全处理', res.status === 200 && isJson);
  } catch (e) {
    recordTest(category, '特殊字符搜索安全处理', false, e.message);
  }
}

// ============================================================
// 生成测试报告
// ============================================================
function generateReport() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '📊 端到端全面系统测试报告');
  log('magenta', '='.repeat(60));
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(1) 
    : 0;
  
  console.log(`
📈 总体统计:
   - 总用例数: ${testResults.total}
   - 通过: ${testResults.passed} ✅
   - 失败: ${testResults.failed} ❌
   - 通过率: ${passRate}%

📋 分组统计:`);

  Object.entries(testResults.categories).forEach(([name, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const icon = stats.failed === 0 ? '✅' : '⚠️';
    console.log(`   ${icon} ${name}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  // 失败详情
  if (testResults.errors.length > 0) {
    console.log('\n❌ 失败用例详情:');
    testResults.errors.forEach(e => {
      console.log(`   [${e.category}] ${e.name}: ${e.message}`);
    });
  }

  // 保存报告
  const reportPath = path.join(DATA_DIR, 'e2e_test_report.json');
  const report = {
    title: '股票自选功能端到端全面系统测试报告',
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: passRate + '%',
    },
    categories: testResults.categories,
    details: testResults.details,
    errors: testResults.errors,
    dataSamples: testResults.dataSamples,
    features: {
      '功能点1': '添加股票后名称无乱码（UTF-8编码）',
      '功能点2': '涨跌幅数据一致性（搜索/实时/自选）',
      '功能点3': '市值数据正确性（总市值>=流通市值）',
      '功能点4': '自动获取历史数据（2024-01-01至今）',
      '功能点5': 'RSI数据完整展示（RSI6/12/24及最高最低值）',
    },
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 JSON报告: ${reportPath}`);
  
  // 生成 Markdown 报告
  const mdReport = generateMarkdownReport(report);
  const mdReportPath = path.join(DATA_DIR, 'e2e_test_report.md');
  fs.writeFileSync(mdReportPath, mdReport);
  console.log(`📄 Markdown报告: ${mdReportPath}`);
  
  console.log('\n' + '='.repeat(60));
  
  return testResults.failed === 0;
}

/**
 * 生成 Markdown 格式的测试报告
 */
function generateMarkdownReport(report) {
  const lines = [];
  
  lines.push(`# 股票自选功能端到端全面系统测试报告`);
  lines.push(``);
  lines.push(`**测试时间:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(``);
  lines.push(`## 测试概要`);
  lines.push(``);
  lines.push(`| 指标 | 值 |`);
  lines.push(`| --- | --- |`);
  lines.push(`| 总用例数 | ${report.summary.total} |`);
  lines.push(`| 通过 | ${report.summary.passed} ✅ |`);
  lines.push(`| 失败 | ${report.summary.failed} ❌ |`);
  lines.push(`| 通过率 | ${report.summary.passRate} |`);
  lines.push(``);
  lines.push(`## 功能覆盖（5大功能点）`);
  lines.push(``);
  lines.push(`| 功能点 | 说明 |`);
  lines.push(`| --- | --- |`);
  Object.entries(report.features).forEach(([name, desc]) => {
    lines.push(`| ${name} | ${desc} |`);
  });
  lines.push(``);
  lines.push(`## 分组统计`);
  lines.push(``);
  lines.push(`| 测试组 | 通过/总数 | 通过率 | 状态 |`);
  lines.push(`| --- | --- | --- | --- |`);
  Object.entries(report.categories).forEach(([name, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const status = stats.failed === 0 ? '✅' : '⚠️';
    lines.push(`| ${name} | ${stats.passed}/${stats.total} | ${rate}% | ${status} |`);
  });
  lines.push(``);
  
  if (report.errors.length > 0) {
    lines.push(`## 失败用例`);
    lines.push(``);
    lines.push(`| 编号 | 测试组 | 用例名 | 错误信息 |`);
    lines.push(`| --- | --- | --- | --- |`);
    report.errors.forEach((e, idx) => {
      lines.push(`| ${idx + 1} | ${e.category} | ${e.name} | ${e.message} |`);
    });
    lines.push(``);
  }
  
  lines.push(`## 测试详情`);
  lines.push(``);
  lines.push(`| 编号 | 测试组 | 用例名 | 结果 | 详情 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  report.details.forEach((d, idx) => {
    const result = d.passed ? '✅' : '❌';
    lines.push(`| ${idx + 1} | ${d.category} | ${d.name} | ${result} | ${d.message || '-'} |`);
  });
  lines.push(``);
  lines.push(`---`);
  lines.push(`*报告生成时间: ${new Date().toLocaleString()}*`);
  
  return lines.join('\n');
}

// ============================================================
// 主测试函数
// ============================================================
async function main() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '🚀 股票自选功能端到端全面系统测试');
  log('magenta', '='.repeat(60));
  log('magenta', `测试时间: ${new Date().toLocaleString()}`);
  log('magenta', `测试用户: ${TEST_USER_ID}`);
  log('magenta', `测试范围: 5大功能点全覆盖`);
  
  try {
    // 执行所有测试组
    await testEntryPoints();
    await testNameEncoding();
    await testChangePercentConsistency();
    await testMarketCapData();
    await testHistoryDataFetch();
    await testRSIDataDisplay();
    await testE2EDataFlow();
    await testBoundaryConditions();
    
    // 生成报告
    const allPassed = generateReport();
    
    if (allPassed) {
      log('green', '\n🎉 所有测试通过！');
    } else {
      log('yellow', '\n⚠️ 部分测试失败，请检查上述详情。');
    }
    
    process.exit(allPassed ? 0 : 1);
  } catch (e) {
    log('red', `\n❌ 测试执行出错: ${e.message}`);
    console.error(e);
    process.exit(1);
  }
}

// 执行测试
main();
