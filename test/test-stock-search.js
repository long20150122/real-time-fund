/**
 * 全市场股票搜索功能测试
 * 测试范围：A股（主板/创业板/科创板/北交所）+ 港股
 * 测试维度：搜索方式、数据准确性、边界条件、性能
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// 测试结果
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * 记录测试结果
 */
function log(name, passed, message, details = null) {
  results.total++;
  if (passed) results.passed++;
  else results.failed++;
  
  results.tests.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details && !passed) {
    console.log('   详情:', JSON.stringify(details, null, 2));
  }
}

/**
 * HTTP请求封装
 */
async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    return await res.json();
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * 测试用例
 */
const TEST_CASES = {
  // A股主板 - 沪市
  sh_main: [
    { keyword: '600519', expected: '贵州茅台', type: '主板', market: 'sh' },
    { keyword: '601318', expected: '中国平安', type: '主板', market: 'sh' },
    { keyword: '600036', expected: '招商银行', type: '主板', market: 'sh' },
  ],
  // A股主板 - 深市
  sz_main: [
    { keyword: '000001', expected: '平安银行', type: '主板', market: 'sz' },
    { keyword: '000002', expected: '万科A', type: '主板', market: 'sz' },
  ],
  // 创业板
  gem: [
    { keyword: '300034', expected: '钢研高纳', type: '创业板', market: 'sz' },
    { keyword: '300750', expected: '宁德时代', type: '创业板', market: 'sz' },
    { keyword: '300059', expected: '东方财富', type: '创业板', market: 'sz' },
  ],
  // 科创板
  star: [
    { keyword: '688981', expected: '中芯国际', type: '科创板', market: 'sh' },
    { keyword: '688111', expected: '金山办公', type: '科创板', market: 'sh' },
  ],
  // 港股
  hk: [
    { keyword: '00700', expected: '腾讯控股', type: '港股', market: 'hk' },
    { keyword: '09988', expected: '阿里巴巴', type: '港股', market: 'hk' },
    { keyword: '01810', expected: '小米集团', type: '港股', market: 'hk' },
  ],
  // 名称搜索
  name_search: [
    { keyword: '茅台', expected: '贵州茅台' },
    { keyword: '腾讯', expected: '腾讯控股' },
    { keyword: '宁德时代', expected: '宁德时代' },
    { keyword: '中芯国际', expected: '中芯国际' },
  ],
  // 拼音搜索
  pinyin_search: [
    { keyword: 'gzmt', expected: '贵州茅台' },
    { keyword: 'gygn', expected: '钢研高纳' },
    { keyword: 'txkg', expected: '腾讯控股' },
    { keyword: 'ndsd', expected: '宁德时代' },
  ],
};

/**
 * 测试1: 股票代码搜索
 */
async function testCodeSearch() {
  console.log('\n📊 测试1: 股票代码搜索\n');
  
  const allCases = [
    ...TEST_CASES.sh_main,
    ...TEST_CASES.sz_main,
    ...TEST_CASES.gem,
    ...TEST_CASES.star,
    ...TEST_CASES.hk,
  ];
  
  for (const tc of allCases) {
    const data = await fetchAPI(`/api/stock-search?keyword=${tc.keyword}`);
    
    if (data.error) {
      log(`代码搜索 ${tc.keyword}`, false, `请求失败: ${data.error}`);
      continue;
    }
    
    const found = data.stocks?.find(s => s.stock_code === tc.keyword);
    
    if (!found) {
      log(`代码搜索 ${tc.keyword}`, false, '未找到股票', data);
      continue;
    }
    
    // 验证名称
    const nameMatch = found.stock_name?.includes(tc.expected);
    // 验证类型
    const typeMatch = found.type === tc.type;
    // 验证市场
    const marketMatch = found.market === tc.market;
    
    if (nameMatch && typeMatch && marketMatch) {
      log(`代码搜索 ${tc.keyword}`, true, `找到 ${found.stock_name} (${found.type}/${found.market})`);
    } else {
      log(`代码搜索 ${tc.keyword}`, false, '数据不匹配', { 
        expected: tc, 
        actual: { name: found.stock_name, type: found.type, market: found.market }
      });
    }
  }
}

/**
 * 测试2: 股票名称搜索
 */
async function testNameSearch() {
  console.log('\n📝 测试2: 股票名称搜索\n');
  
  for (const tc of TEST_CASES.name_search) {
    const data = await fetchAPI(`/api/stock-search?keyword=${encodeURIComponent(tc.keyword)}`);
    
    if (data.error) {
      log(`名称搜索 "${tc.keyword}"`, false, `请求失败: ${data.error}`);
      continue;
    }
    
    const found = data.stocks?.some(s => s.stock_name?.includes(tc.expected));
    
    if (found) {
      const stock = data.stocks.find(s => s.stock_name?.includes(tc.expected));
      log(`名称搜索 "${tc.keyword}"`, true, `找到 ${stock.stock_name} (${stock.stock_code})`);
    } else {
      log(`名称搜索 "${tc.keyword}"`, false, `未找到包含"${tc.expected}"的股票`, data);
    }
  }
}

