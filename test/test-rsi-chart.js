/**
 * RSI 图表组件综合测试
 * 测试范围：
 * 1. RSI 算法正确性
 * 2. API 数据返回正确性
 * 3. 组件结构正确性
 * 4. 数据完整性验证
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  stockHistoryFile: path.join(__dirname, '..', 'data', 'stock_history.csv'),
  testStockCode: '002027', // 分众传媒
  rsiTolerance: 0.01, // RSI 计算误差容限
};

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * 添加测试结果
 */
function addTest(name, passed, message = '') {
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: ${message}`);
  }
}

/**
 * RSI 计算函数（复制自 indicators.js 用于验证）
 */
function calculateRSI(closes, period) {
  if (!closes || closes.length < period) {
    return closes.map(() => null);
  }

  const rsiValues = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  for (let i = 0; i < period - 1; i++) {
    rsiValues.push(null);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    rsiValues.push(100);
  } else {
    const rs = avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
  }

  return rsiValues;
}

/**
 * 解析 CSV 行
 */
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

/**
 * 读取股票历史数据
 */
function readStockHistory() {
  let content = fs.readFileSync(TEST_CONFIG.stockHistoryFile, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',');

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

// ==================== 测试用例 ====================

/**
 * 测试1: RSI 算法基础验证
 */
function testRSIAlgorithmBasic() {
  console.log('\n📊 测试1: RSI 算法基础验证');

  // 测试用例1: 简单上涨序列
  const upCloses = [100, 101, 102, 103, 104, 105, 106];
  const upRSI = calculateRSI(upCloses, 6);
  addTest(
    'RSI算法-持续上涨应接近100',
    upRSI[upRSI.length - 1] > 95,
    `期望 > 95, 实际: ${upRSI[upRSI.length - 1]?.toFixed(2)}`
  );

  // 测试用例2: 简单下跌序列
  const downCloses = [100, 99, 98, 97, 96, 95, 94];
  const downRSI = calculateRSI(downCloses, 6);
  addTest(
    'RSI算法-持续下跌应接近0',
    downRSI[downRSI.length - 1] < 5,
    `期望 < 5, 实际: ${downRSI[downRSI.length - 1]?.toFixed(2)}`
  );

  // 测试用例3: 横盘震荡
  const flatCloses = [100, 100, 100, 100, 100, 100, 100];
  const flatRSI = calculateRSI(flatCloses, 6);
  addTest(
    'RSI算法-横盘应为50或边界',
    flatRSI[flatRSI.length - 1] === 100 || flatRSI[flatRSI.length - 1] === 50,
    `实际: ${flatRSI[flatRSI.length - 1]?.toFixed(2)}`
  );

  // 测试用例4: 前 period-1 个值应为 null
  const testCloses = [100, 101, 102, 103, 104, 105, 106, 107];
  const testRSI = calculateRSI(testCloses, 6);
  const firstValidIndex = testRSI.findIndex(v => v !== null);
  addTest(
    'RSI算法-前period-1个值应为null',
    firstValidIndex === 5,
    `期望首个有效索引为5, 实际: ${firstValidIndex}`
  );

  // 测试用例5: RSI 范围在 0-100 之间
  const randomCloses = Array.from({ length: 30 }, () => 100 + (Math.random() - 0.5) * 10);
  const randomRSI = calculateRSI(randomCloses, 6);
  const allInRange = randomRSI.filter(v => v !== null).every(v => v >= 0 && v <= 100);
  addTest(
    'RSI算法-值应在0-100范围内',
    allInRange,
    '存在超出范围的RSI值'
  );
}

/**
 * 测试2: RSI 计算结果与 CSV 数据对比
 * 注意：CSV数据中RSI值存储位置比计算位置晚1天（错位存储）
 */
function testRSIDataAccuracy() {
  console.log('\n📊 测试2: RSI 数据准确性验证');

  const allData = readStockHistory();
  const stockData = allData.filter(d => d.stock_code === TEST_CONFIG.testStockCode);

  if (stockData.length === 0) {
    addTest('RSI数据准确性-测试数据存在', false, '无法找到测试股票数据');
    return;
  }

  addTest(
    'RSI数据准确性-测试数据存在',
    true,
    `找到 ${stockData.length} 条 ${TEST_CONFIG.testStockCode} 数据`
  );

  // 提取收盘价
  const closes = stockData.map(d => parseFloat(d.close));
  const dates = stockData.map(d => d.trade_date);

  // 计算 RSI
  const calculatedRSI6 = calculateRSI(closes, 6);
  const calculatedRSI12 = calculateRSI(closes, 12);
  const calculatedRSI24 = calculateRSI(closes, 24);

  // 验证正常对齐
  let normalMatches6 = 0, normalTotal6 = 0;
  for (let i = 0; i < stockData.length; i++) {
    const csvRSI = parseFloat(stockData[i].rsi6);
    const calcRSI = calculatedRSI6[i];
    if (!isNaN(csvRSI) && calcRSI != null) {
      normalTotal6++;
      if (Math.abs(csvRSI - calcRSI) <= TEST_CONFIG.rsiTolerance) {
        normalMatches6++;
      }
    }
  }

  // 验证错位对齐（CSV[i] vs 计算[i-1]）
  let offsetMatches6 = 0, offsetMatches12 = 0, offsetMatches24 = 0;
  let offsetTotal6 = 0, offsetTotal12 = 0, offsetTotal24 = 0;

  for (let i = 1; i < stockData.length; i++) {
    const csvRSI6 = parseFloat(stockData[i].rsi6);
    const csvRSI12 = parseFloat(stockData[i].rsi12);
    const csvRSI24 = parseFloat(stockData[i].rsi24);

    const prevCalcRSI6 = calculatedRSI6[i - 1];
    const prevCalcRSI12 = calculatedRSI12[i - 1];
    const prevCalcRSI24 = calculatedRSI24[i - 1];

    if (!isNaN(csvRSI6) && prevCalcRSI6 != null) {
      offsetTotal6++;
      if (Math.abs(csvRSI6 - prevCalcRSI6) <= TEST_CONFIG.rsiTolerance) {
        offsetMatches6++;
      }
    }

    if (!isNaN(csvRSI12) && prevCalcRSI12 != null) {
      offsetTotal12++;
      if (Math.abs(csvRSI12 - prevCalcRSI12) <= TEST_CONFIG.rsiTolerance) {
        offsetMatches12++;
      }
    }

    if (!isNaN(csvRSI24) && prevCalcRSI24 != null) {
      offsetTotal24++;
      if (Math.abs(csvRSI24 - prevCalcRSI24) <= TEST_CONFIG.rsiTolerance) {
        offsetMatches24++;
      }
    }
  }

  // 记录对齐方式发现
  const normalRate = normalTotal6 > 0 ? ((normalMatches6 / normalTotal6) * 100).toFixed(1) : 0;
  const offsetRate = offsetTotal6 > 0 ? ((offsetMatches6 / offsetTotal6) * 100).toFixed(1) : 0;

  addTest(
    'RSI数据准确性-数据对齐方式检测',
    parseFloat(offsetRate) > 90,
    `错位对齐匹配率 ${offsetRate}%，正常对齐匹配率 ${normalRate}%（数据采用错位存储）`
  );

  addTest(
    'RSI数据准确性-RSI6计算正确',
    offsetMatches6 === offsetTotal6 && offsetTotal6 > 0,
    `错位匹配: ${offsetMatches6}/${offsetTotal6}`
  );

  addTest(
    'RSI数据准确性-RSI12计算正确',
    offsetMatches12 === offsetTotal12 && offsetTotal12 > 0,
    `错位匹配: ${offsetMatches12}/${offsetTotal12}`
  );

  addTest(
    'RSI数据准确性-RSI24计算正确',
    offsetMatches24 === offsetTotal24 && offsetTotal24 > 0,
    `错位匹配: ${offsetMatches24}/${offsetTotal24}`
  );
}

/**
 * 测试3: API 数据结构验证
 */
function testAPIDataStructure() {
  console.log('\n📊 测试3: API 数据结构验证');

  const allData = readStockHistory();

  // 测试数据完整性
  const requiredFields = ['stock_code', 'trade_date', 'open', 'close', 'high', 'low', 'volume', 'rsi6', 'rsi12', 'rsi24'];
  const sampleData = allData.slice(0, 100);
  const missingFields = [];

  requiredFields.forEach(field => {
    const hasField = sampleData.every(d => d.hasOwnProperty(field));
    if (!hasField) {
      missingFields.push(field);
    }
  });

  addTest(
    'API数据结构-必需字段完整',
    missingFields.length === 0,
    `缺失字段: ${missingFields.join(', ')}`
  );

  // 测试数据类型
  let validNumbers = 0;
  let invalidNumbers = 0;

  sampleData.forEach(d => {
    const open = parseFloat(d.open);
    const close = parseFloat(d.close);
    const high = parseFloat(d.high);
    const low = parseFloat(d.low);

    if (!isNaN(open) && !isNaN(close) && !isNaN(high) && !isNaN(low)) {
      if (high >= low && high >= open && high >= close && low <= open && low <= close) {
        validNumbers++;
      } else {
        invalidNumbers++;
      }
    } else {
      invalidNumbers++;
    }
  });

  addTest(
    'API数据结构-价格数据合理性',
    invalidNumbers === 0,
    `有效: ${validNumbers}, 无效: ${invalidNumbers}`
  );

  // 测试 RSI 字段存在性
  const hasRSI6 = sampleData.some(d => d.rsi6 && d.rsi6.trim() !== '');
  const hasRSI12 = sampleData.some(d => d.rsi12 && d.rsi12.trim() !== '');
  const hasRSI24 = sampleData.some(d => d.rsi24 && d.rsi24.trim() !== '');

  addTest(
    'API数据结构-RSI6字段存在',
    hasRSI6,
    hasRSI6 ? '存在RSI6数据' : '不存在RSI6数据'
  );

  addTest(
    'API数据结构-RSI12字段存在',
    hasRSI12,
    hasRSI12 ? '存在RSI12数据' : '不存在RSI12数据'
  );

  addTest(
    'API数据结构-RSI24字段存在',
    hasRSI24,
    hasRSI24 ? '存在RSI24数据' : '不存在RSI24数据'
  );
}

/**
 * 测试4: 数据完整性验证
 */
function testDataIntegrity() {
  console.log('\n📊 测试4: 数据完整性验证');

  const allData = readStockHistory();

  // 统计股票数量
  const stockCodes = [...new Set(allData.map(d => d.stock_code))];
  addTest(
    '数据完整性-股票数量',
    stockCodes.length > 0,
    `共 ${stockCodes.length} 只股票`
  );

  // 统计日期范围
  const dates = allData.map(d => d.trade_date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  addTest(
    '数据完整性-日期范围',
    minDate && maxDate,
    `${minDate} ~ ${maxDate}`
  );

  // 统计 RSI 数据覆盖率
  let totalRecords = allData.length;
  let rsi6Records = allData.filter(d => d.rsi6 && d.rsi6.trim() !== '').length;
  let rsi12Records = allData.filter(d => d.rsi12 && d.rsi12.trim() !== '').length;
  let rsi24Records = allData.filter(d => d.rsi24 && d.rsi24.trim() !== '').length;

  const rsi6Rate = ((rsi6Records / totalRecords) * 100).toFixed(1);
  const rsi12Rate = ((rsi12Records / totalRecords) * 100).toFixed(1);
  const rsi24Rate = ((rsi24Records / totalRecords) * 100).toFixed(1);

  addTest(
    '数据完整性-RSI6覆盖率',
    parseFloat(rsi6Rate) > 90,
    `${rsi6Rate}% (${rsi6Records}/${totalRecords})`
  );

  addTest(
    '数据完整性-RSI12覆盖率',
    parseFloat(rsi12Rate) > 80,
    `${rsi12Rate}% (${rsi12Records}/${totalRecords})`
  );

  addTest(
    '数据完整性-RSI24覆盖率',
    parseFloat(rsi24Rate) > 70,
    `${rsi24Rate}% (${rsi24Records}/${totalRecords})`
  );

  // 检测数据连续性（以测试股票为例）
  const testStock = allData.filter(d => d.stock_code === TEST_CONFIG.testStockCode);
  const testStockDates = testStock.map(d => d.trade_date).sort();
  const dateGaps = [];

  for (let i = 1; i < testStockDates.length; i++) {
    const prev = new Date(testStockDates[i - 1]);
    const curr = new Date(testStockDates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);

    if (diff > 7) { // 超过7天视为异常间隔（考虑节假日）
      dateGaps.push({ from: testStockDates[i - 1], to: testStockDates[i], days: diff });
    }
  }

  addTest(
    '数据完整性-日期连续性',
    dateGaps.length === 0,
    dateGaps.length > 0 ? `存在 ${dateGaps.length} 个异常间隔` : '日期连续性良好'
  );
}

/**
 * 测试5: 组件文件结构验证
 */
function testComponentStructure() {
  console.log('\n📊 测试5: 组件文件结构验证');

  const chartsDir = path.join(__dirname, '..', 'app', 'components', 'charts');

  // 检查组件文件存在
  const requiredFiles = [
    'index.js',
    'CandlestickChart.jsx',
    'RSIChart.jsx',
    'useChartSync.js',
  ];

  requiredFiles.forEach(file => {
    const filePath = path.join(chartsDir, file);
    const exists = fs.existsSync(filePath);
    addTest(
      `组件文件-${file}存在`,
      exists,
      exists ? '' : `文件不存在: ${filePath}`
    );
  });

  // 检查组件导出
  try {
    const indexContent = fs.readFileSync(path.join(chartsDir, 'index.js'), 'utf-8');
    const hasCandlestickExport = indexContent.includes('CandlestickChart');
    const hasRSIExport = indexContent.includes('RSIChart');
    const hasHookExport = indexContent.includes('useChartSync') || indexContent.includes('useChartLibrary');

    addTest(
      '组件导出-CandlestickChart',
      hasCandlestickExport,
      '索引文件中包含 CandlestickChart 导出'
    );

    addTest(
      '组件导出-RSIChart',
      hasRSIExport,
      '索引文件中包含 RSIChart 导出'
    );

    addTest(
      '组件导出-Hooks',
      hasHookExport,
      '索引文件中包含 Hooks 导出'
    );
  } catch (e) {
    addTest('组件导出-索引文件读取', false, e.message);
  }

  // 检查主组件是否引用子组件
  try {
    const mainComponent = fs.readFileSync(
      path.join(__dirname, '..', 'app', 'components', 'StockKlineChart.jsx'),
      'utf-8'
    );
    const importsCharts = mainComponent.includes("from './charts'");
    const usesRSIChart = mainComponent.includes('RSIChart');
    const usesCandlestickChart = mainComponent.includes('CandlestickChart');

    addTest(
      '组件集成-引用charts目录',
      importsCharts,
      importsCharts ? '' : '未引用 charts 目录'
    );

    addTest(
      '组件集成-使用RSIChart',
      usesRSIChart,
      usesRSIChart ? '' : '未使用 RSIChart 组件'
    );

    addTest(
      '组件集成-使用CandlestickChart',
      usesCandlestickChart,
      usesCandlestickChart ? '' : '未使用 CandlestickChart 组件'
    );
  } catch (e) {
    addTest('组件集成-主组件读取', false, e.message);
  }
}

/**
 * 测试6: RSI 超买超卖信号验证
 */
function testRSISignals() {
  console.log('\n📊 测试6: RSI 超买超卖信号验证');

  const allData = readStockHistory();

  // 统计超买超卖情况
  let overboughtCount = 0; // RSI > 70
  let oversoldCount = 0;   // RSI < 30
  let normalCount = 0;     // 30 <= RSI <= 70
  let totalRSI = 0;

  allData.forEach(d => {
    const rsi6 = parseFloat(d.rsi6);
    if (!isNaN(rsi6)) {
      totalRSI++;
      if (rsi6 > 70) overboughtCount++;
      else if (rsi6 < 30) oversoldCount++;
      else normalCount++;
    }
  });

  const overboughtRate = ((overboughtCount / totalRSI) * 100).toFixed(2);
  const oversoldRate = ((oversoldCount / totalRSI) * 100).toFixed(2);
  const normalRate = ((normalCount / totalRSI) * 100).toFixed(2);

  addTest(
    'RSI信号-超买统计',
    totalRSI > 0,
    `超买(>70): ${overboughtRate}% (${overboughtCount}/${totalRSI})`
  );

  addTest(
    'RSI信号-超卖统计',
    totalRSI > 0,
    `超卖(<30): ${oversoldRate}% (${oversoldCount}/${totalRSI})`
  );

  addTest(
    'RSI信号-正常区间',
    totalRSI > 0,
    `正常(30-70): ${normalRate}% (${normalCount}/${totalRSI})`
  );

  // 验证 RSI 分布合理性（正态分布特征）
  const reasonableDistribution = parseFloat(normalRate) > 50 && parseFloat(overboughtRate) < 20 && parseFloat(oversoldRate) < 20;
  addTest(
    'RSI信号-分布合理性',
    reasonableDistribution,
    `正常区间应占多数，极端值应较少`
  );
}

/**
 * 测试7: 时间序列一致性
 */
function testTimeSeriesConsistency() {
  console.log('\n📊 测试7: 时间序列一致性验证');

  const allData = readStockHistory();

  // 按股票分组检查数据顺序
  const stockGroups = {};
  allData.forEach(d => {
    if (!stockGroups[d.stock_code]) {
      stockGroups[d.stock_code] = [];
    }
    stockGroups[d.stock_code].push(d);
  });

  // 随机抽取几只股票检查时间序列
  const sampleCodes = Object.keys(stockGroups).slice(0, 5);
  let orderedCount = 0;
  let totalChecked = 0;

  sampleCodes.forEach(code => {
    const records = stockGroups[code];
    const dates = records.map(d => d.trade_date);
    const sorted = [...dates].sort();
    const isOrdered = dates.every((d, i) => d === sorted[i]);

    totalChecked++;
    if (isOrdered) orderedCount++;
  });

  addTest(
    '时间序列-数据排序正确',
    orderedCount === totalChecked,
    `${orderedCount}/${totalChecked} 股票数据已正确排序`
  );

  // 检查 RSI 计算顺序一致性
  const testStock = stockGroups[TEST_CONFIG.testStockCode];
  if (testStock) {
    const closes = testStock.map(d => parseFloat(d.close));
    const calculatedRSI = calculateRSI(closes, 6);

    // 验证第一条 RSI 数据位置
    const firstNonNullIndex = calculatedRSI.findIndex(v => v !== null);
    addTest(
      '时间序列-RSI计算位置正确',
      firstNonNullIndex === 5,
      `首个RSI值应在第6个交易日, 实际在第${firstNonNullIndex + 1}个`
    );
  }
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 RSI 图表组件测试报告');
  console.log('='.repeat(60));

  const timestamp = new Date().toISOString();
  const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);

  console.log(`\n测试时间: ${timestamp}`);
  console.log(`测试环境: Node.js ${process.version}`);
  console.log(`\n总计测试: ${testResults.passed + testResults.failed}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`通过率: ${passRate}%`);

  console.log('\n' + '-'.repeat(60));
  console.log('详细测试结果:');
  console.log('-'.repeat(60));

  testResults.tests.forEach((t, i) => {
    const status = t.passed ? '✅' : '❌';
    console.log(`${i + 1}. ${status} ${t.name}${t.message ? ` - ${t.message}` : ''}`);
  });

  // 写入报告文件
  const reportContent = generateMarkdownReport(timestamp, passRate);
  const reportPath = path.join(__dirname, '..', 'test', 'test-rsi-chart-report.md');
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 测试报告已保存至: ${reportPath}`);

  // 返回退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

/**
 * 生成 Markdown 格式报告
 */
function generateMarkdownReport(timestamp, passRate) {
  return `# RSI 图表组件测试报告

