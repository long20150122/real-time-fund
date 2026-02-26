/**
 * 数据访问层抽象接口
 * 当前实现：CSV 文件存储
 * 后续可无缝迁移到：MySQL、Supabase、PostgreSQL 等
 * 
 * 迁移步骤：
 * 1. 实现新的 DataAdapter（如 SupabaseDataAdapter）
 * 2. 在 dataAdapterConfig.js 中切换 adapter
 * 3. 无需修改业务代码
 */

import { readAll, writeAll, add, update, remove, findAll, find, initCSVFiles } from './csv';

/**
 * 数据适配器接口定义
 * 任何新的存储后端都需要实现这些方法
 */
const DataAdapterInterface = {
  // 基金相关
  getFunds: async (userId) => { throw new Error('Not implemented'); },
  addFund: async (userId, fund) => { throw new Error('Not implemented'); },
  removeFund: async (userId, fundId) => { throw new Error('Not implemented'); },
  removeFundByCode: async (userId, code) => { throw new Error('Not implemented'); },
  
  // 收藏相关
  getFavorites: async (userId) => { throw new Error('Not implemented'); },
  addFavorite: async (userId, code) => { throw new Error('Not implemented'); },
  removeFavorite: async (userId, code) => { throw new Error('Not implemented'); },
  
  // 用户配置相关
  getUserConfig: async (userId) => { throw new Error('Not implemented'); },
  updateUserConfig: async (userId, config) => { throw new Error('Not implemented'); },
};

/**
 * CSV 数据适配器实现
 * 使用本地 CSV 文件作为临时数据库
 */
export const CSVDataAdapter = {
  // === 基金相关 ===
  async getFunds(userId) {
    initCSVFiles();
    if (userId) {
      return findAll('funds', f => f.user_id === userId);
    }
    return readAll('funds');
  },

  async addFund(userId, fund) {
    initCSVFiles();
    // 检查是否已存在
    const existing = findAll('funds', f => f.user_id === userId && f.code === fund.code);
    if (existing.length > 0) {
      return { exists: true, fund: existing[0] };
    }
    
    const newFund = add('funds', {
      user_id: userId,
      code: fund.code,
      name: fund.name || '',
      group_id: fund.groupId || '',
    });
    return { exists: false, fund: newFund };
  },

  async addFunds(userId, funds) {
    initCSVFiles();
    const results = [];
    for (const fund of funds) {
      const result = await this.addFund(userId, fund);
      results.push(result);
    }
    return results;
  },

  async removeFund(userId, fundId) {
    initCSVFiles();
    const fund = find('funds', f => f.id === fundId && f.user_id === userId);
    if (!fund) return { success: false, error: 'Fund not found' };
    const success = remove('funds', fundId);
    return { success };
  },

  async removeFundByCode(userId, code) {
    initCSVFiles();
    const funds = findAll('funds', f => f.user_id === userId && f.code === code);
    funds.forEach(f => remove('funds', f.id));
    return { success: true, deleted: funds.length };
  },

  async replaceFunds(userId, funds) {
    initCSVFiles();
    // 删除该用户的所有基金
    const existingFunds = findAll('funds', f => f.user_id === userId);
    existingFunds.forEach(f => remove('funds', f.id));
    
    // 添加新基金
    const now = new Date().toISOString();
    const newFunds = funds.map(f => ({
      id: f.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      code: f.code,
      name: f.name || '',
      group_id: f.groupId || '',
      created_at: f.created_at || now
    }));
    
    newFunds.forEach(f => add('funds', f));
    return { success: true, total: newFunds.length };
  },

  // === 收藏相关 ===
  async getFavorites(userId) {
    initCSVFiles();
    return findAll('favorites', f => f.user_id === userId);
  },

  async addFavorite(userId, code) {
    initCSVFiles();
    const existing = find('favorites', f => f.user_id === userId && f.code === code);
    if (existing) return { exists: true, favorite: existing };
    
    const favorite = add('favorites', { user_id: userId, code });
    return { exists: false, favorite };
  },

  async removeFavorite(userId, code) {
    initCSVFiles();
    const favorites = findAll('favorites', f => f.user_id === userId && f.code === code);
    favorites.forEach(f => remove('favorites', f.id));
    return { success: true };
  },

  // === 用户配置相关 ===
  async getUserConfig(userId) {
    initCSVFiles();
    const config = find('configs', c => c.user_id === userId);
    return config || null;
  },

  async updateUserConfig(userId, data) {
    initCSVFiles();
    const existing = find('configs', c => c.user_id === userId);
    
    if (existing) {
      update('configs', existing.id, { 
        data: typeof data === 'string' ? data : JSON.stringify(data),
        updated_at: new Date().toISOString()
      });
    } else {
      add('configs', { 
        user_id: userId, 
        data: typeof data === 'string' ? data : JSON.stringify(data),
        updated_at: new Date().toISOString()
      });
    }
    return { success: true };
  },
};

/**
 * Supabase 数据适配器（预留，后续实现）
 * 迁移到 Supabase 时实现此接口
 */
export const SupabaseDataAdapter = {
  // TODO: 实现与 CSVDataAdapter 相同的接口
  // 使用 Supabase Client 替代 CSV 操作
};

/**
 * MySQL 数据适配器（预留，后续实现）
 * 迁移到 MySQL 时实现此接口
 */
export const MySQLDataAdapter = {
  // TODO: 实现与 CSVDataAdapter 相同的接口
  // 使用 MySQL 连接池替代 CSV 操作
};

// 当前使用的数据适配器
// 切换存储后端只需修改这里
export const dataAdapter = CSVDataAdapter;

// 数据适配器类型标识
export const DATA_ADAPTER_TYPE = 'csv'; // 可选: 'csv', 'supabase', 'mysql'
