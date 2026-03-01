/**
 * 股票历史数据服务
 * 用于获取和管理股票历史数据
 * 
 * 功能：
 * 1. 获取单只股票从2024年1月1日至今的历史数据
 * 2. 计算并保存RSI指标
 * 3. 更新RSI统计信息（最高/最低值）
 */

import fs from 'fs';
import path from 'path';
import { calculateMultipleRSI } from './indicators';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

// 起始日期
const START_DATE = '2024-01-01';

/**
 * 根据股票代码获取市场代码（腾讯接口格式）
 */
function getTencentCode(stockCode) {
  if (stockCode.length === 5) return `hk${stockCode}`;
  if (stockCode.startsWith('6')) return `sh${stockCode}`;
  return `sz${stockCode}`;
}

/**
 * 从腾讯接口获取股票历史K线数据
 */
async function fetchHistoryFromTencent(stockCode, startDate = START_DATE) {
  const tencentCode = getTencentCode(stockCode);
  
  // 腾讯日K线接口
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?_=${Date.now()}&secid=${tencentCode.startsWith('hk') ? tencentCode.replace('hk', 'hk.') : (tencentCode.startsWith('sh') ? '1.' + stockCode : '0.' + stockCode)}&fields1=1&fields2=3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23&klt=101&fqt=1&beg=${startDate.replace(/-/g, '')}&end=20500000`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://gu.qq.com/',
      },
    });
    
    const json = await response.json();
    
    // 解析数据
    const data = json.data;
    if (!data) return [];
    
    // 获取K线数据
    const codeKey = Object.keys(data)[0];
    const klineData = data[codeKey]?.day || data[codeKey]?.qfqday || [];
    
    return klineData.map(item => ({
      trade_date: item[0],
      open: parseFloat(item[1]) || 0,
      close: parseFloat(item[2]) || 0,
      high: parseFloat(item[3]) || 0,
      low: parseFloat(item[4]) || 0,
      volume: parseInt(item[5]) || 0,
      amount: parseFloat(item[6]) || 0,
    }));
  } catch (error) {
    console.error(`腾讯接口获取历史数据失败 [${stockCode}]:`, error.message);
    return [];
  }
}

/**
 * 从东方财富接口获取股票历史K线数据（备用）
 */
async function fetchHistoryFromEastMoney(stockCode, startDate = START_DATE) {
  // 判断市场
  let secid;
  if (stockCode.length === 5) {
    secid = `116.${stockCode}`; // 港股
  } else if (stockCode.startsWith('6')) {
    secid = `1.${stockCode}`; // 上海
  } else {
    secid = `0.${stockCode}`; // 深圳
  }
  
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=${startDate.replace(/-/g, '')}&end=20500000`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    
    const json = await response.json();
    const klines = json.data?.klines || [];
    
    return klines.map(line => {
      const parts = line.split(',');
      return {
        trade_date: parts[0],
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseInt(parts[5]) || 0,
        amount: parseFloat(parts[6]) || 0,
      };
    });
  } catch (error) {
    console.error(`东方财富接口获取历史数据失败 [${stockCode}]:`, error.message);
    return [];
  }
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 读取现有历史数据
 */
function readExistingHistory() {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) {
    return { headers: [], records: [] };
  }
  
  let content = fs.readFileSync(STOCK_HISTORY_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return { headers: [], records: [] };
  
  const headers = lines[0].split(',');
  const records = lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');
      return obj;
    });
  
  return { headers, records };
}

/**
 * 保存历史数据到CSV
 */
function saveHistory(records) {
  const headers = 'id,stock_code,stock_name,trade_date,is_open,open,close,high,low,volume,amount,float_cap,turnover_rate,pe_ttm,pb,rsi6,rsi12,rsi24,created_at';
  
  const lines = [headers];
  records.forEach(r => {
    const line = [
      r.id || generateId(),
      r.stock_code,
      r.stock_name || '',
      r.trade_date,
      r.is_open || '1',
      r.open || 0,
      r.close || 0,
      r.high || 0,
      r.low || 0,
      r.volume || 0,
      r.amount || 0,
      r.float_cap || '',
      r.turnover_rate || '',
      r.pe_ttm || '',
      r.pb || '',
      r.rsi6 || '',
      r.rsi12 || '',
      r.rsi24 || '',
      r.created_at || new Date().toISOString(),
    ].join(',');
    lines.push(line);
  });
  
  fs.writeFileSync(STOCK_HISTORY_FILE, lines.join('\n') + '\n', 'utf-8');
}

/**
 * 获取股票历史数据并计算RSI
 * @param {string} stockCode - 股票代码
 * @param {string} stockName - 股票名称
 * @returns {Promise<Object>} 结果对象 { success, message, dataCount, rsiInfo }
 */
