import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// 确保 data 目录存在
export const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

// CSV 文件路径
export const CSV_FILES = {
  users: path.join(DATA_DIR, 'users.csv'),
  funds: path.join(DATA_DIR, 'funds.csv'),
  favorites: path.join(DATA_DIR, 'favorites.csv'),
  configs: path.join(DATA_DIR, 'configs.csv'),
};

// CSV 表头定义
const HEADERS = {
  users: 'id,username,password,email,name,created_at,updated_at',
  funds: 'id,user_id,code,name,group_id,created_at',
  favorites: 'id,user_id,code,created_at',
  configs: 'id,user_id,data,updated_at',
};

// 初始化 CSV 文件
export const initCSVFiles = () => {
  ensureDataDir();
  Object.entries(CSV_FILES).forEach(([key, filePath]) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, HEADERS[key] + '\n', 'utf-8');
    }
  });
};

// 解析 CSV 行为对象
export const parseCSVLine = (line, headers) => {
  const values = parseCSVRow(line);
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i] || '';
  });
  return obj;
};

// 解析 CSV 行（处理引号内的逗号）
const parseCSVRow = (line) => {
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
};

// 对象转 CSV 行
export const toCSVLine = (obj, headers) => {
  return headers.map(h => {
    const val = obj[h] ?? '';
    // 如果值包含逗号或引号，需要用引号包裹
    if (String(val).includes(',') || String(val).includes('"')) {
      return `"${String(val).replace(/"/g, '""')}"`;
    }
    return val;
  }).join(',');
};

// 读取所有记录
export const readAll = (type) => {
  initCSVFiles();
  const filePath = CSV_FILES[type];
  let content = fs.readFileSync(filePath, 'utf-8');
  // 移除 UTF-8 BOM 标记（如果存在）
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',');
  return lines.slice(1).filter(line => line.trim()).map(line => parseCSVLine(line, headers));
};

// 写入所有记录
export const writeAll = (type, records) => {
  initCSVFiles();
  const filePath = CSV_FILES[type];
  const headers = HEADERS[type].split(',');
  const lines = [HEADERS[type], ...records.map(r => toCSVLine(r, headers))];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
};

// 添加一条记录
export const add = (type, record) => {
  const records = readAll(type);
  const newRecord = {
    ...record,
    id: record.id || generateId(),
    created_at: record.created_at || new Date().toISOString(),
  };
  records.push(newRecord);
  writeAll(type, records);
  return newRecord;
};

// 更新记录
export const update = (type, id, updates) => {
  const records = readAll(type);
  const index = records.findIndex(r => r.id === id);
  if (index === -1) return null;
  records[index] = { ...records[index], ...updates, updated_at: new Date().toISOString() };
  writeAll(type, records);
  return records[index];
};

// 删除记录
export const remove = (type, id) => {
  const records = readAll(type);
  const filtered = records.filter(r => r.id !== id);
  writeAll(type, filtered);
  return filtered.length < records.length;
};

// 查找记录
export const find = (type, predicate) => {
  const records = readAll(type);
  return records.find(predicate);
};

// 查找所有匹配记录
export const findAll = (type, predicate) => {
  const records = readAll(type);
  return predicate ? records.filter(predicate) : records;
};

// 生成 ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// 清空所有数据（仅用于测试）
export const clearAll = () => {
  Object.values(CSV_FILES).forEach(filePath => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
};
