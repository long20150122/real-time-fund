import { NextResponse } from 'next/server';
import { find, add, update, findAll } from '../../lib/csv';

// 获取用户配置
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const config = find('configs', c => c.user_id === userId);
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 保存用户配置
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, data } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 查找是否已存在配置
    let config = find('configs', c => c.user_id === userId);

    if (config) {
      // 更新
      config = update('configs', config.id, { data: JSON.stringify(data) });
    } else {
      // 创建
      config = add('configs', { user_id: userId, data: JSON.stringify(data) });
    }

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
