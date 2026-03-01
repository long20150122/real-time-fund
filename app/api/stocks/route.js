import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCKS_FILE = path.join(DATA_DIR, 'stocks.csv');

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

// 读取所有持仓数据
function readAllStocks() {
  if (!fs.existsSync(STOCKS_FILE)) {
    return [];
  }
  let content = fs.readFileSync(STOCKS_FILE, 'utf-8');
  // 移除 UTF-8 BOM 标记（如果存在）
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

// 写入持仓数据（支持扩展字段）
function writeAllStocks(stocks) {
  // 扩展表头：增加 fund_deleted_at 标记关联基金是否被删除
  // extra_data 预留 JSON 扩展字段，方便后续增加更多属性
  const headers = ['id', 'fund_code', 'stock_code', 'stock_name', 'weight', 'report_date', 'created_at', 'fund_deleted_at', 'extra_data'];
  const headerLine = headers.join(',');
  const lines = [headerLine, ...stocks.map(s => {
    return headers.map(h => {
      const val = s[h] ?? '';
      if (String(val).includes(',') || String(val).includes('"')) {
        return `"${String(val).replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  })];
  // UTF-8 BOM 标记，确保 Windows 下正确识别编码
  const BOM = '\uFEFF';
  fs.writeFileSync(STOCKS_FILE, BOM + lines.join('\n') + '\n', 'utf-8');
}

// 生成 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 获取基金的持仓历史
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fundCode = searchParams.get('fundCode');
    const reportDate = searchParams.get('reportDate');

    const allStocks = readAllStocks();

    let filtered = allStocks;

    if (fundCode) {
      filtered = filtered.filter(s => s.fund_code === fundCode);
    }

    if (reportDate) {
      filtered = filtered.filter(s => s.report_date === reportDate);
    }

    // 按报告期降序排序
    filtered.sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));

    // 如果请求的是单个基金的持仓，按报告期分组
    if (fundCode) {
      const grouped = {};
      filtered.forEach(s => {
        if (!grouped[s.report_date]) {
          grouped[s.report_date] = [];
        }
        grouped[s.report_date].push(s);
      });

      // 计算每期相对上期的持股变化
      const periods = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      const result = periods.map((period, index) => {
        const currentStocks = grouped[period];
        const prevPeriod = periods[index + 1];
        const prevStocks = prevPeriod ? grouped[prevPeriod] : [];

        const prevStockCodes = new Set(prevStocks.map(s => s.stock_code));
        const currentStockCodes = new Set(currentStocks.map(s => s.stock_code));

        // 标记每个股票的状态
        let addedCount = 0;
        let removedCount = 0;

        const stocksWithStatus = currentStocks.map(s => {
          const isNew = !prevStockCodes.has(s.stock_code);
          if (isNew) addedCount++;
          return { ...s, status: isNew ? 'new' : 'kept' };
        });

        // 找出被移除的股票
        const removedStocks = prevStocks.filter(s => !currentStockCodes.has(s.stock_code));
        removedCount = removedStocks.length;

        // 变化率 = (新增 + 移除) / 10
        const changeRate = ((addedCount + removedCount) / 10 * 100).toFixed(1);

        return {
          report_date: period,
          stocks: stocksWithStatus,
          removedStocks,
          changeRate,
          addedCount,
          removedCount
        };
      });

      return NextResponse.json({ 
        fundCode,
        periods: result,
        totalPeriods: periods.length
      });
    }

    return NextResponse.json({ stocks: filtered });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 批量保存持仓数据
export async function POST(request) {
  try {
    const body = await request.json();
    const { fundCode, reportDate, stocks } = body;

    if (!fundCode || !reportDate || !Array.isArray(stocks)) {
      return NextResponse.json({ error: 'fundCode, reportDate and stocks array are required' }, { status: 400 });
    }

    const allStocks = readAllStocks();
    const now = new Date().toISOString();

    // 删除该基金该报告期的旧数据
    const filteredStocks = allStocks.filter(s =>
      !(s.fund_code === fundCode && s.report_date === reportDate)
    );

    // 添加新数据
    const newStocks = stocks.map(s => ({
      id: generateId(),
      fund_code: fundCode,
      stock_code: s.stockCode || s.stock_code || '',
      stock_name: s.stockName || s.stock_name || '',
      weight: s.weight || '',
      report_date: reportDate,
      created_at: now
    }));

    writeAllStocks([...filteredStocks, ...newStocks]);

    return NextResponse.json({ 
      success: true, 
      saved: newStocks.length,
      stocks: newStocks 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除持仓数据（软删除：标记 fund_deleted_at）
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fundCode = searchParams.get('fundCode');
    const reportDate = searchParams.get('reportDate');
    const mode = searchParams.get('mode'); // 'soft' 软删除, 'hard' 物理删除

    if (!fundCode) {
      return NextResponse.json({ error: 'fundCode is required' }, { status: 400 });
    }

    const allStocks = readAllStocks();
    const now = new Date().toISOString();

    if (mode === 'hard') {
      // 物理删除（保留用于特殊情况）
      let filteredStocks;
      if (reportDate) {
        filteredStocks = allStocks.filter(s =>
          !(s.fund_code === fundCode && s.report_date === reportDate)
        );
      } else {
        filteredStocks = allStocks.filter(s => s.fund_code !== fundCode);
      }
      writeAllStocks(filteredStocks);
      return NextResponse.json({ 
        success: true,
        mode: 'hard',
        deleted: allStocks.length - filteredStocks.length
      });
    }

    // 默认软删除：标记 fund_deleted_at
    let updatedCount = 0;
    const updatedStocks = allStocks.map(s => {
      const shouldMark = reportDate 
        ? (s.fund_code === fundCode && s.report_date === reportDate)
        : (s.fund_code === fundCode);
      
      if (shouldMark && !s.fund_deleted_at) {
        updatedCount++;
        return { ...s, fund_deleted_at: now };
      }
      return s;
    });

    writeAllStocks(updatedStocks);

    return NextResponse.json({ 
      success: true,
      mode: 'soft',
      updated: updatedCount,
      message: '已标记为历史持仓，股票数据保留'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
