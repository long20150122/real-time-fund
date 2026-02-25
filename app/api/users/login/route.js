import { NextResponse } from 'next/server';
import { find } from '../../../lib/csv';

// 登录接口
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '请输入账户和密码' }, { status: 400 });
    }

    // 查找用户
    const user = find('users', u => u.username === username);

    if (!user) {
      return NextResponse.json({ error: '账户不存在' }, { status: 400 });
    }

    if (user.password !== password) {
      return NextResponse.json({ error: '密码错误' }, { status: 400 });
    }

    // 返回用户信息（不含密码）
    const { password: _, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (error) {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
