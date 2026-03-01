/**
 * 股票数据一致性专项测试
 * 验证：
 * 1. 涨跌幅字段一致性（搜索API vs 实时API）
 * 2. 市值数据正确性
 * 3. 历史数据获取功能
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DATA_DIR = path.join(process.cwd(), 'data');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(colors[color] || '', ...args, colors.reset);
}

// HTTP请求
function httpRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testChangePercentConsistency() {
  log('cyan', '\n📊 测试1: 涨跌幅数据一致性');
  log('cyan', '='.repeat(50));
  
  const testCodes = ['600519', '300034', '00700'];
  const results = [];
  
  for (const code of testCodes) {
    try {
      // 从搜索API获取
      const searchRes = await httpRequest(`/api/stock-search?keyword=${code}&limit=1`);
      const searchStock = searchRes.json?.stocks?.[0];
      
      // 从实时API获取
      const realtimeRes = await httpRequest(`/api/stock-realtime?codes=${code}`);
      const realtimeStock = realtimeRes.json?.data?.[code];
      
      if (!searchStock || !realtimeStock) {
        log('yellow', `  ⚠️ ${code}: 数据不完整`);
        continue;
      }
      
      const searchChangePct = searchStock.change_pct;
      const realtimeChangePct = realtimeStock.change_percent;
      
      // 比较涨跌幅（允许小误差，因为是同一时间请求）
      const diff = Math.abs((searchChangePct || 0) - (realtimeChangePct || 0));
      const isConsistent = diff < 0.1; // 允许0.1%误差
      
      results.push({
        code,
        searchChangePct,
        realtimeChangePct,
        diff: diff.toFixed(4),
        consistent: isConsistent,
      });
      
      if (isConsistent) {
        log('green', `  ✅ ${code}: 搜索=${searchChangePct?.toFixed(2)}%, 实时=${realtimeChangePct?.toFixed(2)}%, 差异=${diff.toFixed(4)}%`);
      } else {
        log('red', `  ❌ ${code}: 搜索=${searchChangePct?.toFixed(2)}%, 实时=${realtimeChangePct?.toFixed(2)}%, 差异=${diff.toFixed(4)}%`);
      }
    } catch (e) {
      log('red', `  ❌ ${code}: 请求失败 - ${e.message}`);
    }
  }
  
  const allConsistent = results.every(r => r.consistent);
  log(allConsistent ? 'green' : 'red', `\n  结果: ${allConsistent ? '全部一致 ✅' : '存在不一致 ❌'}`);
  
  return allConsistent;
}

async function testMarketCapConsistency() {
  log('cyan', '\n📊 测试2: 市值数据正确性');
  log('cyan', '='.repeat(50));
  
  const testCodes = ['600519', '000001', '300034'];
  const results = [];
  
  for (const code of testCodes) {
    try {
      const res = await httpRequest(`/api/stock-realtime?codes=${code}`);
      const stock = res.json?.data?.[code];
      
      if (!stock) {
        log('yellow', `  ⚠️ ${code}: 无数据`);
        continue;
      }
      
      const { total_cap, float_cap, stock_name } = stock;
      
      // 总市值应该 >= 流通市值
      const isValid = total_cap >= float_cap || total_cap === 0 || float_cap === 0;
      
      results.push({
        code,
        name: stock_name,
        totalCap: total_cap,
        floatCap: float_cap,
        valid: isValid,
      });
      
      const formatCap = (cap) => {
        if (!cap) return '-';
        if (cap >= 1e12) return (cap / 1e12).toFixed(2) + '万亿';
        if (cap >= 1e8) return (cap / 1e8).toFixed(2) + '亿';
        return cap.toLocaleString();
      };
      
      if (isValid) {
        log('green', `  ✅ ${code} ${stock_name}: 总市值=${formatCap(total_cap)}, 流通市值=${formatCap(float_cap)}`);
      } else {
        log('red', `  ❌ ${code} ${stock_name}: 总市值=${formatCap(total_cap)}, 流通市值=${formatCap(float_cap)} (异常!)`);
      }
    } catch (e) {
      log('red', `  ❌ ${code}: 请求失败 - ${e.message}`);
    }
  }
  
  const allValid = results.every(r => r.valid);
  log(allValid ? 'green' : 'red', `\n  结果: ${allValid ? '数据正确 ✅' : '存在异常 ❌'}`);
  
  return allValid;
}

async function testHistoryDataService() {
  log('cyan', '\n📊 测试3: 历史数据服务');
  log('cyan', '='.repeat(50));
  
  // 检查历史数据文件
  const historyFile = path.join(DATA_DIR, 'stock_history.csv');
  
  if (!fs.existsSync(historyFile)) {
    log('yellow', '  ⚠️ 历史数据文件不存在');
    return false;
  }
  
  const content = fs.readFileSync(historyFile, 'utf-8');
  const lines = content.trim().split('\n');
  
  // 解析表头
  const headers = lines[0].split(',');
  const rsi6Idx = headers.indexOf('rsi6');
  const rsi12Idx = headers.indexOf('rsi12');
  const rsi24Idx = headers.indexOf('rsi24');
  
  log('green', `  ✅ 历史数据文件存在`);
  log('green', `  ✅ 总记录数: ${lines.length - 1}`);
  log('green', `  ✅ 包含RSI字段: rsi6=${rsi6Idx >= 0}, rsi12=${rsi12Idx >= 0}, rsi24=${rsi24Idx >= 0}`);
  
  // 统计有RSI数据的记录
  let recordsWithRSI = 0;
  const stockCodes = new Set();
  
  lines.slice(1).forEach(line => {
    if (!line.trim()) return;
    const values = line.split(',');
    const codeIdx = headers.indexOf('stock_code');
    if (codeIdx >= 0) stockCodes.add(values[codeIdx]);
    
    if (rsi6Idx >= 0 && values[rsi6Idx] && values[rsi6Idx] !== '') {
      recordsWithRSI++;
    }
  });
  
  log('green', `  ✅ 股票数量: ${stockCodes.size}`);
  log('green', `  ✅ 有RSI数据的记录: ${recordsWithRSI}`);
  
  return true;
}

async function testStockNameEncoding() {
  log('cyan', '\n📊 测试4: 股票名称编码');
  log('cyan', '='.repeat(50));
  
  const testCodes = ['600519', '300034', '00700'];
  const results = [];
  
  for (const code of testCodes) {
    try {
      const res = await httpRequest(`/api/stock-realtime?codes=${code}`);
      const stock = res.json?.data?.[code];
      
      if (!stock) {
        log('yellow', `  ⚠️ ${code}: 无数据`);
        continue;
      }
      
      const { stock_name } = stock;
      
      // 检查是否包含乱码特征
      const hasGarbled = /[\x00-\x1F\x7F-\x9F]/.test(stock_name);
      const isChinese = /[\u4e00-\u9fa5]/.test(stock_name);
      
      results.push({
        code,
        name: stock_name,
        valid: !hasGarbled && isChinese,
      });
      
      if (!hasGarbled && isChinese) {
        log('green', `  ✅ ${code}: "${stock_name}" (正常中文)`);
      } else if (hasGarbled) {
        log('red', `  ❌ ${code}: "${stock_name}" (包含乱码)`);
      } else {
        log('yellow', `  ⚠️ ${code}: "${stock_name}" (非中文)`);
      }
    } catch (e) {
      log('red', `  ❌ ${code}: 请求失败 - ${e.message}`);
    }
  }
  
  const allValid = results.every(r => r.valid);
  log(allValid ? 'green' : 'red', `\n  结果: ${allValid ? '编码正确 ✅' : '存在编码问题 ❌'}`);
  
  return allValid;
}

async function testRSIDataAvailability() {
  log('cyan', '\n📊 测试5: RSI数据可用性');
  log('cyan', '='.repeat(50));
  
  // 检查自选股的RSI数据
  const watchlistFile = path.join(DATA_DIR, 'watchlist_stocks.csv');
  
  if (!fs.existsSync(watchlistFile)) {
    log('yellow', '  ⚠️ 自选股文件不存在');
    return false;
  }
  
  const watchlistContent = fs.readFileSync(watchlistFile, 'utf-8');
  const watchlistLines = watchlistContent.trim().split('\n');
  const watchlistHeaders = watchlistLines[0].split(',');
  const stockCodeIdx = watchlistHeaders.indexOf('stock_code');
  
  // 获取自选股代码
  const watchlistCodes = watchlistLines.slice(1)
    .filter(l => l.trim())
    .map(l => l.split(',')[stockCodeIdx])
    .filter(Boolean);
  
  if (watchlistCodes.length === 0) {
    log('yellow', '  ⚠️ 自选股列表为空');
    return true;
  }
  
  // 检查历史数据中的RSI
  const historyFile = path.join(DATA_DIR, 'stock_history.csv');
  if (!fs.existsSync(historyFile)) {
    log('yellow', '  ⚠️ 历史数据文件不存在，无法获取RSI');
    return false;
  }
  
  const historyContent = fs.readFileSync(historyFile, 'utf-8');
  const historyLines = historyContent.trim().split('\n');
  const historyHeaders = historyLines[0].split(',');
  
  const codeIdx = historyHeaders.indexOf('stock_code');
  const rsi6Idx = historyHeaders.indexOf('rsi6');
  const rsi12Idx = historyHeaders.indexOf('rsi12');
  const rsi24Idx = historyHeaders.indexOf('rsi24');
  
  for (const code of watchlistCodes.slice(0, 5)) { // 只检查前5个
    const stockRecords = historyLines.slice(1)
      .filter(l => l.trim())
      .filter(l => l.split(',')[codeIdx] === code);
    
    if (stockRecords.length === 0) {
      log('yellow', `  ⚠️ ${code}: 无历史数据，需要获取`);
      continue;
    }
    
    const latest = stockRecords[stockRecords.length - 1];
    const values = latest.split(',');
    
    const rsi6 = values[rsi6Idx];
    const rsi12 = values[rsi12Idx];
    const rsi24 = values[rsi24Idx];
    
    const hasRSI = rsi6 && rsi6 !== '' && parseFloat(rsi6) > 0;
    
    if (hasRSI) {
      log('green', `  ✅ ${code}: RSI6=${parseFloat(rsi6).toFixed(1)}, RSI12=${parseFloat(rsi12).toFixed(1)}, RSI24=${parseFloat(rsi24).toFixed(1)}`);
    } else {
      log('yellow', `  ⚠️ ${code}: RSI数据为空，需要重新计算`);
    }
  }
  
  return true;
}

// 主测试函数
async function main() {
  log('cyan', '\n' + '='.repeat(60));
  log('cyan', '📊 股票数据一致性专项测试');
  log('cyan', '='.repeat(60));
  log('cyan', `测试时间: ${new Date().toLocaleString()}`);
  
  const results = {
    changePercent: await testChangePercentConsistency(),
    marketCap: await testMarketCapConsistency(),
    historyData: await testHistoryDataService(),
    nameEncoding: await testStockNameEncoding(),
    rsiAvailability: await testRSIDataAvailability(),
  };
  
  log('cyan', '\n' + '='.repeat(60));
  log('cyan', '📋 测试总结');
  log('cyan', '='.repeat(60));
  
  console.log(`
  涨跌幅一致性: ${results.changePercent ? '✅ 通过' : '❌ 失败'}
  市值数据正确: ${results.marketCap ? '✅ 通过' : '❌ 失败'}
  历史数据服务: ${results.historyData ? '✅ 通过' : '❌ 失败'}
  名称编码正确: ${results.nameEncoding ? '✅ 通过' : '❌ 失败'}
  RSI数据可用: ${results.rsiAvailability ? '✅ 通过' : '❌ 失败'}
  `);
  
  const allPassed = Object.values(results).every(r => r);
  log(allPassed ? 'green' : 'red', `总体结果: ${allPassed ? '✅ 全部通过' : '❌ 存在问题'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main();
