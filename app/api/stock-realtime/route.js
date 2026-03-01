import { NextResponse } from 'next/server';
import { getTencentCode } from '../../lib/stockDataUtils';

/**
 * 解析 GBK 编码的股票名称（腾讯接口返回的是 GBK 编码）
 */
function parseGBKName(name) {
  if (!name) return null;
  // 腾讯接口返回的名称通常是正确的，直接返回
  // 如果有乱码问题，可以在这里处理
  return name;
}

/**
 * 批量获取股票实时行情（优化版：一次请求获取所有）
 */
async function fetchStockQuotes(codes) {
  // 将所有股票代码转换为腾讯格式，一次性请求
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
    
    // 解析腾讯接口返回的数据（多只股票用分号分隔）
    const results = {};
    const stockDataList = text.split(';').filter(s => s.trim());
    
    stockDataList.forEach(stockData => {
      const match = stockData.match(/v_([^=]+)="([^"]+)"/);
      if (!match) return;
      
      const stockCode = match[1].split('~').pop(); // 提取原始代码
      const parts = match[2].split('~');
      
      if (parts.length < 48) return;
      
      // 使用腾讯接口返回的名称（索引1）
      const stockName = parseGBKName(parts[1]) || stockCode;
      
      results[stockCode] = {
        stock_code: stockCode,
        stock_name: stockName,
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
      };
      
      // 验证市值数据合理性
      const quote = results[stockCode];
      if (quote.total_cap > 0 && quote.float_cap > 0 && quote.total_cap < quote.float_cap) {
        [quote.total_cap, quote.float_cap] = [quote.float_cap, quote.total_cap];
      }
    });
    
    return results;
  } catch (error) {
    console.error('批量获取行情失败:', error);
    return {};
  }
}

/**
 * GET /api/stock-realtime?codes=002027,002558
 * 批量获取股票实时行情
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const codesParam = searchParams.get('codes');
    
    if (!codesParam) {
      return NextResponse.json({ error: '缺少股票代码参数' }, { status: 400 });
    }
    
    const codes = codesParam.split(',').filter(Boolean).slice(0, 100);
    
    // 一次性获取所有股票行情（只调用一次外部 API）
    const quoteMap = await fetchStockQuotes(codes);
    
    return NextResponse.json({
      data: quoteMap,
      total: Object.keys(quoteMap).length,
      requested: codes.length
    });
    
  } catch (error) {
    console.error('获取实时行情失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
