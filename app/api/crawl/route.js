import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * 爬虫 API - 执行基金持仓爬取
 * POST /api/crawl
 * Body: { fundCode: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { fundCode } = body;

    if (!fundCode) {
      return NextResponse.json({ error: 'fundCode is required' }, { status: 400 });
    }

    // 执行爬虫脚本
    const crawlerPath = path.join(process.cwd(), 'crawler', 'stockSpider.js');
    
    return new Promise((resolve) => {
      // Windows 下设置 UTF-8 编码环境变量
      const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        PYTHONUTF8: '1'
      };

      const child = spawn('node', [crawlerPath, fundCode], {
        cwd: process.cwd(),
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Windows 下使用 shell 来正确处理编码
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        // Windows 下可能需要从 GBK 转换为 UTF-8
        try {
          const text = data.toString('utf-8');
          stdout += text;
        } catch (e) {
          stdout += data.toString();
        }
      });

      child.stderr.on('data', (data) => {
        try {
          const text = data.toString('utf-8');
          stderr += text;
        } catch (e) {
          stderr += data.toString();
        }
      });

      // 设置超时 (2分钟)
      const timeout = setTimeout(() => {
        child.kill();
        resolve(NextResponse.json({ 
          success: false, 
          error: '爬取超时，请稍后重试' 
        }, { status: 408 }));
      }, 120000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          // 解析爬取结果
          const quarters = (stdout.match(/\d+个季度/g) || [''])[0];
          const records = (stdout.match(/已保存.*?(\d+) 条/g) || []).reduce((sum, m) => {
            const num = m.match(/(\d+) 条/);
            return sum + (num ? parseInt(num[1]) : 0);
          }, 0);

          resolve(NextResponse.json({ 
            success: true, 
            message: `爬取完成`,
            details: stdout,
            quarters,
            records
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
