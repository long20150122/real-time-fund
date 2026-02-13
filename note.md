# 项目笔记 (note.md)

---

## 0. CSV 存储方案 (轻量级实现)

本项目支持两种存储方式：
- **CSV 文件存储** (默认，无需数据库)
- **Supabase 云端存储** (可选，需配置)

### 0.1 CSV 文件结构

```
data/
├── users.csv      # 用户信息
├── funds.csv      # 用户基金列表
├── favorites.csv  # 用户收藏
└── configs.csv    # 用户配置
```

### 0.2 CSV 表结构

#### users.csv
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 用户唯一 ID |
| email | string | 用户邮箱 |
| name | string | 用户名称 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### funds.csv
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录 ID |
| user_id | string | 用户 ID |
| code | string | 基金代码 |
| name | string | 基金名称 |
| group_id | string | 分组 ID |
| created_at | datetime | 创建时间 |

#### favorites.csv
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录 ID |
| user_id | string | 用户 ID |
| code | string | 基金代码 |
| created_at | datetime | 创建时间 |

#### configs.csv
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录 ID |
| user_id | string | 用户 ID |
| data | JSON | 配置数据 (JSON 字符串) |
| updated_at | datetime | 更新时间 |

### 0.3 API 接口

#### 用户接口 `/api/users`

| 方法 | 参数 | 说明 |
|------|------|------|
| GET | `?email=xxx` 或 `?id=xxx` | 获取用户 |
| POST | `{ email, name }` | 创建/更新用户 |

#### 基金接口 `/api/funds`

| 方法 | 参数 | 说明 |
|------|------|------|
| GET | `?userId=xxx` | 获取用户基金列表 |
| POST | `{ userId, code, name, groupId }` | 添加基金 |
| PUT | `{ id, name, groupId }` | 更新基金 |
| DELETE | `?id=xxx` 或 `?userId=xxx&code=xxx` | 删除基金 |

#### 收藏接口 `/api/favorites`

| 方法 | 参数 | 说明 |
|------|------|------|
| GET | `?userId=xxx` | 获取用户收藏 |
| POST | `{ userId, code }` | 添加收藏 |
| DELETE | `?userId=xxx&code=xxx` | 取消收藏 |

#### 配置接口 `/api/configs`

| 方法 | 参数 | 说明 |
|------|------|------|
| GET | `?userId=xxx` | 获取用户配置 |
| POST | `{ userId, data }` | 保存配置 |

### 0.4 前端调用示例

```javascript
import { userApi, fundApi, favoriteApi, configApi } from './lib/api';

// 用户登录
const { user } = await userApi.getOrCreate('test@example.com', '测试用户');

// 获取基金列表
const { funds } = await fundApi.getAll(user.id);

// 添加基金
await fundApi.add(user.id, '110022', '易方达消费行业');

// 添加收藏
await favoriteApi.add(user.id, '110022');

// 保存配置
await configApi.save(user.id, { refreshMs: 30000, viewMode: 'card' });
```

### 0.5 注意事项

1. CSV 存储仅适用于单机部署，不支持多实例部署
2. 数据存储在 `data/` 目录下，请确保该目录有写入权限
3. 生产环境建议使用 Supabase 或自建数据库
4. CSV 文件不支持并发写入，高并发场景需使用数据库

---

## 1. 数据存储策略

前端有存储数据，采用 **本地持久化 + 实时刷新** 的方式：

### 1.1 localStorage 本地存储

| 存储键 | 数据内容 | 用途 |
|--------|----------|------|
| `funds` | 基金列表 (code, name 等) | 持久化已添加的基金 |
| `holdings` | 重仓股数据 | 缓存持仓信息 |
| `favorites` | 自选基金代码 | 自选状态 |
| `groups` | 分组配置 | 分组管理 |
| `collapsedCodes` | 收起状态 | UI 状态 |
| `pendingTrades` | 待处理交易 | 交易记录 |
| `refreshMs` | 刷新间隔 (默认 30000ms) | 配置 |
| `viewMode` | 视图模式 (card/list) | UI 配置 |

### 1.2 刷新机制

```javascript
// 页面加载时：读取本地数据 → 立即刷新
const saved = JSON.parse(localStorage.getItem('funds') || '[]');
if (saved.length) refreshAll(codes);

// 定时刷新：根据 refreshMs 配置
timerRef.current = setInterval(() => {
  refreshAll(codes);
}, refreshMs);  // 默认 30 秒，可配置 5-300 秒
```

### 1.3 云端同步 (登录用户)

通过 `storageHelper` 封装，登录后自动同步到 Supabase：

```javascript
storageHelper.setItem('funds', JSON.stringify(funds));
// → 写入 localStorage
// → 触发云端同步 scheduleSync()
```

### 1.4 数据存储总结

| 数据类型 | 存储方式 | 刷新策略 |
|----------|----------|----------|
| 基金列表、配置 | localStorage + Supabase | 页面加载、定时刷新 |
| 实时估值、涨跌幅 | **不存储** | 每次实时调用接口 |
| 重仓股 | localStorage 缓存 | 首次加载/定时刷新 |

**核心逻辑**: 基金代码本地持久化，估值数据实时查询。这样既保证刷新不丢失数据，又能获取最新行情。

---

## 2. Supabase 简介

**Supabase** 是一个开源的 **后端即服务 (BaaS)** 平台，类似于 Firebase，但基于 PostgreSQL。

### 2.1 核心功能

| 功能 | 说明 |
|------|------|
| **数据库** | PostgreSQL 关系型数据库，支持 SQL 查询 |
| **认证 (Auth)** | 邮箱登录、OAuth、魔法链接等 |
| **存储 (Storage)** | 文件上传、图片托管 |
| **实时订阅 (Realtime)** | WebSocket 实时数据同步 |
| **边缘函数 (Edge Functions)** | 服务端函数 (Deno) |

### 2.2 本项目中的应用

```
用户登录 (邮箱验证码)
     │
     ▼
┌─────────────────────────────────┐
│  Supabase Auth                  │
│  - 邮箱发送验证码               │
│  - 用户身份认证                 │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│  Supabase Database (PostgreSQL) │
│  - user_configs 表              │
│  - 存储用户的基金列表配置        │
│  - 行级安全 (RLS) 隔离数据       │
└─────────────────────────────────┘
```

### 2.3 主要用途

1. **用户登录/注册** - 邮箱验证码登录
2. **配置云同步** - 登录用户的基金列表、分组配置同步到云端
3. **多端同步** - 换设备登录后自动恢复配置

### 2.4 为什么选择 Supabase

| 对比项 | Supabase | 自建后端 |
|--------|----------|----------|
| 开发成本 | 免费额度足够 | 需要服务器、数据库 |
| 认证系统 | 开箱即用 | 需自己实现 |
| 数据安全 | RLS 行级安全 | 需自己实现 |
| 部署 | 无需后端部署 | 需要部署服务器 |

**简单说**: Supabase 让这个纯前端项目也能拥有用户系统和云同步能力，无需自建后端服务器。

### 2.5 免费额度

| 资源 | 免费额度 |
|------|----------|
| 数据库 | 500 MB |
| 存储 | 1 GB |
| 带宽 | 5 GB/月 |
| 邮件 | 2 封/小时 (可配置自定义 SMTP) |

### 2.6 官方资源

- 官网: https://supabase.com
- 文档: https://supabase.com/docs
- GitHub: https://github.com/supabase/supabase
