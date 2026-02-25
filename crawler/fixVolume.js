/**
 * 修复历史成交量数据
 * 腾讯接口返回的成交量可能是"手"（需乘以100），需要修复
 * 
 * 使用方法:
 * node crawler/fixVolume.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DAILY_STOCKS_FILE = path.join(DATA_DIR, "dailystock.csv");

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 修复成交量数据
 */
function fixVolumeData() {
  if (!fs.existsSync(DAILY_STOCKS_FILE)) {
    console.log("dailystock.csv 文件不存在");
    return;
  }

  let content = fs.readFileSync(DAILY_STOCKS_FILE, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    console.log("没有数据");
    return;
  }

  const headers = lines[0].split(",");
  const volumeIndex = headers.indexOf("volume");
  const codeIndex = headers.indexOf("stock_code");
  const dateIndex = headers.indexOf("trade_date");

  if (volumeIndex === -1) {
    console.log("找不到 volume 字段");
    return;
  }

  let fixCount = 0;

  const fixedLines = lines.map((line, lineIndex) => {
    if (lineIndex === 0) return line;

    const values = parseCSVRow(line);
    const volume = parseInt(values[volumeIndex] || "0");
    const stockCode = values[codeIndex] || "";
    const tradeDate = values[dateIndex] || "";

    // 如果成交量 < 100万，可能是"手"单位，需要乘以100
    // 正常A股日成交量应该在百万级别以上（小盘股除外）
    if (volume > 0 && volume < 1000000) {
      values[volumeIndex] = String(volume * 100);
      fixCount++;
      console.log(`修复: ${stockCode} ${tradeDate} ${volume} -> ${volume * 100}`);
    }

    // 重新组装行
    return values.map((v, i) => {
      if (String(v).includes(",") || String(v).includes('"')) {
        return `"${String(v).replace(/"/g, '""')}"`;
      }
      return v;
    }).join(",");
  });

  // 写入文件
  const BOM = "\uFEFF";
  fs.writeFileSync(DAILY_STOCKS_FILE, BOM + fixedLines.join("\n") + "\n", "utf-8");

  console.log(`\n修复完成! 共修复 ${fixCount} 条记录`);
}

fixVolumeData();
