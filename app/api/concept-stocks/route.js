/**
 * 概念成分股 API 接口
 * 获取概念对应的股票列表，并标注基金重仓
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONCEPT_STOCKS_FILE = path.join(DATA_DIR, 'concept_stocks.csv');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');

// 解析 CSV 行
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

// 读取 CSV 文件
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
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

// 获取概念成分股
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const conceptName = searchParams.get('concept');
    const topN = parseInt(searchParams.get('top') || '10');

    if (!conceptName) {
      return NextResponse.json({ error: 'concept parameter is required' }, { status: 400 });
    }

    // 读取概念成分股
    const conceptStocks = readCSV(CONCEPT_STOCKS_FILE);
    const stocks = conceptStocks
      .filter(s => s.concept_name === conceptName)
      .sort((a, b) => parseInt(a.rank) - parseInt(b.rank))
      .slice(0, topN);

    // 如果没有数据，返回空列表
    if (stocks.length === 0) {
      return NextResponse.json({
        concept: conceptName,
        stocks: [],
        message: '该概念暂无成分股数据，请运行爬虫获取',
      });
    }

    // 读取基金持仓数据，判断重仓
    const fundStocks = readCSV(STOCKS_FILE);
    
    // 获取最新报告期
    const reportDates = [...new Set(fundStocks.map(s => s.report_date))].sort().reverse();
    const latestReportDate = reportDates[0];

    // 统计每只股票被多少基金持有
    const stockFundCount = new Map();
    fundStocks
      .filter(s => s.report_date === latestReportDate && !s.fund_deleted_at)
      .forEach(s => {
        const count = stockFundCount.get(s.stock_code) || 0;
        stockFundCount.set(s.stock_code, count + 1);
      });

    // 标注重仓信息
    const stocksWithFundInfo = stocks.map(s => ({
      ...s,
      fundHoldCount: stockFundCount.get(s.stock_code) || 0,
      isHeavyHeld: (stockFundCount.get(s.stock_code) || 0) > 0,
    }));

    return NextResponse.json({
      concept: conceptName,
      stocks: stocksWithFundInfo,
      reportDate: latestReportDate,
      total: stocksWithFundInfo.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
