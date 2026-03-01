import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');

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
 * 读取持仓数据
 */
function readHoldings() {
  if (!fs.existsSync(STOCKS_FILE)) {
    return [];
  }
  
  let content = fs.readFileSync(STOCKS_FILE, 'utf-8');
  
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
 * 解析权重字符串为数字
 */
function parseWeight(weightStr) {
  if (!weightStr) return 0;
  const num = parseFloat(weightStr.replace('%', ''));
  return isNaN(num) ? 0 : num;
}

/**
 * 计算两个季度之间的持仓环比变化
 */
function compareHoldings(currentPeriod, prevPeriod) {
  const currentMap = new Map();
  const prevMap = new Map();
  
  currentPeriod.stocks.forEach(s => {
    currentMap.set(s.stock_code, s);
  });
  
  prevPeriod.stocks.forEach(s => {
    prevMap.set(s.stock_code, s);
  });
  
  const added = [];      // 新调入
  const removed = [];    // 调出
  const increased = [];  // 增持
  const decreased = [];  // 减持
  const unchanged = [];  // 不变
  
  // 找出新调入和变化的
  currentPeriod.stocks.forEach(stock => {
    const prevStock = prevMap.get(stock.stock_code);
    const currentWeight = parseWeight(stock.weight);
    
    if (!prevStock) {
      // 新调入
      added.push({
        ...stock,
        current_weight: currentWeight,
        prev_weight: 0,
        weight_change: currentWeight,
        weight_change_pct: null
      });
    } else {
      // 继续持有，计算变化
      const prevWeight = parseWeight(prevStock.weight);
      const weightChange = currentWeight - prevWeight;
      
      if (Math.abs(weightChange) < 0.01) {
        unchanged.push({
          ...stock,
          current_weight: currentWeight,
          prev_weight: prevWeight,
          weight_change: weightChange
        });
      } else if (weightChange > 0) {
        increased.push({
          ...stock,
          current_weight: currentWeight,
          prev_weight: prevWeight,
          weight_change: weightChange,
          weight_change_pct: prevWeight > 0 ? ((weightChange / prevWeight) * 100).toFixed(2) : null
        });
      } else {
        decreased.push({
          ...stock,
          current_weight: currentWeight,
          prev_weight: prevWeight,
          weight_change: weightChange,
          weight_change_pct: prevWeight > 0 ? ((Math.abs(weightChange) / prevWeight) * 100).toFixed(2) : null
        });
      }
    }
  });
  
  // 找出调出的
  prevPeriod.stocks.forEach(stock => {
    if (!currentMap.has(stock.stock_code)) {
      const prevWeight = parseWeight(stock.weight);
      removed.push({
        ...stock,
        current_weight: 0,
        prev_weight: prevWeight,
        weight_change: -prevWeight
      });
    }
  });
  
  // 排序
  added.sort((a, b) => b.current_weight - a.current_weight);
  removed.sort((a, b) => b.prev_weight - a.prev_weight);
  increased.sort((a, b) => b.weight_change - a.weight_change);
  decreased.sort((a, b) => a.weight_change - b.weight_change);
  
  return {
    added,        // 新调入列表
    removed,      // 调出列表
    increased,    // 增持列表
    decreased,    // 减持列表
    unchanged,    // 持仓不变列表
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      increasedCount: increased.length,
      decreasedCount: decreased.length,
      unchangedCount: unchanged.length,
      totalWeightIncreased: increased.reduce((sum, s) => sum + s.weight_change, 0).toFixed(2),
      totalWeightDecreased: decreased.reduce((sum, s) => sum + s.weight_change, 0).toFixed(2)
    }
  };
}

/**
 * GET /api/fund-history?code=003053
 * 获取指定基金的历史持仓数据（按季度分组，含环比对比）
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: '缺少基金代码' }, { status: 400 });
  }
  
  try {
    const allHoldings = readHoldings();
    
    // 筛选指定基金的数据
    const fundHoldings = allHoldings.filter(h => h.fund_code === code);
    
    if (fundHoldings.length === 0) {
      return NextResponse.json({ 
        error: '暂无该基金的持仓数据',
        code,
        hint: '请运行 node crawler/stockSpider.js ' + code
      });
    }
    
    // 按报告期分组
    const periodsMap = new Map();
    
    fundHoldings.forEach(holding => {
      const reportDate = holding.report_date;
      if (!periodsMap.has(reportDate)) {
        periodsMap.set(reportDate, {
          report_date: reportDate,
          stocks: []
        });
      }
      periodsMap.get(reportDate).stocks.push({
        stock_code: holding.stock_code,
        stock_name: holding.stock_name,
        weight: holding.weight,
        ratio: parseFloat(holding.weight) || 0
      });
    });
    
    // 转换为数组并按日期降序排列（最新的在前）
    const periods = Array.from(periodsMap.values())
      .sort((a, b) => new Date(b.report_date) - new Date(a.report_date));
    
    // 计算相邻季度的变化率和详细环比数据
    for (let i = 0; i < periods.length - 1; i++) {
      const current = periods[i];
      const prev = periods[i + 1];
      
      // 计算详细的环比对比
      const comparison = compareHoldings(current, prev);
      current.comparison = comparison;
      
      const currentCodes = new Set(current.stocks.map(s => s.stock_code));
      const prevCodes = new Set(prev.stocks.map(s => s.stock_code));
      
      // 计算变化的持仓数量
      const changed = [...currentCodes].filter(x => !prevCodes.has(x)).length + 
                      [...prevCodes].filter(x => !currentCodes.has(x)).length;
      
      const total = Math.max(currentCodes.size, prevCodes.size);
      current.changeRate = total > 0 ? ((changed / total) * 100).toFixed(2) : '0.00';
      current.addedCount = comparison.added.length;
      current.removedCount = comparison.removed.length;
    }
    
    if (periods.length > 0) {
      periods[periods.length - 1].changeRate = '0.00';
      periods[periods.length - 1].addedCount = 0;
      periods[periods.length - 1].removedCount = 0;
    }
    
    return NextResponse.json({
      code,
      periods,
      count: periods.length
    });
    
  } catch (error) {
    console.error('读取基金历史持仓失败:', error);
    return NextResponse.json({ error: '读取数据失败' }, { status: 500 });
  }
}
