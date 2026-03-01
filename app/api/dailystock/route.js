import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

/**
 * 解析CSV行（处理引号内的逗号）
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
 * 读取每日股票数据
 */
function readDailyStocks() {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) {
    return [];
  }
  
  let content = fs.readFileSync(STOCK_HISTORY_FILE, 'utf-8');
  
  // 移除 UTF-8 BOM 标记
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

/**
 * GET /api/dailystock?code=002415
 * 获取指定股票的K线数据
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: '缺少股票代码' }, { status: 400 });
  }
  
  try {
    const allData = readDailyStocks();
    
    // 筛选指定股票的数据
    const stockData = allData
      .filter(d => d.stock_code === code)
      .map(d => ({
        time: d.trade_date,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
        volume: parseInt(d.volume, 10) || 0,
        amount: parseInt(d.amount, 10) || 0,
        float_cap: parseInt(d.float_cap, 10) || 0,
        turnover_rate: parseFloat(d.turnover_rate) || 0,
        pe_ttm: parseFloat(d.pe_ttm) || 0,
        pb: parseFloat(d.pb) || 0,
        rsi6: parseFloat(d.rsi6) || null,
        rsi12: parseFloat(d.rsi12) || null,
        rsi24: parseFloat(d.rsi24) || null,
      }))
      .sort((a, b) => a.time.localeCompare(b.time)); // 按日期升序
    
    if (stockData.length === 0) {
      return NextResponse.json({ 
        error: '暂无该股票的K线数据',
        code,
        hint: '请运行 node crawler/dailyStockSpider.js --codes=' + code
      });
    }
    
    // 获取股票名称
    const stockInfo = allData.find(d => d.stock_code === code);
    
    return NextResponse.json({
      code,
      name: stockInfo?.stock_name || '',
      count: stockData.length,
      data: stockData,
      // 统计信息
      stats: {
        minDate: stockData[0]?.time,
        maxDate: stockData[stockData.length - 1]?.time,
        latestClose: stockData[stockData.length - 1]?.close,
      }
    });
    
  } catch (error) {
    console.error('读取股票数据失败:', error);
    return NextResponse.json({ error: '读取数据失败' }, { status: 500 });
  }
}