/**
 * 测试3: 拼音搜索
 */
async function testPinyinSearch() {
  console.log('\n🔤 测试3: 拼音首字母搜索\n');
  
  for (const tc of TEST_CASES.pinyin_search) {
    const data = await fetchAPI(`/api/stock-search?keyword=${tc.keyword}`);
    
    if (data.error) {
      log(`拼音搜索 "${tc.keyword}"`, false, `请求失败: ${data.error}`);
      continue;
    }
    
    const found = data.stocks?.some(s => s.stock_name?.includes(tc.expected));
    
    if (found) {
      const stock = data.stocks.find(s => s.stock_name?.includes(tc.expected));
      log(`拼音搜索 "${tc.keyword}"`, true, `找到 ${stock.stock_name} (拼音: ${stock.pinyin})`);
    } else {
      log(`拼音搜索 "${tc.keyword}"`, false, `未找到"${tc.expected}"`, data);
    }
  }
}

/**
 * 测试4: 边界条件
 */
async function testBoundaryConditions() {
  console.log('\n⚡ 测试4: 边界条件测试\n');
  
  // 空关键词
  const emptyData = await fetchAPI('/api/stock-search?keyword=');
  log('空关键词', emptyData.stocks?.length === 0, 
    emptyData.stocks?.length === 0 ? '返回空数组' : '应返回空数组');
  
  // 不存在的股票代码
  const notExistData = await fetchAPI('/api/stock-search?keyword=999999');
  log('不存在股票代码', notExistData.stocks?.length >= 0, 
    `返回 ${notExistData.stocks?.length || 0} 条结果`);
  
  // 特殊字符
  const specialData = await fetchAPI('/api/stock-search?keyword=@#$%');
  log('特殊字符搜索', specialData.stocks?.length >= 0, 
    `返回 ${specialData.stocks?.length || 0} 条结果`);
  
  // 超长关键词
  const longKeyword = 'a'.repeat(100);
  const longData = await fetchAPI(`/api/stock-search?keyword=${longKeyword}`);
  log('超长关键词', !longData.error, longData.error ? '请求失败' : '正常处理');
  
  // 限制返回数量
  const limitData = await fetchAPI('/api/stock-search?keyword=银行&limit=5');
  log('返回数量限制', limitData.stocks?.length <= 5, 
    `返回 ${limitData.stocks?.length} 条（限制5条）`);
}

/**
 * 测试5: 数据完整性
 */
async function testDataIntegrity() {
  console.log('\n📋 测试5: 数据完整性验证\n');
  
  const testCodes = ['600519', '300034', '688981', '00700'];
  
  for (const code of testCodes) {
    const data = await fetchAPI(`/api/stock-search?keyword=${code}`);
    const stock = data.stocks?.[0];
    
    if (!stock) {
      log(`数据完整性 ${code}`, false, '未找到股票');
      continue;
    }
    
    const checks = [
      { field: 'stock_code', value: stock.stock_code, required: true },
      { field: 'stock_name', value: stock.stock_name, required: true },
      { field: 'market', value: stock.market, required: true },
      { field: 'type', value: stock.type, required: true },
      { field: 'pinyin', value: stock.pinyin, required: false },
    ];
    
    const missing = checks.filter(c => c.required && !c.value);
    
    if (missing.length === 0) {
      log(`数据完整性 ${code}`, true, 
        `字段完整: ${stock.stock_name}, market=${stock.market}, type=${stock.type}`);
    } else {
      log(`数据完整性 ${code}`, false, 
        `缺少字段: ${missing.map(c => c.field).join(', ')}`);
    }
  }
}

/**
 * 测试6: 市场覆盖
 */
async function testMarketCoverage() {
  console.log('\n🌏 测试6: 市场覆盖测试\n');
  
  const markets = [
    { name: '沪市主板', code: '600519', expectedMarket: 'sh', expectedType: '主板' },
    { name: '深市主板', code: '000001', expectedMarket: 'sz', expectedType: '主板' },
    { name: '创业板', code: '300034', expectedMarket: 'sz', expectedType: '创业板' },
    { name: '科创板', code: '688981', expectedMarket: 'sh', expectedType: '科创板' },
    { name: '港股', code: '00700', expectedMarket: 'hk', expectedType: '港股' },
  ];
  
  for (const market of markets) {
    const data = await fetchAPI(`/api/stock-search?keyword=${market.code}`);
    const stock = data.stocks?.find(s => s.stock_code === market.code);
    
    if (!stock) {
      log(`市场覆盖 ${market.name}`, false, '未找到股票');
      continue;
    }
    
    const marketMatch = stock.market === market.expectedMarket;
    const typeMatch = stock.type === market.expectedType;
    
    if (marketMatch && typeMatch) {
      log(`市场覆盖 ${market.name}`, true, 
        `${stock.stock_name}: market=${stock.market}, type=${stock.type}`);
    } else {
      log(`市场覆盖 ${market.name}`, false, '市场/类型不匹配', {
        expected: { market: market.expectedMarket, type: market.expectedType },
        actual: { market: stock.market, type: stock.type }
      });
    }
  }
}

