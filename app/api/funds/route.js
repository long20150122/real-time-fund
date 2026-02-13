import { NextResponse } from 'next/server';
import { readAll, add, update, remove, findAll } from '../../lib/csv';

// 获取用户的基金列表
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const funds = findAll('funds', f => f.user_id === userId);
    return NextResponse.json({ funds });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 添加基金
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, code, name, groupId } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = findAll('funds', f => f.user_id === userId && f.code === code);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Fund already exists', fund: existing[0] }, { status: 400 });
    }

    const fund = add('funds', {
      user_id: userId,
      code,
      name: name || '',
      group_id: groupId || '',
    });

    return NextResponse.json({ fund });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 更新基金
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, groupId } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const fund = update('funds', id, { name, group_id: groupId });
    return NextResponse.json({ fund });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除基金
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const code = searchParams.get('code');

    if (id) {
      const success = remove('funds', id);
      return NextResponse.json({ success });
    }

    if (userId && code) {
      const funds = readAll('funds');
      const toDelete = funds.filter(f => f.user_id === userId && f.code === code);
      toDelete.forEach(f => remove('funds', f.id));
      return NextResponse.json({ success: true, deleted: toDelete.length });
    }

    return NextResponse.json({ error: 'id or (userId and code) is required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
