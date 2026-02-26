/**
 * 数据迁移脚本
 * 将 stock_quarter_finance.csv 中的动态数据拆分到 stock_history.csv
 * 
 * 使用方法: node crawler/migrateStockData.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OLD_FINANCE_FILE = path.join(DATA_DIR, 'stock_quarter_finance.csv');
const NEW_FINANCE_FILE = path.join(DATA_DIR, 'stock_quarter_finance_new.csv');
const HISTORY_FILE = path.join(DATA_DIR, 'stock_history.csv');

// 解析CSV行
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

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 读取原始财务数据
function readOldFinanceData() {
  if (!fs.existsSync(OLD_FINANCE_FILE)) {
    console.log('stock_quarter_finance.csv 文件不存在');
    return { headers: [], data: [] };
  }

  let content = fs.readFileSync(OLD_FINANCE_FILE, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return { headers: [], data: [] };

  const headers = lines[0].split(',');
  const data = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });

  return { headers, data };
}

// 迁移数据
function migrateData() {
  console.log('开始数据迁移...\n');

  const { headers, data } = readOldFinanceData();
  
  if (data.length === 0) {
    console.log('没有数据需要迁移');
    return;
  }

  console.log(`读取到 ${data.length} 条原始数据\n`);

  // 新的财务数据表头（移除动态字段）
  const newFinanceHeaders = [
    'id',
    'stock_code',
    'stock_name',
    'report_quarter',
    'report_year',
    'report_date',
    'quarter_revenue',
    'quarter_net_profit',
    'quarter_deducted_net_profit',
    'revenue_yoy',
    'net_profit_yoy',
    'deducted_net_profit_yoy',
    'basic_eps',
    'eps_yoy',
    'bps',
    'roe',
    'gross_margin',
    'ttm_revenue',
    'ttm_net_profit',
    'created_at',
  ];

  // 历史动态数据表头
  const historyHeaders = [
    'id',
    'stock_code',
    'stock_name',
    'trade_date',
    'pe_ttm',
    'pb',
    'ps',
    'total_market_cap',
    'float_market_cap',
    'ttm_eps',
    'created_at',
  ];

  const newFinanceRecords = [];
  const historyRecords = [];
  const historyKeys = new Set(); // 用于去重

  data.forEach(item => {
    // 生成新的财务数据记录
    newFinanceRecords.push({
      id: item.id || generateId(),
      stock_code: item.stock_code,
      stock_name: item.stock_name,
      report_quarter: item.report_quarter,
      report_year: item.report_year,
      report_date: item.report_date,
      quarter_revenue: item.quarter_revenue,
      quarter_net_profit: item.quarter_net_profit,
      quarter_deducted_net_profit: item.quarter_deducted_net_profit,
      revenue_yoy: item.revenue_yoy,
      net_profit_yoy: item.net_profit_yoy,
      deducted_net_profit_yoy: item.deducted_net_profit_yoy,
      basic_eps: item.basic_eps,
      eps_yoy: item.eps_yoy,
      bps: item.bps,
      roe: item.roe,
      gross_margin: item.gross_margin,
      ttm_revenue: item.ttm_revenue,
      ttm_net_profit: item.ttm_net_profit,
      created_at: item.created_at,
    });

    // 生成历史动态数据记录（如果有 PE/PB 等数据）
    // 使用 report_date 作为 trade_date（报告日的估值快照）
    const tradeDate = item.report_date || '';
    const historyKey = `${item.stock_code}_${tradeDate}`;
    
    // 只有当有估值数据时才创建历史记录，且去重
    if (tradeDate && !historyKeys.has(historyKey)) {
      const hasValuationData = item.pe_ttm || item.pb || item.ps || 
                                item.total_market_cap || item.float_market_cap;
      
      if (hasValuationData) {
        historyKeys.add(historyKey);
        historyRecords.push({
          id: generateId(),
          stock_code: item.stock_code,
          stock_name: item.stock_name,
          trade_date: tradeDate,
          pe_ttm: item.pe_ttm || '',
          pb: item.pb || '',
          ps: item.ps || '',
          total_market_cap: item.total_market_cap || '',
          float_market_cap: item.float_market_cap || '',
          ttm_eps: item.ttm_eps || '',
          created_at: item.created_at,
        });
      }
    }
  });

  // 写入新的财务数据文件
  const financeLines = [
    newFinanceHeaders.join(','),
    ...newFinanceRecords.map(r => 
      newFinanceHeaders.map(h => {
        const val = r[h] ?? '';
        if (String(val).includes(',') || String(val).includes('"')) {
          return `"${String(val).replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    )
  ];
  
  const BOM = '\uFEFF';
  fs.writeFileSync(NEW_FINANCE_FILE, BOM + financeLines.join('\n') + '\n', 'utf-8');
  console.log(`写入新财务数据文件: ${newFinanceRecords.length} 条`);

  // 写入历史动态数据文件
  if (historyRecords.length > 0) {
    const historyLines = [
      historyHeaders.join(','),
      ...historyRecords.map(r =>
        historyHeaders.map(h => {
          const val = r[h] ?? '';
          if (String(val).includes(',') || String(val).includes('"')) {
            return `"${String(val).replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      )
    ];
    
    fs.writeFileSync(HISTORY_FILE, BOM + historyLines.join('\n') + '\n', 'utf-8');
    console.log(`写入历史动态数据文件: ${historyRecords.length} 条`);
  } else {
    // 创建空的历史数据文件（只有表头）
    fs.writeFileSync(HISTORY_FILE, BOM + historyHeaders.join(',') + '\n', 'utf-8');
    console.log('创建空的历史动态数据文件');
  }

  console.log('\n迁移完成！');
  console.log('\n接下来的步骤:');
  console.log('1. 检查新文件内容是否正确');
  console.log('2. 备份原始文件: copy stock_quarter_finance.csv stock_quarter_finance_backup.csv');
  console.log('3. 替换文件: move stock_quarter_finance_new.csv stock_quarter_finance.csv');
}

// 执行迁移
migrateData();
