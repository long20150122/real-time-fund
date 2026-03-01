import { NextResponse } from 'next/server';
import { dataAdapter } from '../../lib/dataAccess';

// 获取用户的基金列表
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const funds = await dataAdapter.getFunds(userId);
    return NextResponse.json({ funds });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 添加基金（支持单个和批量）
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, code, name, groupId, funds } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 批量添加模式
    if (Array.isArray(funds) && funds.length > 0) {
      const results = await dataAdapter.addFunds(userId, funds);
      const added = results.filter(r => !r.exists);
      const existing = results.filter(r => r.exists);
      return NextResponse.json({ 
        added: added.map(r => r.fund),
        existing: existing.map(r => r.fund),
        addedCount: added.length,
        existingCount: existing.length
      });
    }

    // 单个添加模式
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const result = await dataAdapter.addFund(userId, { code, name, groupId });
    
    if (result.exists) {
      return NextResponse.json({ error: 'Fund already exists', fund: result.fund }, { status: 400 });
    }

    return NextResponse.json({ fund: result.fund });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 更新基金
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, userId, name, groupId } = body;

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId are required' }, { status: 400 });
    }

    // 暂时保留 CSV 直接操作，后续迁移到 dataAdapter
    const { update } = await import('../../lib/csv');
    const fund = update('funds', id, { name, group_id: groupId });
    
    if (!fund) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }
    
    return NextResponse.json({ fund });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除基金（同时软删除关联持仓）
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const code = searchParams.get('code');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    let fundCode = code;
    
    // 如果通过 id 删除，先获取基金代码
    if (id && !fundCode) {
      const { find } = await import('../../lib/csv');
      const fund = find('funds', f => f.id === id && f.user_id === userId);
      if (!fund) {
        return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
      }
      fundCode = fund.code;
    }

    // 软删除关联的股票持仓数据
    if (fundCode) {
      try {
        const stocksResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/stocks?fundCode=${fundCode}`, {
          method: 'DELETE'
        });
        const stocksResult = await stocksResponse.json();
        console.log(`[基金删除] 软删除持仓: fundCode=${fundCode}, result=`, stocksResult);
      } catch (e) {
        console.error('[基金删除] 软删除持仓失败:', e);
        // 继续删除基金，不影响主流程
      }
    }

    if (id) {
      const result = await dataAdapter.removeFund(userId, id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (fundCode) {
      const result = await dataAdapter.removeFundByCode(userId, fundCode);
      return NextResponse.json({ success: true, deleted: result.deleted });
    }

    return NextResponse.json({ error: 'id or code is required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
