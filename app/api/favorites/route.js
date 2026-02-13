import { NextResponse } from 'next/server';
import { add, remove, findAll, find } from '../../lib/csv';

// 获取用户收藏
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const favorites = findAll('favorites', f => f.user_id === userId);
    return NextResponse.json({ favorites });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 添加收藏
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = find('favorites', f => f.user_id === userId && f.code === code);
    if (existing) {
      return NextResponse.json({ favorite: existing });
    }

    const favorite = add('favorites', { user_id: userId, code });
    return NextResponse.json({ favorite });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 取消收藏
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const code = searchParams.get('code');

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    const favorite = find('favorites', f => f.user_id === userId && f.code === code);
    if (favorite) {
      remove('favorites', favorite.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
