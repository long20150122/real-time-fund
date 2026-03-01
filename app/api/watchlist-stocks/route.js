import { NextResponse } from 'next/server';
import { readAll, find, findAll, add, update, remove } from '../../lib/csv';
import { fetchStockHistory, getStockRSIStats, checkStockHistoryExists } from '../../lib/stockHistoryService';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

/**
 * 根据股票代码判断市场类型
 */
function getStockType(code) {
  if (!code) return { market: 'sz', type: '主板' };
  const isHK = code.length === 5;
  if (isHK) return { market: 'hk', type: '港股' };
  if (code.startsWith('68')) return { market: 'sh', type: '科创板' };
  if (code.startsWith('30')) return { market: 'sz', type: '创业板' };
  if (code.startsWith('8') || code.startsWith('4')) return { market: 'bj', type: '北交所' };
  if (code.startsWith('6')) return { market: 'sh', type: '主板' };
  return { market: 'sz', type: '主板' };
}

/**
 * 从 stock_history.csv 获取股票信息（RSI等数据）
 */
function getStockInfo(stockCode) {
  if (!fs.existsSync(STOCK_HISTORY_FILE)) return null;

  let content = fs.readFileSync(STOCK_HISTORY_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return null;

  const headers = lines[0].split(',');

  // 找到该股票的所有记录
  const records = lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');
      return obj;
    })
    .filter(r => r.stock_code === stockCode);

  if (records.length === 0) return null;

  // 获取最新一条记录
  const latest = records[records.length - 1];

  // 计算近6个月 RSI6 最高/最低
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  const recentRecords = records.filter(r => r.trade_date >= sixMonthsAgoStr);
  const rsi6Values = recentRecords
    .map(r => parseFloat(r.rsi6))
    .filter(v => !isNaN(v));

  return {
    stock_code: latest.stock_code,
    stock_name: latest.stock_name,
    rsi6: parseFloat(latest.rsi6) || null,
    rsi12: parseFloat(latest.rsi12) || null,
    rsi24: parseFloat(latest.rsi24) || null,
    rsi6_max_6m: rsi6Values.length > 0 ? Math.max(...rsi6Values) : null,
    rsi6_min_6m: rsi6Values.length > 0 ? Math.min(...rsi6Values) : null,
  };
}

/**
 * 在线获取股票基本信息（名称、市场等）
 */
async function getStockInfoOnline(stockCode) {
  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${stockCode}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    const json = await response.json();
    const data = json.Data || json.QuotationCodeTable?.Data || [];
    if (data.length > 0) {
      const item = data[0];
      if (item.Code === stockCode) {
        const { market, type } = getStockType(stockCode);
        return {
          stock_code: item.Code,
          stock_name: item.Name,
          market,
          type,
        };
      }
    }
  } catch (e) {
    console.error('在线获取股票信息失败:', e.message);
  }
  return null;
}

/**
 * 获取股票实时价格（用于添加时记录价格）
 */
