import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FINANCE_FILE = path.join(DATA_DIR, 'stock_quarter_finance.csv');

// 解析 CSV 行（处理引号内的逗号）
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

// 读取财务数据
function readFinanceData() {
  if (!fs.existsSync(FINANCE_FILE)) {
    return [];
  }
  let content = fs.readFileSync(FINANCE_FILE, 'utf-8');
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

// 格式化财务数据
function formatFinanceData(data) {
  return data.map(item => ({
    stock_code: item.stock_code,
    stock_name: item.stock_name,
    report_quarter: item.report_quarter,
    report_year: parseInt(item.report_year) || 0,
    report_date: item.report_date,
    // 转换为亿元
    quarter_revenue: parseFloat(item.quarter_revenue) / 1e8 || 0,
    quarter_net_profit: parseFloat(item.quarter_net_profit) / 1e8 || 0,
    quarter_deducted_net_profit: parseFloat(item.quarter_deducted_net_profit) / 1e8 || 0,
    // 同比增长率
    revenue_yoy: parseFloat(item.revenue_yoy) || 0,
    net_profit_yoy: parseFloat(item.net_profit_yoy) || 0,
    deducted_net_profit_yoy: parseFloat(item.deducted_net_profit_yoy) || 0,
    // 每股指标
    basic_eps: parseFloat(item.basic_eps) || 0,
    eps_yoy: parseFloat(item.eps_yoy) || 0, // EPS同比增长率（PEG核心指标）
    bps: parseFloat(item.bps) || 0,
    // 盈利能力
    roe: parseFloat(item.roe) || 0,
    gross_margin: parseFloat(item.gross_margin) || 0,
    // 估值指标
    pe_ttm: parseFloat(item.pe_ttm) || 0,
    pb: parseFloat(item.pb) || 0,
    ps: parseFloat(item.ps) || 0,
    // 市值（亿元）
    total_market_cap: parseFloat(item.total_market_cap) || 0,
    float_market_cap: parseFloat(item.float_market_cap) || 0,
    // TTM指标
    ttm_revenue: parseFloat(item.ttm_revenue) / 1e8 || 0,
    ttm_net_profit: parseFloat(item.ttm_net_profit) / 1e8 || 0,
    ttm_eps: parseFloat(item.ttm_eps) || 0,
  }));
}

// 计算PEG估值指标
function calculatePEG(data) {
  if (!data || data.length === 0) return null;

  const latest = data[0]; // 最新季度数据
  const pe = parseFloat(latest.pe_ttm) || 0;
  const epsYoy = parseFloat(latest.eps_yoy) || 0;
  const netProfitYoy = parseFloat(latest.net_profit_yoy) || 0;

  // PEG = PE / G（增长率）
  // 使用EPS同比增长率作为G
  let peg = 0;
  if (epsYoy > 0 && pe > 0) {
    peg = Math.round((pe / epsYoy) * 100) / 100;
  }

  // 使用净利润同比增长率作为备选G
  let peg_alt = 0;
  if (netProfitYoy > 0 && pe > 0) {
    peg_alt = Math.round((pe / netProfitYoy) * 100) / 100;
  }

  // 计算近4个季度的平均增长率
  const recent4 = data.slice(0, 4);
  const avgEpsYoy = recent4.reduce((sum, d) => sum + (parseFloat(d.eps_yoy) || 0), 0) / 4;
  const avgNetProfitYoy = recent4.reduce((sum, d) => sum + (parseFloat(d.net_profit_yoy) || 0), 0) / 4;

  let peg_avg = 0;
  if (avgEpsYoy > 0 && pe > 0) {
    peg_avg = Math.round((pe / avgEpsYoy) * 100) / 100;
  }

  return {
    stock_code: latest.stock_code,
    stock_name: latest.stock_name,
    pe_ttm: pe,
    pb: parseFloat(latest.pb) || 0,
    ps: parseFloat(latest.ps) || 0,
    eps_yoy: epsYoy,
    net_profit_yoy: netProfitYoy,
    peg: peg,
    peg_alt: peg_alt, // 使用净利润增长率计算
    peg_avg: peg_avg, // 使用近4季度平均增长率计算
    avg_eps_yoy: Math.round(avgEpsYoy * 100) / 100,
    avg_net_profit_yoy: Math.round(avgNetProfitYoy * 100) / 100,
    valuation_hint: peg > 0 ? (peg < 1 ? '低估' : peg < 1.5 ? '合理' : '高估') : '无法判断',
  };
}

// 获取股票财务数据
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');
    const codes = searchParams.get('codes');
    const quarter = searchParams.get('quarter');
    const peg = searchParams.get('peg'); // PEG估值参数
    const limit = parseInt(searchParams.get('limit') || '20');

    const allData = readFinanceData();

    // PEG估值分析接口
    if (peg === 'all') {
      // 获取所有股票的最新季度数据计算PEG
      const stockMap = new Map();
      allData.forEach(item => {
        if (!stockMap.has(item.stock_code)) {
          stockMap.set(item.stock_code, []);
        }
        stockMap.get(item.stock_code).push(item);
      });

      // 按季度排序
      stockMap.forEach((data, code) => {
        data.sort((a, b) => b.report_quarter.localeCompare(a.report_quarter));
      });

      const pegResults = [];
      stockMap.forEach((data, code) => {
        const formatted = formatFinanceData(data);
        const pegData = calculatePEG(formatted);
        if (pegData) {
          pegResults.push(pegData);
        }
      });

      // 按PEG排序
      pegResults.sort((a, b) => {
        if (a.peg <= 0 && b.peg <= 0) return 0;
        if (a.peg <= 0) return 1;
        if (b.peg <= 0) return -1;
        return a.peg - b.peg;
      });

      return NextResponse.json({
        data: pegResults,
        total: pegResults.length,
        description: 'PEG估值分析：PEG<1低估，1-1.5合理，>1.5高估'
      });
    }

    if (stockCode) {
      // 查询单个股票的财务历史
      const stockData = allData
        .filter(s => s.stock_code === stockCode)
        .sort((a, b) => b.report_quarter.localeCompare(a.report_quarter))
        .slice(0, limit);
      
      if (stockData.length === 0) {
        return NextResponse.json({ error: '未找到该股票财务数据' }, { status: 404 });
      }

      const formatted = formatFinanceData(stockData);
      
      // 如果请求PEG估值
      if (peg === 'true' || peg === '1') {
        return NextResponse.json({
          stock_code: stockCode,
          stock_name: stockData[0]?.stock_name,
          peg_analysis: calculatePEG(formatted),
          data: formatted,
          total: formatted.length
        });
      }
      
      return NextResponse.json({ 
        stock_code: stockCode,
        stock_name: stockData[0]?.stock_name,
        data: formatted,
        total: formatted.length 
      });
    }

    if (codes) {
      // 批量查询
      const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
      let filtered = allData.filter(s => codeList.includes(s.stock_code));
      
      if (quarter) {
        filtered = filtered.filter(s => s.report_quarter === quarter);
      }
      
      return NextResponse.json({ 
        data: formatFinanceData(filtered), 
        total: filtered.length 
      });
    }

    if (quarter) {
      // 按季度查询
      const quarterData = allData.filter(s => s.report_quarter === quarter);
      return NextResponse.json({ 
        quarter,
        data: formatFinanceData(quarterData),
        total: quarterData.length 
      });
    }

    // 返回概览
    const uniqueStocks = new Set(allData.map(s => s.stock_code));
    const uniqueQuarters = [...new Set(allData.map(s => s.report_quarter))].sort().reverse();
    
    return NextResponse.json({ 
      totalRecords: allData.length,
      totalStocks: uniqueStocks.size,
      quarters: uniqueQuarters.slice(0, 8),
      latestQuarter: uniqueQuarters[0]
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
