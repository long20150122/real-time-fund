import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BASE_INFO_FILE = path.join(DATA_DIR, 'stock_base_info.csv');

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

// 读取基本信息
function readBaseInfo() {
  if (!fs.existsSync(BASE_INFO_FILE)) {
    return [];
  }
  let content = fs.readFileSync(BASE_INFO_FILE, 'utf-8');
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

// 获取股票基本信息
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');
    const codes = searchParams.get('codes');

    const allData = readBaseInfo();

    if (stockCode) {
      // 查询单个股票
      const stock = allData.find(s => s.stock_code === stockCode);
      if (!stock) {
        return NextResponse.json({ error: '未找到该股票信息' }, { status: 404 });
      }
      return NextResponse.json({ stock });
    }

    if (codes) {
      // 批量查询
      const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
      const stocks = allData.filter(s => codeList.includes(s.stock_code));
      return NextResponse.json({ stocks, total: stocks.length });
    }

    // 返回所有
    return NextResponse.json({ 
      stocks: allData, 
      total: allData.length 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
