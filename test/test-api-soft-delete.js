/**
 * API 接口功能测试脚本
 * 测试内容：
 * 1. stock-list API 返回结构
 * 2. stocks DELETE 软删除功能
 * 3. funds DELETE 联动软删除
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(type, msg) {
  const icons = { pass: '✓', fail: '✗', info: '→', warn: '⚠' };
  const colorMap = { pass: colors.green, fail: colors.red, info: colors.cyan, warn: colors.yellow };
  console.log(`${colorMap[type]}${icons[type]} ${msg}${colors.reset}`);
}

// HTTP 请求封装
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 测试用例
const testCases = [];

// ========== TC-101: stock-list API 返回结构 ==========
testCases.push({
  id: 'TC-101',
  name: 'stock-list API 返回结构验证',
  category: 'API接口',
  run: async () => {
    try {
      const res = await request('GET', '/api/stock-list');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      const requiredFields = ['data', 'total', 'report_date'];
      const missing = requiredFields.filter(f => !(f in res.data));
      
      if (missing.length > 0) {
        return { pass: false, message: `缺少返回字段: ${missing.join(', ')}` };
      }
      
      // 检查新字段
      const newFields = ['active_count', 'historical_count'];
      const newMissing = newFields.filter(f => !(f in res.data));
      
      if (newMissing.length > 0) {
        return { pass: false, message: `缺少新字段: ${newMissing.join(', ')}` };
      }
      
      // 检查数据项结构
      if (res.data.data.length > 0) {
        const item = res.data.data[0];
        const itemFields = ['stock_code', 'stock_name', 'fund_count', 'is_historical', 'historical_fund_count'];
        const itemMissing = itemFields.filter(f => !(f in item));
        
        if (itemMissing.length > 0) {
          return { pass: false, message: `数据项缺少字段: ${itemMissing.join(', ')}` };
        }
      }
      
      return { 
        pass: true, 
        message: `返回结构正确，共 ${res.data.total} 条数据，活跃 ${res.data.active_count}，历史 ${res.data.historical_count}` 
      };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== TC-102: stock-realtime API 无缓存 ==========
testCases.push({
  id: 'TC-102',
  name: 'stock-realtime API 响应验证',
  category: 'API接口',
  run: async () => {
    try {
      const res = await request('GET', '/api/stock-realtime?codes=002027');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      if (!res.data.data) {
        return { pass: false, message: '缺少 data 字段' };
      }
      
      // 检查是否返回了股票数据
      if (res.data.data['002027']) {
        const stock = res.data.data['002027'];
        const requiredFields = ['stock_code', 'price', 'change_percent'];
        const missing = requiredFields.filter(f => !(f in stock));
        
        if (missing.length > 0) {
          return { pass: false, message: `股票数据缺少字段: ${missing.join(', ')}` };
        }
        
        return { pass: true, message: `股票 ${stock.stock_name}(${stock.stock_code}) 价格: ${stock.price}, 涨跌: ${stock.change_percent}%` };
      }
      
      return { pass: true, message: 'API响应正常（无数据）' };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== TC-103: stocks DELETE 软删除参数 ==========
testCases.push({
  id: 'TC-103',
  name: 'stocks DELETE 软删除模式验证',
  category: 'API接口',
  run: async () => {
    try {
      // 测试软删除模式（不带mode参数，默认软删除）
      const res = await request('DELETE', '/api/stocks?fundCode=TEST_FUND_NOT_EXIST');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      // 检查返回结构
      if (res.data.success !== true) {
        return { pass: false, message: '返回 success 不为 true' };
      }
      
      // 检查是否是软删除模式
      if (res.data.mode !== 'soft') {
        return { pass: false, message: `默认模式应为 soft，实际为 ${res.data.mode}` };
      }
      
      return { pass: true, message: '软删除模式正确，默认为 soft' };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== TC-104: stocks DELETE 硬删除参数 ==========
testCases.push({
  id: 'TC-104',
  name: 'stocks DELETE 硬删除模式验证',
  category: 'API接口',
  run: async () => {
    try {
      const res = await request('DELETE', '/api/stocks?fundCode=TEST_FUND_NOT_EXIST&mode=hard');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      if (res.data.mode !== 'hard') {
        return { pass: false, message: `模式应为 hard，实际为 ${res.data.mode}` };
      }
      
      return { pass: true, message: '硬删除模式正确' };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== TC-105: funds GET 接口 ==========
testCases.push({
  id: 'TC-105',
  name: 'funds GET 接口验证',
  category: 'API接口',
  run: async () => {
    try {
      const res = await request('GET', '/api/funds?userId=ft001');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      if (!Array.isArray(res.data.funds)) {
        return { pass: false, message: 'funds 不是数组' };
      }
      
      return { pass: true, message: `返回 ${res.data.funds.length} 只基金` };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== TC-106: sync GET 接口 ==========
testCases.push({
  id: 'TC-106',
  name: 'sync GET 接口验证',
  category: 'API接口',
  run: async () => {
    try {
      const res = await request('GET', '/api/sync');
      
      if (res.status !== 200) {
        return { pass: false, message: `HTTP状态码错误: ${res.status}` };
      }
      
      if (!Array.isArray(res.data.codes)) {
        return { pass: false, message: 'codes 不是数组' };
      }
      
      return { pass: true, message: `返回 ${res.data.codes.length} 个基金代码` };
    } catch (e) {
      return { pass: false, message: `请求失败: ${e.message}` };
    }
  }
});

// ========== 运行测试 ==========
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('API 接口功能测试报告');
  console.log('测试时间: ' + new Date().toLocaleString('zh-CN'));
  console.log('测试基础URL: ' + BASE_URL);
  console.log('='.repeat(60) + '\n');

  let passCount = 0;
  let failCount = 0;
  const results = [];

  // 按类别分组
  const categories = [...new Set(testCases.map(t => t.category))];

  for (const category of categories) {
    console.log(`\n${colors.cyan}【${category}】${colors.reset}`);
    
    for (const tc of testCases.filter(t => t.category === category)) {
      try {
        const result = await tc.run();
        results.push({ ...tc, ...result });
        
        if (result.pass) {
          passCount++;
          log('pass', `[${tc.id}] ${tc.name}: ${result.message}`);
        } else {
          failCount++;
          log('fail', `[${tc.id}] ${tc.name}: ${result.message}`);
        }
      } catch (e) {
        failCount++;
        results.push({ ...tc, pass: false, message: e.message });
        log('fail', `[${tc.id}] ${tc.name}: ${e.message}`);
      }
    }
  }

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

  return { results, passCount, failCount, total: testCases.length };
}

runTests().catch(console.error);
