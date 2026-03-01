import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getStockType, getSecId, getTencentCode } from '../../lib/stockDataUtils';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

/**
 * 根据股票代码获取东方财富 secid（已移到工具模块）
 */
// getSecId 已从工具模块导入

/**
 * 加载本地股票列表（从stock_history.csv）
 */
function loadLocalStocks() {
  const stocks = [];
  const stockMap = new Map();

  if (!fs.existsSync(STOCK_HISTORY_FILE)) return stocks;

  let content = fs.readFileSync(STOCK_HISTORY_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return stocks;

  const headers = lines[0].split(',');
  lines.slice(1).filter(l => l.trim()).forEach(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    const code = obj.stock_code;
    if (code && !stockMap.has(code)) {
      const { market, type } = getStockType(code);
      stockMap.set(code, {
        stock_code: code,
        stock_name: obj.stock_name,
        market,
        type,
      });
    }
  });

  return Array.from(stockMap.values());
}

/**
 * 本地搜索匹配（仅代码和名称）
 */
function matchLocal(stock, keyword) {
  const kw = keyword.toLowerCase();
  const code = stock.stock_code.toLowerCase();
  const name = (stock.stock_name || '').toLowerCase();
  return code.includes(kw) || name.includes(kw);
}

/**
 * 在线搜索股票（从东方财富API）
 * 支持股票代码、名称、拼音首字母搜索
 */
async function searchOnline(keyword, limit = 20) {
  const results = [];

  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });

    const json = await response.json();
    const dataList = json.Data || json.QuotationCodeTable?.Data || [];

    if (Array.isArray(dataList)) {
      for (const item of dataList) {
        const code = item.Code;
        const name = item.Name;
        const marketCode = String(item.MktNum || '');

        if (code && name) {
          const isHK = marketCode === '116' || code.length === 5;
          results.push({
            stock_code: code,
            stock_name: name,
            market: isHK ? 'hk' : marketCode === '1' ? 'sh' : 'sz',
            type: isHK ? '港股' :
                  code.startsWith('68') ? '科创板' :
                  code.startsWith('30') ? '创业板' :
                  code.startsWith('8') || code.startsWith('4') ? '北交所' : '主板',
            pinyin: item.PinYin || '',
            secid: getSecId(code),
          });
        }
      }
    }
  } catch (error) {
    console.error('在线搜索失败:', error.message);
  }

  return results;
}

/**
 * 批量获取股票实时行情（腾讯接口）
 * 注意：股票名称从东方财富接口获取，避免GBK编码问题
 * @param {Array} codes - 股票代码列表
 */
async function getRealtimeQuotes(codes) {
  const quotes = new Map();
  
  if (!codes || codes.length === 0) return quotes;

  try {
    // 腾讯实时行情接口
    const tencentCodes = codes.map(c => getTencentCode(c));
    const url = `https://qt.gtimg.cn/q=${tencentCodes.join(',')}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://gu.qq.com/',
      },
    });

    const text = await response.text();
    
    // 解析腾讯接口返回的数据
    const lines = text.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const match = line.match(/v_([^=]+)="([^"]+)"/);
      if (!match) continue;
      
      const parts = match[2].split('~');
      if (parts.length < 35) continue;
      
      const code = parts[2];
      
      quotes.set(code, {
        stock_code: code,
        stock_name: code, // 名称从搜索结果中获取
        price: parseFloat(parts[3]) || null,
        change: parseFloat(parts[31]) || null,      // ✅ 涨跌额（上涨点数）
        change_percent: parseFloat(parts[32]) || null, // ✅ 涨跌幅（%）
        high: parseFloat(parts[33]) || null,
        low: parseFloat(parts[34]) || null,
      });
    }
  } catch (error) {
    console.error('获取实时行情失败:', error.message);
  }

  return quotes;
}

/**
 * GET /api/stock-search?keyword=xxx&limit=20
 * 搜索股票（本地 + 在线）
 * 
 * 支持搜索方式：
 * - 股票代码：如 "300034"、"00700"
 * - 股票名称：如 "钢研高纳"、"腾讯"
 * - 拼音首字母：如 "gygn"、"tx"（仅在线搜索支持）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!keyword) {
      return NextResponse.json({ stocks: [], total: 0 });
    }

    // 本地搜索（代码和名称）
    const localStocks = loadLocalStocks();
    const localMatched = localStocks.filter(stock => matchLocal(stock, keyword)).map(s => ({
      ...s,
      secid: getSecId(s.stock_code),
    }));

    // 在线搜索（支持代码、名称、拼音）
    const onlineMatched = await searchOnline(keyword, limit);

    // 合并结果（本地优先，去重）
    const existingCodes = new Set(localMatched.map(s => s.stock_code));
    const allResults = [
      ...localMatched,
      ...onlineMatched.filter(s => !existingCodes.has(s.stock_code))
    ];

    const results = allResults.slice(0, limit);

    // 获取实时行情数据
    const codes = results.map(s => s.stock_code);
    const quotes = await getRealtimeQuotes(codes);

    // 合并行情数据
    const stocksWithQuotes = results.map(stock => {
      const quote = quotes.get(stock.stock_code);
      return {
        stock_code: stock.stock_code,
        stock_name: stock.stock_name,
        market: stock.market,
        type: stock.type,
        pinyin: stock.pinyin,
        // 行情数据
        price: quote?.price || null,
        change: quote?.change || null,            // ✅ 涨跌额（上涨点数）
        change_pct: quote?.change_percent || null, // ✅ 涨跌幅（%）
        high: quote?.high || null,
        low: quote?.low || null,
      };
    });

    return NextResponse.json({
      stocks: stocksWithQuotes,
      total: allResults.length,
      keyword,
    });
  } catch (error) {
    console.error('搜索股票失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
