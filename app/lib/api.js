// CSV API 客户端

const API_BASE = '/api';

// 用户相关
export const userApi = {
  // 获取或创建用户
  async getOrCreate(email, name) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    return res.json();
  },

  // 获取用户
  async getById(id) {
    const res = await fetch(`${API_BASE}/users?id=${id}`);
    return res.json();
  },

  // 通过邮箱获取
  async getByEmail(email) {
    const res = await fetch(`${API_BASE}/users?email=${encodeURIComponent(email)}`);
    return res.json();
  },
};

// 基金相关
export const fundApi = {
  // 获取用户基金列表
  async getAll(userId) {
    const res = await fetch(`${API_BASE}/funds?userId=${userId}`);
    return res.json();
  },

  // 添加基金
  async add(userId, code, name, groupId) {
    const res = await fetch(`${API_BASE}/funds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code, name, groupId }),
    });
    return res.json();
  },

  // 更新基金
  async update(id, data) {
    const res = await fetch(`${API_BASE}/funds`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    return res.json();
  },

  // 删除基金
  async delete(id) {
    const res = await fetch(`${API_BASE}/funds?id=${id}`, { method: 'DELETE' });
    return res.json();
  },

  // 通过 code 删除
  async deleteByCode(userId, code) {
    const res = await fetch(`${API_BASE}/funds?userId=${userId}&code=${code}`, { method: 'DELETE' });
    return res.json();
  },
};

// 收藏相关
export const favoriteApi = {
  // 获取用户收藏
  async getAll(userId) {
    const res = await fetch(`${API_BASE}/favorites?userId=${userId}`);
    return res.json();
  },

  // 添加收藏
  async add(userId, code) {
    const res = await fetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });
    return res.json();
  },

  // 取消收藏
  async remove(userId, code) {
    const res = await fetch(`${API_BASE}/favorites?userId=${userId}&code=${code}`, { method: 'DELETE' });
    return res.json();
  },
};

// 配置相关
export const configApi = {
  // 获取用户配置
  async get(userId) {
    const res = await fetch(`${API_BASE}/configs?userId=${userId}`);
    return res.json();
  },

  // 保存用户配置
  async save(userId, data) {
    const res = await fetch(`${API_BASE}/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, data }),
    });
    return res.json();
  },
};