async function getStockRealtimePrice(stockCode) {
  try {
    const { getTencentCode } = await import('../../lib/stockDataUtils');
    const tencentCode = getTencentCode(stockCode);
    const url = `https://qt.gtimg.cn/q=${tencentCode}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      },
      cache: 'no-store'
    });
    
    const text = await response.text();
    const match = text.match(/="([^"]+)"/);
    if (!match) return null;
    
    const parts = match[1].split('~');
    if (parts.length < 48) return null;
    
    return {
      price: parseFloat(parts[3]) || 0,
      open: parseFloat(parts[5]) || 0,
      change: parseFloat(parts[31]) || 0,
      change_percent: parseFloat(parts[32]) || 0,
    };
  } catch (error) {
    console.error('获取实时价格失败:', error);
    return null;
  }
}

/**
 * 获取分类下的所有股票代码（包括子分类）
 */
function getStockCodesInCategory(categoryId, userId) {
  const stockCodes = [];

  // 直接属于该分类的股票
  const directStocks = findAll('watchlist_stocks', s => s.category_id === categoryId && s.user_id === userId);
  directStocks.forEach(s => stockCodes.push({ 
    code: s.stock_code, 
    stockId: s.id, 
    categoryId: s.category_id,
    stockName: s.stock_name,
    addDate: s.add_date,
    addPrice: s.add_price,
    sortOrder: s.sort_order,
    isFavorite: s.is_favorite === '1',
  }));

  // 子分类下的股票
  const childCategories = findAll('watchlist_categories', c => c.parent_id === categoryId && c.user_id === userId);
  childCategories.forEach(child => {
    const childStocks = getStockCodesInCategory(child.id, userId);
    stockCodes.push(...childStocks);
  });

  return stockCodes;
}

/**
 * 检查股票历史数据是否存在
 */
function hasStockHistory(stockCode) {
  return checkStockHistoryExists(stockCode);
}

/**
 * GET /api/watchlist-stocks
 * 获取用户的自选股票列表
 * 参数：
 * - user_id: 用户ID
 * - category_id: 分类ID（可选，不传则返回所有）
 * - include_info: 是否包含股票详细信息（可选）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const categoryId = searchParams.get('category_id');
    const includeInfo = searchParams.get('include_info') === 'true';

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    let stockCodes = [];

    if (categoryId) {
      // 获取指定分类下的股票
      stockCodes = getStockCodesInCategory(categoryId, userId);
    } else {
      // 获取用户所有自选股
      const stocks = findAll('watchlist_stocks', s => s.user_id === userId);
      stockCodes = stocks.map(s => ({ 
        code: s.stock_code, 
        stockId: s.id, 
        categoryId: s.category_id,
        stockName: s.stock_name,
        addDate: s.add_date,
        addPrice: s.add_price,
        sortOrder: s.sort_order,
        isFavorite: s.is_favorite === '1',
      }));
    }

    // 按 sort_order 倒序排列（新的在上面）
    stockCodes.sort((a, b) => (parseInt(b.sortOrder) || 0) - (parseInt(a.sortOrder) || 0));

    // 如果需要详细信息，补充股票信息
    const result = stockCodes.map(item => {
      const base = {
        id: item.stockId,
        stock_code: item.code,
        category_id: item.categoryId,
        stock_name: item.stockName,
        add_date: item.addDate,
        add_price: item.addPrice ? parseFloat(item.addPrice) : null,
        sort_order: item.sortOrder,
        is_favorite: item.isFavorite || false,
        has_history: hasStockHistory(item.code), // 是否有历史数据
      };

      if (includeInfo) {
        const info = getStockInfo(item.code);
        return { ...base, ...(info || {}), stock_name: info?.stock_name || item.stockName };
      }

      return base;
    });

    return NextResponse.json({
      stocks: result,
      total: result.length,
    });
  } catch (error) {
    console.error('获取自选股失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/watchlist-stocks
 * 添加股票到自选
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, category_id, stock_code, stock_name } = body;

    if (!user_id || !stock_code) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查股票是否已存在
    const existing = find('watchlist_stocks', s => s.user_id === user_id && s.stock_code === stock_code);
    if (existing) {
      return NextResponse.json({ error: '该股票已在自选中', stock: existing }, { status: 400 });
    }

    // 获取股票信息（优先级：本地历史数据 > 在线获取 > 传入参数）
    let stockInfo = getStockInfo(stock_code);
    let basicInfo = null;
    let needFetchHistory = !stockInfo; // 是否需要获取历史数据

    if (!stockInfo) {
      // 尝试在线获取
      basicInfo = await getStockInfoOnline(stock_code);

      if (!basicInfo && stock_name) {
        // 使用前端传入的名称
        const { market, type } = getStockType(stock_code);
        basicInfo = { stock_code, stock_name, market, type };
      }

      if (!basicInfo) {
        return NextResponse.json({ error: '无法获取股票信息，请稍后重试' }, { status: 400 });
      }
    }

    // 如果没有指定分类，使用默认分类
    let targetCategoryId = category_id;
    if (!targetCategoryId) {
      const defaultCategory = find('watchlist_categories', cat => cat.user_id === user_id && cat.is_system === '1');
      if (defaultCategory) {
        targetCategoryId = defaultCategory.id;
      }
    }

    // 获取当前最大排序值（用于倒序，新的在最上面）
    const existingStocks = findAll('watchlist_stocks', s => s.user_id === user_id && s.category_id === targetCategoryId);
    const maxOrder = existingStocks.reduce((max, s) => Math.max(max, parseInt(s.sort_order) || 0), 0);

    // 获取股票名称（优先级：stockInfo > basicInfo > 传入参数）
    const finalName = stockInfo?.stock_name || basicInfo?.stock_name || stock_name || '';

    // 获取实时价格（添加时的价格）
    const realtimePrice = await getStockRealtimePrice(stock_code);
    const addPrice = realtimePrice?.price || 0;
    const addDate = new Date().toISOString().split('T')[0]; // 添加日期

    const stock = add('watchlist_stocks', {
      user_id,
      category_id: targetCategoryId || '',
      stock_code,
      stock_name: finalName,
      sort_order: maxOrder + 1,
      add_date: addDate,
      add_price: addPrice,
    });

    // 异步获取历史数据（不阻塞响应）
    if (needFetchHistory) {
      fetchStockHistory(stock_code, finalName)
        .then(result => {
          if (result.success) {
            console.log(`[历史数据] ${stock_code}: ${result.message}`);
          } else {
            console.warn(`[历史数据] ${stock_code}: ${result.message}`);
          }
        })
        .catch(err => {
          console.error(`[历史数据] ${stock_code} 获取失败:`, err.message);
        });
    }

    // 返回股票信息
    const resultInfo = stockInfo || basicInfo;

    return NextResponse.json({ 
      stock, 
      stockInfo: resultInfo,
      historyFetching: needFetchHistory,
      add_price: addPrice,
      add_date: addDate,
    });
  } catch (error) {
    console.error('添加自选股失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/watchlist-stocks
 * 更新股票（移动分类、调整排序、上下移动）
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, user_id, category_id, sort_order, action, is_favorite } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 查找股票记录
    const stock = find('watchlist_stocks', s => s.id === id && s.user_id === user_id);
    if (!stock) {
      return NextResponse.json({ error: '股票记录不存在' }, { status: 404 });
    }

    const updates = {};
    
    // 处理上下移动
    if (action === 'move_up' || action === 'move_down') {
      const categoryId = stock.category_id;
      const stocksInCategory = findAll('watchlist_stocks', s => 
        s.user_id === user_id && s.category_id === categoryId
      ).sort((a, b) => (parseInt(b.sort_order) || 0) - (parseInt(a.sort_order) || 0)); // 倒序
      
      const currentIndex = stocksInCategory.findIndex(s => s.id === id);
      
      if (action === 'move_up' && currentIndex < stocksInCategory.length - 1) {
        // 上移：与下一个交换 sort_order
        const nextStock = stocksInCategory[currentIndex + 1];
        updates.sort_order = nextStock.sort_order;
        update('watchlist_stocks', nextStock.id, { sort_order: stock.sort_order });
      } else if (action === 'move_down' && currentIndex > 0) {
        // 下移：与上一个交换 sort_order
        const prevStock = stocksInCategory[currentIndex - 1];
        updates.sort_order = prevStock.sort_order;
        update('watchlist_stocks', prevStock.id, { sort_order: stock.sort_order });
      } else {
        return NextResponse.json({ 
          stock, 
          message: action === 'move_up' ? '已经在最上面' : '已经在最下面' 
        });
      }
    } else {
      // 常规更新
      if (category_id !== undefined) updates.category_id = category_id;
      if (sort_order !== undefined) updates.sort_order = sort_order;
      // 支持更新关注状态
      if (is_favorite !== undefined) {
        updates.is_favorite = is_favorite ? '1' : '0';
      }
    }

    const updated = update('watchlist_stocks', id, updates);

    return NextResponse.json({ stock: updated });
  } catch (error) {
    console.error('更新自选股失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/watchlist-stocks?id=xxx&user_id=xxx
 * 从自选中删除股票
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');
    const stockCode = searchParams.get('stock_code');

    if (!userId || (!id && !stockCode)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    let targetStock;
    if (id) {
      targetStock = find('watchlist_stocks', s => s.id === id && s.user_id === userId);
    } else {
      targetStock = find('watchlist_stocks', s => s.stock_code === stockCode && s.user_id === userId);
    }

    if (!targetStock) {
      return NextResponse.json({ error: '股票记录不存在' }, { status: 404 });
    }

    remove('watchlist_stocks', targetStock.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除自选股失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/watchlist-stocks
 * 批量更新排序（拖拽后）
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { user_id, updates } = body;

    if (!user_id || !updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const results = updates.map(item => {
      const stock = find('watchlist_stocks', s => s.id === item.id && s.user_id === user_id);
      if (stock) {
        return update('watchlist_stocks', item.id, {
          category_id: item.category_id,
          sort_order: item.sort_order,
        });
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json({ success: true, updated: results.length });
  } catch (error) {
    console.error('批量更新排序失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
