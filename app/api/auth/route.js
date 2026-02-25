import { NextResponse } from 'next/server';
import { find } from '../../lib/csv';
import crypto from 'crypto';

// 生成 session token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// 简单的 session 存储（生产环境应使用 Redis 等）
const sessions = new Map();

// 登录
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, action } = body;

    // 登出
    if (action === 'logout') {
      const token = body.token;
      if (token) {
        sessions.delete(token);
      }
      return NextResponse.json({ success: true });
    }

    // 登录验证
    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // 查找用户
    const user = find('users', u => u.username === username);

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    if (user.password !== password) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    // 生成 token
    const token = generateToken();
    sessions.set(token, {
      userId: user.id,
      username: user.username,
      createdAt: Date.now(),
    });

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 验证登录状态
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const session = sessions.get(token);

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    // 检查 session 是否过期（24小时）
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
      sessions.delete(token);
      return NextResponse.json({ authenticated: false });
    }

    // 获取用户信息
    const user = find('users', u => u.id === session.userId);

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      authenticated: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 导出 sessions 供其他模块使用
export { sessions };