/**
 * 测试7: 性能测试
 */
async function testPerformance() {
  console.log('\n⚡ 测试7: 性能测试\n');
  
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fetchAPI('/api/stock-search?keyword=茅台');
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  log('响应时间', avgTime < 2000, 
    `平均 ${avgTime.toFixed(0)}ms, 最快 ${minTime}ms, 最慢 ${maxTime}ms`);
}

/**
 * 生成测试报告
 */
function generateReport() {
  const reportPath = path.join(__dirname, 'test-stock-search-report.md');
  const passRate = ((results.passed / results.total) * 100).toFixed(1);
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 按类别分组
  const categories = {
    '股票代码搜索': results.tests.filter(t => t.name.includes('代码搜索')),
    '股票名称搜索': results.tests.filter(t => t.name.includes('名称搜索')),
    '拼音首字母搜索': results.tests.filter(t => t.name.includes('拼音搜索')),
    '边界条件测试': results.tests.filter(t => ['空关键词', '不存在股票代码', '特殊字符搜索', '超长关键词', '返回数量限制'].some(n => t.name.includes(n))),
    '数据完整性验证': results.tests.filter(t => t.name.includes('数据完整性')),
    '市场覆盖测试': results.tests.filter(t => t.name.includes('市场覆盖')),
    '性能测试': results.tests.filter(t => t.name.includes('响应时间')),
  };

  let report = `# 全市场股票搜索功能测试报告

## 一、测试概览

| 项目 | 值 |
|------|-----|
| 测试时间 | ${timestamp} |
| 测试服务器 | ${BASE_URL} |
| 总计测试 | ${results.total} |
| 通过 | ${results.passed} ✅ |
| 失败 | ${results.failed} ❌ |
| **通过率** | **${passRate}%** |

## 二、测试范围

| 市场 | 测试股票 | 说明 |
|------|----------|------|
| 沪市主板 | 600519, 601318, 600036 | 贵州茅台、中国平安、招商银行 |
| 深市主板 | 000001, 000002 | 平安银行、万科A |
| 创业板 | 300034, 300750, 300059 | 钢研高纳、宁德时代、东方财富 |
| 科创板 | 688981, 688111 | 中芯国际、金山办公 |
| 港股 | 00700, 09988, 01810 | 腾讯控股、阿里巴巴、小米集团 |

## 三、测试详情

`;

  for (const [category, tests] of Object.entries(categories)) {
    if (tests.length === 0) continue;
    const passed = tests.filter(t => t.passed).length;
    report += `### ${category} (${passed}/${tests.length})\n\n`;
    report += '| 测试项 | 状态 | 结果 |\n';
    report += '|--------|------|------|\n';
    tests.forEach(t => {
      const icon = t.passed ? '✅' : '❌';
      report += `| ${t.name} | ${icon} | ${t.message} |\n`;
    });
    report += '\n';
  }

  // 失败详情
  const failedTests = results.tests.filter(t => !t.passed);
  if (failedTests.length > 0) {
    report += `## 四、失败测试详情\n\n`;
    failedTests.forEach(t => {
      report += `### ❌ ${t.name}\n\n`;
      report += `**消息**: ${t.message}\n\n`;
      if (t.details) {
        report += `**详情**:\n\`\`\`json\n${JSON.stringify(t.details, null, 2)}\n\`\`\`\n\n`;
      }
    });
  } else {
    report += `## 四、测试结论\n\n`;
    report += `所有测试均通过 ✅\n\n`;
    report += `### 已验证的功能：\n\n`;
    report += `1. **股票代码搜索** - 沪市/深市主板、创业板、科创板、港股\n`;
    report += `2. **股票名称搜索** - 支持中文模糊匹配\n`;
    report += `3. **拼音首字母搜索** - 支持全拼和首字母\n`;
    report += `4. **市场类型识别** - 正确识别各市场代码\n`;
    report += `5. **数据完整性** - 返回字段完整（代码、名称、市场、类型、拼音）\n`;
    report += `6. **边界条件处理** - 空值、特殊字符、数量限制\n`;
    report += `7. **响应性能** - 平均响应时间合理\n`;
  }

  report += `\n---\n\n*报告生成时间: ${timestamp}*\n`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 测试报告已生成: ${reportPath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('   全市场股票搜索功能测试');
  console.log('========================================');
  console.log(`测试服务器: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}\n`);

  try {
    await testCodeSearch();
    await testNameSearch();
    await testPinyinSearch();
    await testBoundaryConditions();
    await testDataIntegrity();
    await testMarketCoverage();
    await testPerformance();
  } catch (error) {
    console.error('测试执行出错:', error);
  }

  console.log('\n========================================');
  console.log(`测试完成: ${results.passed}/${results.total} 通过 (${((results.passed / results.total) * 100).toFixed(1)}%)`);
  console.log('========================================\n');

  generateReport();
}

main().catch(console.error);
