import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * 股票收盘数据更新 API
 * POST /api/crawl/daily-stock
 * 更新数据库中的股票收盘数据到最新交易日
 */
export async function POST() {
  try {
    const crawlerPath = path.join(process.cwd(), 'crawler', 'dailyStockSpider.js');
    
    return new Promise((resolve) => {
      const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        PYTHONUTF8: '1'
      };

      const child = spawn('node', [crawlerPath, '--days=30', '--force-today'], {
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

      // 设置超时 (5分钟)
      const timeout = setTimeout(() => {
        child.kill();
        resolve(NextResponse.json({ 
          success: false, 
          error: '爬取超时，请稍后重试' 
        }, { status: 408 }));
      }, 300000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          // 解析结果
          const newMatch = stdout.match(/共新增\s*(\d+)\s*条数据/);
          const updateMatch = stdout.match(/更新\s*(\d+)\s*条今日数据/);
          const failedMatch = stdout.match(/失败\s*(\d+)\s*只股票/);
          
          resolve(NextResponse.json({ 
            success: true, 
            message: '股票收盘数据更新完成',
            newRecords: newMatch ? parseInt(newMatch[1]) : 0,
            updatedRecords: updateMatch ? parseInt(updateMatch[1]) : 0,
            failedCount: failedMatch ? parseInt(failedMatch[1]) : 0,
            details: stdout
          }));
        } else {
          resolve(NextResponse.json({ 
            success: false, 
            error: stderr || '爬取失败',
            details: stdout
          }, { status: 500 }));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve(NextResponse.json({ 
          success: false, 
          error: err.message 
        }, { status: 500 }));
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