export async function fetchStockHistory(stockCode, stockName = '') {
  try {
    // 1. 尝试腾讯接口
    let historyData = await fetchHistoryFromTencent(stockCode);
    
    // 2. 如果腾讯失败，尝试东方财富
    if (historyData.length === 0) {
      historyData = await fetchHistoryFromEastMoney(stockCode);
    }
    
    if (historyData.length === 0) {
      return {
        success: false,
        message: `无法获取股票 ${stockCode} 的历史数据`,
        dataCount: 0,
        rsiInfo: null,
      };
    }
    
    // 3. 计算RSI指标
    const closes = historyData.map(d => d.close);
    const rsiData = calculateMultipleRSI(closes, [6, 12, 24]);
    
    // 4. 合并RSI数据
    historyData.forEach((item, index) => {
      item.rsi6 = rsiData.rsi6[index] || null;
      item.rsi12 = rsiData.rsi12[index] || null;
      item.rsi24 = rsiData.rsi24[index] || null;
      item.stock_name = stockName;
    });
    
    // 5. 读取现有数据，过滤掉该股票的旧数据
    const { records: existingRecords } = readExistingHistory();
    const otherRecords = existingRecords.filter(r => r.stock_code !== stockCode);
    
    // 6. 合并并保存
    const newRecords = historyData.map(item => ({
      ...item,
      id: generateId(),
      created_at: new Date().toISOString(),
    }));
    
    saveHistory([...otherRecords, ...newRecords]);
    
    // 7. 计算RSI统计信息
    const rsi6Values = newRecords
      .filter(r => r.rsi6 !== null && !isNaN(r.rsi6))
      .map(r => parseFloat(r.rsi6));
    
    const rsiInfo = {
      rsi6: newRecords[newRecords.length - 1]?.rsi6 || null,
      rsi6_max: rsi6Values.length > 0 ? Math.max(...rsi6Values) : null,
      rsi6_min: rsi6Values.length > 0 ? Math.min(...rsi6Values) : null,
      data_count: newRecords.length,
      date_range: {
        start: newRecords[0]?.trade_date,
        end: newRecords[newRecords.length - 1]?.trade_date,
      },
    };
    
    return {
      success: true,
      message: `成功获取 ${stockCode} 从 ${START_DATE} 至今共 ${newRecords.length} 条数据`,
      dataCount: newRecords.length,
      rsiInfo,
    };
  } catch (error) {
    console.error(`获取股票历史数据失败 [${stockCode}]:`, error);
    return {
      success: false,
      message: `获取历史数据失败: ${error.message}`,
      dataCount: 0,
      rsiInfo: null,
    };
  }
}

/**
 * 获取股票的RSI统计信息（从已有历史数据）
 * @param {string} stockCode - 股票代码
 * @returns {Object|null} RSI统计信息
 */
export function getStockRSIStats(stockCode) {
  const { records } = readExistingHistory();
  const stockRecords = records
    .filter(r => r.stock_code === stockCode)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  
  if (stockRecords.length === 0) return null;
  
  const latest = stockRecords[stockRecords.length - 1];
  const rsi6Values = stockRecords
    .map(r => parseFloat(r.rsi6))
    .filter(v => !isNaN(v));
  
  return {
    stock_code: stockCode,
    stock_name: latest.stock_name,
    rsi6: parseFloat(latest.rsi6) || null,
    rsi12: parseFloat(latest.rsi12) || null,
    rsi24: parseFloat(latest.rsi24) || null,
    rsi6_max_6m: rsi6Values.length > 0 ? Math.max(...rsi6Values) : null,
    rsi6_min_6m: rsi6Values.length > 0 ? Math.min(...rsi6Values) : null,
    data_count: stockRecords.length,
    latest_date: latest.trade_date,
  };
}

/**
 * 批量获取多只股票的RSI统计信息
 * @param {string[]} stockCodes - 股票代码数组
 * @returns {Map<string, Object>} 股票代码到RSI统计信息的映射
 */
export function batchGetRSIStats(stockCodes) {
  const result = new Map();
  const { records } = readExistingHistory();
  
  stockCodes.forEach(code => {
    const stockRecords = records
      .filter(r => r.stock_code === code)
      .sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    
    if (stockRecords.length === 0) {
      result.set(code, null);
      return;
    }
    
    const latest = stockRecords[stockRecords.length - 1];
    const rsi6Values = stockRecords
      .map(r => parseFloat(r.rsi6))
      .filter(v => !isNaN(v));
    
    result.set(code, {
      stock_code: code,
      stock_name: latest.stock_name,
      rsi6: parseFloat(latest.rsi6) || null,
      rsi12: parseFloat(latest.rsi12) || null,
      rsi24: parseFloat(latest.rsi24) || null,
      rsi6_max_6m: rsi6Values.length > 0 ? Math.max(...rsi6Values) : null,
      rsi6_min_6m: rsi6Values.length > 0 ? Math.min(...rsi6Values) : null,
    });
  });
  
  return result;
}

/**
 * 检查股票历史数据是否存在
 * @param {string} stockCode - 股票代码
 * @returns {boolean} 是否存在历史数据
 */
export function checkStockHistoryExists(stockCode) {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) {
    return false;
  }
  
  const { records } = readExistingHistory();
  return records.some(r => r.stock_code === stockCode);
}
