import { NextResponse } from 'next/server';
import { readAll, find, findAll, add, update, remove } from '../../lib/csv';

/**
 * 获取用户的分类树
 */
function buildCategoryTree(categories) {
  const map = {};
  const roots = [];

  // 建立映射
  categories.forEach(cat => {
    map[cat.id] = { ...cat, children: [] };
  });

  // 构建树
  categories.forEach(cat => {
    if (cat.parent_id) {
      const parent = map[cat.parent_id];
      if (parent) {
        parent.children.push(map[cat.id]);
      }
    } else {
      roots.push(map[cat.id]);
    }
  });

  // 按 sort_order 排序
  const sortByOrder = (a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0);
  roots.sort(sortByOrder);
  Object.values(map).forEach(node => {
    node.children.sort(sortByOrder);
  });

  return roots;
}

/**
 * 为用户创建默认分类
 */
function createDefaultCategory(userId) {
  const existing = findAll('watchlist_categories', cat => cat.user_id === userId && cat.is_system === '1');
  if (existing.length > 0) return null;

  return add('watchlist_categories', {
    user_id: userId,
    parent_id: '',
    name: '自选',
    sort_order: 0,
    is_system: '1', // 系统默认分类
  });
}

/**
 * GET /api/watchlist-categories?user_id=xxx
 * 获取用户的分类列表（树形结构）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const flat = searchParams.get('flat'); // 是否返回扁平列表

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    // 获取用户的所有分类
    const categories = findAll('watchlist_categories', cat => cat.user_id === userId);

    // 如果没有分类，创建默认分类
    if (categories.length === 0) {
      createDefaultCategory(userId);
      const newCategories = findAll('watchlist_categories', cat => cat.user_id === userId);
      return NextResponse.json({
        categories: flat ? newCategories : buildCategoryTree(newCategories),
      });
    }

    return NextResponse.json({
      categories: flat ? categories : buildCategoryTree(categories),
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/watchlist-categories
 * 创建新分类
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, parent_id, name } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证父分类是否存在
    if (parent_id) {
      const parent = find('watchlist_categories', cat => cat.id === parent_id && cat.user_id === user_id);
      if (!parent) {
        return NextResponse.json({ error: '父分类不存在' }, { status: 400 });
      }

      // 不允许三级分类：如果父分类已有父分类，则不能再添加子分类
      if (parent.parent_id) {
        return NextResponse.json({ error: '不支持三级分类' }, { status: 400 });
      }
    }

    // 获取当前最大排序值
    const existingCategories = findAll('watchlist_categories', cat => cat.user_id === user_id);
    const sameLevelCategories = existingCategories.filter(cat => (cat.parent_id || '') === (parent_id || ''));
    const maxOrder = sameLevelCategories.reduce((max, cat) => Math.max(max, parseInt(cat.sort_order) || 0), 0);

    const category = add('watchlist_categories', {
      user_id,
      parent_id: parent_id || '',
      name,
      sort_order: maxOrder + 1,
      is_system: '0',
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/watchlist-categories
 * 更新分类
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, user_id, name, sort_order } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 查找分类
    const category = find('watchlist_categories', cat => cat.id === id && cat.user_id === user_id);
    if (!category) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 系统分类不允许修改名称
    if (category.is_system === '1' && name && name !== category.name) {
      return NextResponse.json({ error: '系统分类不允许修改名称' }, { status: 400 });
    }

    const updates = {};
    if (name) updates.name = name;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const updated = update('watchlist_categories', id, updates);

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/watchlist-categories?id=xxx&user_id=xxx
 * 删除分类
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 查找分类
    const category = find('watchlist_categories', cat => cat.id === id && cat.user_id === userId);
    if (!category) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 系统分类不允许删除
    if (category.is_system === '1') {
      return NextResponse.json({ error: '系统分类不允许删除' }, { status: 400 });
    }

    // 检查是否有子分类
    const children = findAll('watchlist_categories', cat => cat.parent_id === id);
    if (children.length > 0) {
      return NextResponse.json({ error: '请先删除子分类' }, { status: 400 });
    }

    // 检查分类下是否有股票
    const stocks = findAll('watchlist_stocks', stock => stock.category_id === id);
    if (stocks.length > 0) {
      // 将股票移动到默认分类
      const defaultCategory = find('watchlist_categories', cat => cat.user_id === userId && cat.is_system === '1');
      if (defaultCategory) {
        stocks.forEach(stock => {
          update('watchlist_stocks', stock.id, { category_id: defaultCategory.id });
        });
      }
    }

    // 删除分类
    remove('watchlist_categories', id);

    return NextResponse.json({ success: true, movedStocks: stocks.length });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
