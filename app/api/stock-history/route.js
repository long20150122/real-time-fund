import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * 检查和补充股票历史数据 API
 * POST /api/stock-history
 * Body: { stockCodes: string[], startDate?: string }
 * 
 * 1. 检查传入的股票代码是否在 stock_history.csv 中有数据
 * 2. 对于没有数据或数据不足的股票，自动调用爬虫补充
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { stockCodes, startDate = '2025-10-13' } = body;

    if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
      return NextResponse.json({ error: 'stockCodes is required and must be an array' }, { status: 400 });
    }

    // 去重
    const uniqueCodes = [...new Set(stockCodes)];

    // 读取现有 stock_history.csv 检查已有数据
    const dataDir = path.join(process.cwd(), 'data');
    const historyFile = path.join(dataDir, 'stock_history.csv');
    
    let existingStocks = new Set();
    let stockDateCounts = {};
    
    if (fs.existsSync(historyFile)) {
      const content = fs.readFileSync(historyFile, 'utf8').replace(/^\uFEFF/, '');
      const lines = content.split('\n').filter(l => l.trim());
      
      lines.slice(1).forEach(line => {
        const cols = line.split(',');
        if (cols[1]) {
          existingStocks.add(cols[1]);
          if (!stockDateCounts[cols[1]]) {
            stockDateCounts[cols[1]] = 0;
          }
          stockDateCounts[cols[1]]++;
        }
      });
    }

    // 找出需要补充数据的股票（新出现的或数据不足50天的）
    const needCrawl = uniqueCodes.filter(code => {
      // 如果股票不存在，需要爬取
      if (!existingStocks.has(code)) return true;
      // 如果数据少于50天，也需要补充
      if (stockDateCounts[code] && stockDateCounts[code] < 50) return true;
      return false;
    });

    if (needCrawl.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有股票历史数据已完整',
        checked: uniqueCodes.length,
        needCrawl: 0,
        crawled: 0,
        existing: uniqueCodes.filter(code => existingStocks.has(code))
      });
    }

    // 调用爬虫补充数据
    const crawlerPath = path.join(process.cwd(), 'crawler', 'dailyStockSpider.js');
    const days = 136; // 从2025-10-13到2026-02-26约136个交易日
    
    return new Promise((resolve) => {
      const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        PYTHONUTF8: '1'
      };

      const child = spawn('node', [
        crawlerPath,
        `--days=${days}`,
        `--codes=${needCrawl.join(',')}`
      ], {
        cwd: process.cwd(),
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        try {
          stdout += data.toString('utf-8');
        } catch (e) {
          stdout += data.toString();
        }
      });

      child.stderr.on('data', (data) => {
        try {
          stderr += data.toString('utf-8');
        } catch (e) {
          stderr += data.toString();
        }
      });

      // 设置超时 (3分钟)
      const timeout = setTimeout(() => {
        child.kill();
        resolve(NextResponse.json({
          success: true,
          warning: '部分股票爬取超时',
          checked: uniqueCodes.length,
          needCrawl: needCrawl.length,
          crawled: needCrawl.length,
          timeout: true,
          stocks: needCrawl
        }));
      }, 180000);

      child.on('close', (code) => {
        clearTimeout(timeout);

        // 提取新增记录数
        const match = stdout.match(/共新增 (\d+) 条数据/);
        const newRecords = match ? parseInt(match[1]) : 0;

        resolve(NextResponse.json({
          success: true,
          message: `已补充 ${needCrawl.length} 只股票的历史数据`,
          checked: uniqueCodes.length,
          needCrawl: needCrawl.length,
          crawled: needCrawl.length,
          newRecords,
          stocks: needCrawl,
          details: stdout.slice(-500) // 最后500字符
        }));
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve(NextResponse.json({
          success: false,
          error: err.message,
          checked: uniqueCodes.length,
          needCrawl: needCrawl.length,
          stocks: needCrawl
        }, { status: 500 }));
      });
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/stock-history?stockCodes=code1,code2
 * 检查股票历史数据状态
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const codesParam = searchParams.get('stockCodes');
    
    if (!codesParam) {
      return NextResponse.json({ error: 'stockCodes is required' }, { status: 400 });
    }

    const stockCodes = codesParam.split(',').filter(Boolean);
    
    // 读取现有数据
    const dataDir = path.join(process.cwd(), 'data');
    const historyFile = path.join(dataDir, 'stock_history.csv');
    
    let existingStocks = {};
    
    if (fs.existsSync(historyFile)) {
      const content = fs.readFileSync(historyFile, 'utf8').replace(/^\uFEFF/, '');
      const lines = content.split('\n').filter(l => l.trim());
      
      lines.slice(1).forEach(line => {
        const cols = line.split(',');
        if (cols[1]) {
          if (!existingStocks[cols[1]]) {
            existingStocks[cols[1]] = { count: 0, dates: [] };
          }
          existingStocks[cols[1]].count++;
          existingStocks[cols[1]].dates.push(cols[3]);
        }
      });
    }

    // 检查每个股票的状态
    const result = stockCodes.map(code => {
      const info = existingStocks[code];
      return {
        code,
        exists: !!info,
        days: info ? info.count : 0,
        needCrawl: !info || info.count < 50,
        dateRange: info ? {
          min: info.dates.sort()[0],
          max: info.dates.sort().reverse()[0]
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      stocks: result,
      summary: {
        total: stockCodes.length,
        complete: result.filter(r => !r.needCrawl).length,
        needCrawl: result.filter(r => r.needCrawl).length
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
