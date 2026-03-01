import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');
const STOCK_HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');
const FUNDS_FILE = path.join(DATA_DIR, 'funds.csv');

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
 * 读取CSV文件
 */
function readCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  
  let content = fs.readFileSync(filePath, 'utf-8');
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
      obj[h.trim()] = (values[i] || '').trim();
    });
    return obj;
  });
}

/**
 * 计算连续涨跌天数
 */
function calculateConsecutiveDays(history, field = 'close') {
  if (!history || history.length < 2) return { upDays: 0, downDays: 0 };
  
  // 按日期排序（最新在前）
  const sorted = [...history].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  
  let upDays = 0;
  let downDays = 0;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = parseFloat(sorted[i][field]);
    const prev = parseFloat(sorted[i + 1][field]);
    
    if (i === 0) {
      // 第一天确定方向
      if (current > prev) {
        upDays = 1;
      } else if (current < prev) {
        downDays = 1;
      }
    } else {
      // 继续计算
      if (upDays > 0 && current > prev) {
        upDays++;
      } else if (downDays > 0 && current < prev) {
        downDays++;
      } else {
        break; // 方向改变，停止计数
      }
    }
  }
  
  return { upDays, downDays };
}

/**
 * GET /api/stock-list
 * 获取所有基金持仓股票的汇总列表
 * 支持区分当前活跃持仓和历史持仓
 */
export async function GET(request) {
  try {
    // 读取数据
    const holdings = readCSV(STOCKS_FILE);
    const stockHistory = readCSV(STOCK_HISTORY_FILE);
    const funds = readCSV(FUNDS_FILE);
    
    if (holdings.length === 0) {
      return NextResponse.json({ error: '暂无持仓数据' });
    }
    
    // 获取活跃基金代码列表
    const activeFundCodes = new Set(funds.map(f => f.code));
    
    // 获取最新报告期
    const reportDates = [...new Set(holdings.map(h => h.report_date))].sort().reverse();
    const latestReportDate = reportDates[0];
    
    // 筛选最新报告期的持仓
    const latestHoldings = holdings.filter(h => h.report_date === latestReportDate);
    
    // 按股票代码分组统计
    const stockMap = new Map();
    
    latestHoldings.forEach(h => {
      const code = h.stock_code;
      const isActiveFund = activeFundCodes.has(h.fund_code);
      const isDeleted = !!h.fund_deleted_at;
      
      if (!stockMap.has(code)) {
        stockMap.set(code, {
          stock_code: code,
          stock_name: h.stock_name,
          funds: [],
          historicalFunds: [], // 历史持有基金（基金已删除）
          totalWeight: 0,
          activeFundCount: 0,
          historicalFundCount: 0
        });
      }
      const stock = stockMap.get(code);
      
      // 区分活跃持仓和历史持仓
      if (isActiveFund && !isDeleted) {
        stock.funds.push({
          fund_code: h.fund_code,
          weight: h.weight
        });
        stock.activeFundCount++;
        const weightNum = parseFloat(h.weight?.replace('%', '')) || 0;
        stock.totalWeight += weightNum;
      } else {
        // 基金已删除或持仓被标记为删除
        stock.historicalFunds.push({
          fund_code: h.fund_code,
          weight: h.weight,
          deleted_at: h.fund_deleted_at
        });
        stock.historicalFundCount++;
      }
    });
    
    // 按股票代码分组历史数据
    const historyByCode = new Map();
    stockHistory.forEach(h => {
      if (!historyByCode.has(h.stock_code)) {
        historyByCode.set(h.stock_code, []);
      }
      historyByCode.get(h.stock_code).push(h);
    });
    
    // 按日期排序历史数据
    historyByCode.forEach((arr, code) => {
      arr.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    });
    
    // 构建结果
    const result = [];
    
    stockMap.forEach((stock, code) => {
      const history = historyByCode.get(code) || [];
      const latest = history[0] || {};
      const prev = history[1] || {};
      
      // 计算涨跌幅
      const latestClose = parseFloat(latest.close) || 0;
      const prevClose = parseFloat(prev.close) || 0;
      const changePercent = prevClose > 0 ? ((latestClose - prevClose) / prevClose * 100) : 0;
      
      // 计算连续涨跌天数
      const { upDays, downDays } = calculateConsecutiveDays(history);
      
      // 计算持有基金数（仅活跃）
      const fundCount = stock.activeFundCount;
      
      // 计算平均权重（仅活跃）
      const avgWeight = fundCount > 0 ? (stock.totalWeight / fundCount) : 0;
      
      // 判断是否为历史股票（没有活跃基金持有）
      const isHistorical = fundCount === 0 && stock.historicalFundCount > 0;
      
      result.push({
        stock_code: code,
        stock_name: stock.stock_name,
        // 价格数据
        latest_price: latestClose || null,
        change_percent: changePercent ? changePercent.toFixed(2) : null,
        // 市值数据（单位：亿元）
        float_cap: latest.float_cap ? (parseFloat(latest.float_cap) / 1e8).toFixed(2) : null,
        total_cap: null, // 需要实时接口获取
        // 估值数据
        pe_ttm: latest.pe_ttm || null,
        pb: latest.pb || null,
        // 连续涨跌
        consecutive_up_days: upDays,
        consecutive_down_days: downDays,
        // 基金持有（当前活跃）
        fund_count: fundCount,
        avg_weight: avgWeight.toFixed(2),
        // 历史持有基金信息
        is_historical: isHistorical,
        historical_fund_count: stock.historicalFundCount,
        historical_fund_codes: stock.historicalFunds.map(f => f.fund_code),
        // 最后更新日期
        last_trade_date: latest.trade_date || null,
        // 基金列表（简要）
        fund_codes: stock.funds.map(f => f.fund_code)
      });
    });
    
    // 排序：优先显示活跃持仓，再按持有基金数排序
    result.sort((a, b) => {
      // 先按是否历史排序
      if (a.is_historical !== b.is_historical) {
        return a.is_historical ? 1 : -1;
      }
      // 再按持有基金数排序
      return b.fund_count - a.fund_count;
    });
    
    return NextResponse.json({
      data: result,
      total: result.length,
      active_count: result.filter(r => !r.is_historical).length,
      historical_count: result.filter(r => r.is_historical).length,
      report_date: latestReportDate,
      last_update: stockHistory.length > 0 
        ? [...stockHistory].sort((a, b) => b.trade_date.localeCompare(a.trade_date))[0]?.trade_date 
        : null
    });
    
  } catch (error) {
    console.error('获取股票列表失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
