import { NextResponse } from 'next/server';
import { readAll, writeAll, initCSVFiles } from '../../lib/csv';

// 获取所有基金代码（去重）
export async function GET() {
  try {
    initCSVFiles();
    const funds = readAll('funds');
    
    // 去重获取所有基金代码
    const codes = [...new Set(funds.map(f => f.code).filter(Boolean))];
    
    return NextResponse.json({ 
      codes,
      total: codes.length 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 同步基金列表到 CSV（全量覆盖）
export async function POST(request) {
  try {
    const body = await request.json();
    const { funds, mode } = body;

    if (!Array.isArray(funds)) {
      return NextResponse.json({ error: 'funds array is required' }, { status: 400 });
    }

    // 全量覆盖模式：直接用新数据替换
    if (mode === 'replace' || funds.length === 0) {
      const now = new Date().toISOString();
      const newRecords = funds.map(f => ({
        id: f.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        user_id: 'local',
        code: f.code,
        name: f.name || '',
        group_id: '',
        created_at: f.created_at || now
      }));
      writeAll('funds', newRecords);
      return NextResponse.json({ 
        success: true, 
        mode: 'replace',
        total: newRecords.length
      });
    }

    // 增量模式：只添加不存在的
    const existingFunds = readAll('funds');
    const existingCodes = new Set(existingFunds.map(f => f.code));
    
    const now = new Date().toISOString();
    const newFunds = funds
      .filter(f => f.code && !existingCodes.has(f.code))
      .map(f => ({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        user_id: 'local',
        code: f.code,
        name: f.name || '',
        group_id: '',
        created_at: now
      }));

    if (newFunds.length > 0) {
      writeAll('funds', [...existingFunds, ...newFunds]);
    }

    return NextResponse.json({ 
      success: true, 
      mode: 'append',
      added: newFunds.length,
      total: existingFunds.length + newFunds.length
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除基金
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const funds = readAll('funds');
    const filtered = funds.filter(f => f.code !== code);
    writeAll('funds', filtered);

    return NextResponse.json({ 
      success: true,
      deleted: funds.length - filtered.length
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
