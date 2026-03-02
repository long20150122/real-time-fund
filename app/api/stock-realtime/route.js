import { NextResponse } from 'next/server';
import { getTencentCode } from '../../lib/stockDataUtils';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

/**
 * 判断当前是否为交易时间（周一至周五 9:30-15:00）
 */
function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeNum = hour * 100 + minute;
  
  // 周末不是交易时间
  if (day === 0 || day === 6) return false;
  
  // 9:30 - 11:30, 13:00 - 15:00
  if (timeNum >= 930 && timeNum <= 1130) return true;
  if (timeNum >= 1300 && timeNum <= 1500) return true;
  
  return false;
}

/**
 * 从 stock_history.csv 获取股票最新数据
 */
function getLatestStockData(stockCodes) {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) return {};
  
  let content = fs.readFileSync(STOCK_HISTORY_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return {};
  
  const headers = lines[0].split(',');
  const codeSet = new Set(stockCodes);
  
  // 收集每只股票的最新数据
  const stockDataMap = {};
  
  lines.slice(1).forEach(line => {
    if (!line.trim()) return;
    
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    
    if (!codeSet.has(obj.stock_code)) return;
    
    // 如果已有该股票数据，比较日期
    if (!stockDataMap[obj.stock_code] || 
        obj.trade_date > stockDataMap[obj.stock_code].trade_date) {
      stockDataMap[obj.stock_code] = obj;
    }
  });
  
  // 转换为返回格式
  const results = {};
  Object.entries(stockDataMap).forEach(([code, data]) => {
    const prevClose = parseFloat(data.close) || 0;
    const open = parseFloat(data.open) || 0;
    const close = parseFloat(data.close) || 0;
    const high = parseFloat(data.high) || 0;
    const low = parseFloat(data.low) || 0;
    
    // 计算涨跌
    const prevDayClose = parseFloat(data.prev_close) || open || close;
    const change = close - prevDayClose;
    const changePercent = prevDayClose > 0 ? (change / prevDayClose) * 100 : 0;
    
    results[code] = {
      stock_code: code,
      stock_name: data.stock_name,
      price: close,
      prev_close: prevDayClose,
      open: open,
      high: high,
      low: low,
      change: parseFloat(change.toFixed(2)),
      change_percent: parseFloat(changePercent.toFixed(2)),
      volume: parseInt(data.volume) || 0,
      amount: parseFloat(data.amount) || 0,
      total_cap: parseFloat(data.float_cap) || 0, // 从 history 取
      float_cap: parseFloat(data.float_cap) || 0,
      pe_ttm: parseFloat(data.pe_ttm) || 0,
      pb: parseFloat(data.pb) || 0,
      rsi6: parseFloat(data.rsi6) || null,
      rsi12: parseFloat(data.rsi12) || null,
      rsi24: parseFloat(data.rsi24) || null,
      trade_date: data.trade_date,
      data_source: 'history',
    };
  });
  
  return results;
}

/**
 * 批量获取股票实时行情（腾讯接口）
 */
async function fetchStockQuotesRealtime(codes) {
  const tencentCodes = codes.map(code => getTencentCode(code)).join(',');
  const url = `https://qt.gtimg.cn/q=${tencentCodes}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      },
      cache: 'no-store'
    });
    
    const text = await response.text();
    const results = {};
    const stockDataList = text.split(';').filter(s => s.trim());
    
    stockDataList.forEach(stockData => {
      const match = stockData.match(/v_([^=]+)="([^"]+)"/);
      if (!match) return;
      
      const fullCode = match[1];
      const stockCode = fullCode.replace(/^(sz|sh|hk|bj)/, '');
      const parts = match[2].split('~');
      
      if (parts.length < 48) return;
      
      results[stockCode] = {
        stock_code: stockCode,
        // 不使用腾讯返回的名称（GBK乱码）
        price: parseFloat(parts[3]) || 0,
        prev_close: parseFloat(parts[4]) || 0,
        open: parseFloat(parts[5]) || 0,
        high: parseFloat(parts[33]) || 0,
        low: parseFloat(parts[34]) || 0,
        change: parseFloat(parts[31]) || 0,
        change_percent: parseFloat(parts[32]) || 0,
        volume: parseInt(parts[6]) * 100 || 0,
        amount: parseFloat(parts[7]) * 10000 || 0,
        total_cap: parseFloat(parts[44]) * 100000000 || 0,
        float_cap: parseFloat(parts[45]) * 100000000 || 0,
        pe_ttm: parseFloat(parts[46]) || 0,
        pb: parseFloat(parts[47]) || 0,
        data_source: 'realtime',
      };
      
      // 验证市值数据合理性
      const quote = results[stockCode];
      if (quote.total_cap > 0 && quote.float_cap > 0 && quote.total_cap < quote.float_cap) {
        [quote.total_cap, quote.float_cap] = [quote.float_cap, quote.total_cap];
      }
    });
    
    return results;
  } catch (error) {
    console.error('批量获取实时行情失败:', error);
    return {};
  }
}

/**
 * GET /api/stock-realtime?codes=002027,002558
 * 批量获取股票行情
 * 
 * 优化策略：
 * - 交易时间：请求腾讯实时接口
 * - 非交易时间：优先从 stock_history.csv 读取，没有历史数据的股票再请求实时接口
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const codesParam = searchParams.get('codes');
    const forceRealtime = searchParams.get('realtime') === 'true'; // 强制使用实时接口
    
    if (!codesParam) {
      return NextResponse.json({ error: '缺少股票代码参数' }, { status: 400 });
    }
    
    const codes = codesParam.split(',').filter(Boolean).slice(0, 100);
    const trading = isTradingTime();
    
    let quoteMap = {};
    let dataSource = 'unknown';
    let historyCodes = [];
    let realtimeCodes = [];
    
    // 非交易时间，优先从 CSV 读取
    if (!trading && !forceRealtime) {
      console.log('[stock-realtime] 非交易时间，优先从 stock_history.csv 读取数据');
      quoteMap = getLatestStockData(codes);
      
      // 找出没有历史数据的股票
      historyCodes = Object.keys(quoteMap);
      realtimeCodes = codes.filter(c => !quoteMap[c]);
      
      if (realtimeCodes.length > 0) {
        console.log(`[stock-realtime] ${realtimeCodes.length} 只股票无历史数据，请求实时接口`);
        const realtimeData = await fetchStockQuotesRealtime(realtimeCodes);
        quoteMap = { ...quoteMap, ...realtimeData };
      }
      
      dataSource = historyCodes.length === codes.length ? 'history' : 'history+realtime';
      
    } else {
      // 交易时间，请求实时接口
      console.log('[stock-realtime] 交易时间，请求实时接口');
      quoteMap = await fetchStockQuotesRealtime(codes);
      dataSource = 'realtime';
      
      // 如果实时接口失败，降级到 CSV
      if (Object.keys(quoteMap).length === 0) {
        console.log('[stock-realtime] 实时接口失败，降级到 CSV');
        quoteMap = getLatestStockData(codes);
        dataSource = 'history_fallback';
      }
    }
    
    return NextResponse.json({
      data: quoteMap,
      total: Object.keys(quoteMap).length,
      requested: codes.length,
      trading_time: trading,
      data_source: dataSource,
      history_count: historyCodes.length,
      realtime_count: realtimeCodes.length,
    });
    
  } catch (error) {
    console.error('获取行情失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
