/**
 * 股票历史数据定时更新脚本
 * 
 * 功能：
 * 1. 每日增量更新最新数据
 * 2. 自动计算RSI指标
 * 3. 智能检测缺失数据并补充
 * 
 * 使用方法:
 * node crawler/updateStockHistory.js           # 每日增量更新
 * node crawler/updateStockHistory.js --full    # 完整检查并补充缺失数据
 * node crawler/updateStockHistory.js --recalc  # 仅重新计算RSI
 * node crawler/updateStockHistory.js --batch=20 # 分批更新（每次20只股票）
 */

const { spawn } = require('child_process');
const path = require('path');

const SPIDER_PATH = path.join(__dirname, 'dailyStockSpider.js');

/**
 * 运行爬虫脚本
 */
function runSpider(args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n执行: node crawler/dailyStockSpider.js ${args.join(' ')}\n`);
    
    const child = spawn('node', [SPIDER_PATH, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`爬虫退出码: ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 解析参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    full: false,
    recalc: false,
    batch: 0,
  };

  for (const arg of args) {
    if (arg === '--full' || arg === '--from-2024') {
      result.full = true;
    } else if (arg === '--recalc' || arg === '--recalc-rsi') {
      result.recalc = true;
    } else if (arg.startsWith('--batch=')) {
      result.batch = parseInt(arg.split('=')[1], 10) || 0;
    }
  }

  return result;
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主函数
 */
async function main() {
  const args = parseArgs();
  
  console.log('='.repeat(50));
  console.log('股票历史数据更新工具');
  console.log('='.repeat(50));
  console.log();

  try {
    if (args.recalc) {
      // 仅重新计算RSI
      console.log('📊 重新计算RSI指标...\n');
      await runSpider(['--recalc-rsi']);
    } else if (args.full) {
      // 完整检查并补充缺失数据
      console.log('📅 检查并补充历史数据（从2024年1月开始）...\n');
      
      if (args.batch > 0) {
        // 分批模式
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          console.log(`\n${'='.repeat(50)}`);
          console.log(`处理批次: offset=${offset}, batch=${args.batch}`);
          console.log('='.repeat(50));
          
          await runSpider(['--from-2024', `--batch=${args.batch}`, `--offset=${offset}`]);
          
          // 检查是否还有更多数据
          // 这里简单地在每批之后等待一段时间
          offset += args.batch;
          
          // 如果需要继续，等待一段时间再继续
          if (offset < 200) { // 假设最多200只股票
            console.log('\n⏳ 等待5秒后继续下一批...\n');
            await delay(5000);
          } else {
            hasMore = false;
          }
        }
      } else {
        // 一次性处理
        await runSpider(['--from-2024']);
      }
      
      // 重新计算RSI
      console.log('\n📊 计算RSI指标...\n');
      await runSpider(['--recalc-rsi']);
    } else {
      // 每日增量更新
      console.log('📈 每日增量更新...\n');
      await runSpider(['--force-today']);
      
      // 更新RSI
      console.log('\n📊 更新RSI指标...\n');
      await runSpider(['--recalc-rsi']);
    }

    console.log('\n✅ 更新完成！');
  } catch (error) {
    console.error('\n❌ 更新失败:', error.message);
    process.exit(1);
  }
}

main();
