/**
 * 产业链 API 接口
 * 提供产业链数据的增删改查
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CHAINS_FILE = path.join(DATA_DIR, 'industry_chains.csv');
const CHAIN_CONCEPTS_FILE = path.join(DATA_DIR, 'industry_chain_concepts.csv');
const CHAIN_IMAGES_FILE = path.join(DATA_DIR, 'industry_chain_images.csv');
const USER_SORT_FILE = path.join(DATA_DIR, 'user_chain_sort.csv');

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

// 写入 CSV 文件
function writeCSV(filePath, data, headers) {
  const headerLine = headers.join(',');
  const lines = [headerLine, ...data.map(row => {
    return headers.map(h => {
      const val = row[h] ?? '';
      if (String(val).includes(',') || String(val).includes('"')) {
        return `"${String(val).replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  })];
  const BOM = '\uFEFF';
  fs.writeFileSync(filePath, BOM + lines.join('\n') + '\n', 'utf-8');
}

// 获取产业链列表（带用户排序）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chainId = searchParams.get('chainId');

    // 读取数据
    const chains = readCSV(CHAINS_FILE);
    const concepts = readCSV(CHAIN_CONCEPTS_FILE);
    const images = readCSV(CHAIN_IMAGES_FILE);
    const userSort = readCSV(USER_SORT_FILE);

    // 如果请求单个产业链详情
    if (chainId) {
      const chain = chains.find(c => c.id === chainId);
      if (!chain) {
        return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
      }

      const chainConcepts = concepts.filter(c => c.chain_id === chainId)
        .sort((a, b) => parseInt(a.sort_order) - parseInt(b.sort_order));
      
      const chainImages = images.filter(i => i.chain_id === chainId);

      return NextResponse.json({
        chain,
        concepts: chainConcepts,
        images: chainImages,
      });
    }

    // 获取用户排序
    const userSortMap = new Map();
    if (userId) {
      userSort.filter(s => s.user_id === userId).forEach(s => {
        userSortMap.set(s.chain_id, parseInt(s.sort_order));
      });
    }

    // 合并排序：用户排序优先，然后是默认排序
    const sortedChains = chains.map(chain => ({
      ...chain,
      userSortOrder: userSortMap.get(chain.id) ?? null,
      finalSortOrder: userSortMap.has(chain.id) 
        ? userSortMap.get(chain.id) 
        : parseInt(chain.sort_order) || 0,
    })).sort((a, b) => a.finalSortOrder - b.finalSortOrder);

    // 为每个产业链附加概念数量
    const conceptCounts = new Map();
    concepts.forEach(c => {
      conceptCounts.set(c.chain_id, (conceptCounts.get(c.chain_id) || 0) + 1);
    });

    const result = sortedChains.map(chain => ({
      ...chain,
      conceptCount: conceptCounts.get(chain.id) || 0,
    }));

    return NextResponse.json({
      chains: result,
      total: result.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 更新用户排序
export async function PUT(request) {
  try {
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'userId and updates array are required' }, { status: 400 });
    }

    const userSort = readCSV(USER_SORT_FILE);
    const now = new Date().toISOString();

    // 删除该用户的旧排序
    const otherUserSort = userSort.filter(s => s.user_id !== userId);

    // 添加新排序
    const newSorts = updates.map((u, idx) => ({
      id: `ucs_${Date.now()}_${idx}`,
      user_id: userId,
      chain_id: u.chainId,
      sort_order: u.sortOrder,
      created_at: now,
    }));

    const allSorts = [...otherUserSort, ...newSorts];
    writeCSV(USER_SORT_FILE, allSorts, ['id', 'user_id', 'chain_id', 'sort_order', 'created_at']);

    return NextResponse.json({ 
      success: true, 
      updated: newSorts.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 添加/更新概念（手动维护）
export async function POST(request) {
  try {
    const body = await request.json();
    const { chainId, conceptName, action } = body;

    if (!chainId || !conceptName) {
      return NextResponse.json({ error: 'chainId and conceptName are required' }, { status: 400 });
    }

    const concepts = readCSV(CHAIN_CONCEPTS_FILE);

    if (action === 'add') {
      // 检查是否已存在
      const exists = concepts.find(c => c.chain_id === chainId && c.concept_name === conceptName);
      if (exists) {
        return NextResponse.json({ exists: true, concept: exists });
      }

      // 获取最大排序号
      const chainConcepts = concepts.filter(c => c.chain_id === chainId);
      const maxOrder = chainConcepts.reduce((max, c) => Math.max(max, parseInt(c.sort_order) || 0), 0);

      const newConcept = {
        id: `cc_${Date.now()}`,
        chain_id: chainId,
        concept_name: conceptName,
        sort_order: maxOrder + 1,
        is_manual: '1',
        created_at: new Date().toISOString(),
      };

      concepts.push(newConcept);
      writeCSV(CHAIN_CONCEPTS_FILE, concepts, ['id', 'chain_id', 'concept_name', 'sort_order', 'is_manual', 'created_at']);

      return NextResponse.json({ success: true, concept: newConcept });
    }

    if (action === 'remove') {
      const filtered = concepts.filter(c => !(c.chain_id === chainId && c.concept_name === conceptName));
      writeCSV(CHAIN_CONCEPTS_FILE, filtered, ['id', 'chain_id', 'concept_name', 'sort_order', 'is_manual', 'created_at']);
      return NextResponse.json({ success: true, removed: concepts.length - filtered.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