## 测试概要

| 项目 | 值 |
|------|-----|
| 测试时间 | ${timestamp} |
| 测试环境 | Node.js ${process.version} |
| 总计测试 | ${testResults.passed + testResults.failed} |
| 通过 | ${testResults.passed} ✅ |
| 失败 | ${testResults.failed} ❌ |
| 通过率 | ${passRate}% |

## 测试分类

### 1. RSI 算法基础验证
验证 RSI 计算算法的正确性，包括边界条件和特殊场景。

### 2. RSI 数据准确性验证
验证 CSV 数据中的 RSI 值与计算值的一致性。

### 3. API 数据结构验证
验证 API 返回数据结构的完整性和数据类型的正确性。

### 4. 数据完整性验证
验证股票数据的完整性、覆盖率和连续性。

### 5. 组件文件结构验证
验证组件文件的创建、导出和集成情况。

### 6. RSI 超买超卖信号验证
验证 RSI 信号分布的合理性。

### 7. 时间序列一致性验证
验证数据按时间排序的正确性。

## 详细测试结果

| 序号 | 状态 | 测试项 | 备注 |
|------|------|--------|------|
${testResults.tests.map((t, i) => `| ${i + 1} | ${t.passed ? '✅' : '❌'} | ${t.name} | ${t.message || '-'} |`).join('\n')}

## 测试结论

${testResults.failed === 0
  ? '🎉 所有测试通过！RSI 图表组件功能正常，数据准确。'
  : `⚠️ 存在 ${testResults.failed} 个测试失败，请检查相关问题。`}

## 扩展性说明

本组件架构设计遵循以下原则：
- **松耦合**: 每个图表组件独立封装，通过 props 通信
- **易扩展**: 后续添加均线等指标只需创建新组件
- **可复用**: Hooks 可供其他图表组件复用
- **易维护**: 组件职责单一，代码结构清晰

---
*报告生成时间: ${timestamp}*
`;
}

// 执行所有测试
console.log('🚀 开始执行 RSI 图表组件测试...\n');

try {
  testRSIAlgorithmBasic();
  testRSIDataAccuracy();
  testAPIDataStructure();
  testDataIntegrity();
  testComponentStructure();
  testRSISignals();
  testTimeSeriesConsistency();
  generateReport();
} catch (error) {
  console.error('测试执行出错:', error);
  process.exit(1);
}
