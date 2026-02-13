import { NextResponse } from 'next/server';
import { readAll, find, add, update } from '../../lib/csv';

// 获取用户列表或单个用户
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (id) {
      const user = find('users', u => u.id === id);
      return NextResponse.json({ user });
    }

    if (email) {
      const user = find('users', u => u.email === email);
      return NextResponse.json({ user });
    }

    const users = readAll('users');
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 创建或更新用户
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, name, id } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 查找是否已存在
    let user = find('users', u => u.email === email);

    if (user) {
      // 更新
      user = update('users', user.id, { name: name || user.name });
    } else {
      // 创建
      user = add('users', { email, name: name || email.split('@')[0] });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
