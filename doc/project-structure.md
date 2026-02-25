# 实时基金估值系统 - 项目结构说明文档

## 一、项目概述

**项目名称**: real-time-fund (基估宝)  
**版本**: 0.1.5  
**技术栈**: Next.js 16 + React 18 + CSV 存储  
**描述**: 一个实时显示基金估值与前十大重仓股票的 Web 应用

### 核心功能

1. **基金实时估值**: 实时获取并显示基金净值、估值涨幅
2. **重仓股票展示**: 展示基金前十大重仓股票及其涨跌幅
3. **用户登录认证**: 基于账户密码的用户认证系统
4. **基金收藏管理**: 用户可收藏常用基金
5. **数据持久化**: 使用 CSV 文件进行轻量级数据存储
6. **反馈系统**: 用户意见反馈提交

---

## 二、目录结构

```
e:\github\real-time-fund\
│
├── app/                          # Next.js App Router 主目录
│   ├── api/                      # API 路由
│   │   ├── fund.js               # 基金数据获取 API
│   │   ├── auth/                 # 认证相关
│   │   │   └── route.js          # 认证 API
│   │   ├── configs/              # 用户配置 API
│   │   │   └── route.js          # 配置 CRUD
│   │   ├── favorites/            # 收藏 API
│   │   │   └── route.js          # 收藏 CRUD
│   │   ├── funds/                # 用户基金 API
│   │   │   └── route.js          # 基金 CRUD
│   │   └── users/                # 用户 API
│   │       ├── route.js          # 用户 CRUD
│   │       └── login/            # 登录 API
│   │           └── route.js      # 登录验证
│   │
│   ├── assets/                   # 静态资源
│   │   ├── github.svg            # GitHub 图标
│   │   ├── weChatGroup.png       # 微信群二维码
│   │   ├── weixin.jpg            # 微信收款码
│   │   └── zhifubao.jpg          # 支付宝收款码
│   │
│   ├── components/               # React 组件
│   │   ├── AnalyticsGate.jsx     # Google Analytics 入口
│   │   ├── Announcement.jsx      # 公告弹窗组件
│   │   ├── Common.jsx            # 通用组件(日期选择器、捐赠等)
│   │   └── Icons.jsx             # SVG 图标组件库
│   │
│   ├── lib/                      # 工具库
│   │   ├── api.js                # CSV API 客户端
│   │   ├── csv.js                # CSV 文件操作工具
│   │   └── supabase.js           # Supabase 客户端(可选)
│   │
│   ├── login/                    # 登录页面
│   │   └── page.jsx              # 登录页面组件
│   │
│   ├── globals.css               # 全局样式
│   ├── icon.svg                  # 网站图标
│   ├── layout.jsx                # 根布局
│   └── page.jsx                  # 主页面(核心功能)
│
├── data/                         # CSV 数据存储目录
│   ├── users.csv                 # 用户数据
│   ├── funds.csv                 # 用户基金列表
│   ├── favorites.csv             # 用户收藏
│   └── configs.csv               # 用户配置
│
├── doc/                          # 文档目录
│   └── project-structure.md      # 本文档
│
├── .github/                      # GitHub 配置
│   └── workflows/                # CI/CD 工作流
│       ├── docker-ci.yml         # Docker CI
│       └── nextjs.yml            # Next.js CI
│
├── .next/                        # Next.js 构建输出(自动生成)
├── .vercel/                      # Vercel 配置
├── .trae/                        # 开发工具配置
│
├── .env.local                    # 本地环境变量
├── .gitignore                    # Git 忽略配置
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 构建文件
├── env.example                   # 环境变量示例
├── next.config.js                # Next.js 配置
├── package.json                  # 项目依赖
├── supabase.sql                  # Supabase 数据库脚本
└── vercel.json                   # Vercel 部署配置
```

---

## 三、核心文件详解

### 3.1 主页面 (`app/page.jsx`)

**文件大小**: 约 5200 行代码  
**功能**: 应用核心功能实现

**主要模块**:

| 模块名          | 功能描述         |
| --------------- | ---------------- |
| `FeedbackModal` | 意见反馈弹窗     |
| `WeChatModal`   | 微信群二维码弹窗 |
| `DonateModal`   | 捐赠支持弹窗     |
| `FundCard`      | 基金卡片组件     |
| `HoldingsRow`   | 重仓股行组件     |
| `SearchModal`   | 基金搜索弹窗     |
| `GroupManager`  | 分组管理组件     |
| `SettingsModal` | 设置弹窗         |
| `LoginModal`    | 登录弹窗(备用)   |
| `Home`          | 主组件           |

**状态管理**:

```javascript
// 用户状态
const [user, setUser] = useState(null);
const [checkingAuth, setCheckingAuth] = useState(true);

// 基金数据
const [funds, setFunds] = useState([]);
const [fundDataMap, setFundDataMap] = useState({});

// UI 状态
const [searchOpen, setSearchOpen] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
// ... 更多状态
```

**核心功能流程**:

1. 页面加载时检查 localStorage 中的用户登录状态
2. 未登录用户重定向到 `/login` 页面
3. 已登录用户加载其基金列表和收藏
4. 通过 JSONP 调用外部 API 获取实时基金数据
5. 支持基金的增删改查、分组管理、排序等操作

---

### 3.2 登录页面 (`app/login/page.jsx`)

**功能**: 用户登录界面

**登录流程**:

```
用户输入账户密码
    → POST /api/users/login
    → 验证账户密码
    → 返回用户信息(不含密码)
    → 存储到 localStorage
    → 跳转首页
```

**预置账户**:
| 字段 | 值 |
|------|-----|
| 账户 | ft |
| 密码 | 123456 |

---

### 3.3 CSV 工具库 (`app/lib/csv.js`)

**功能**: 提供完整的 CSV 文件 CRUD 操作

**API 列表**:

| 函数名                      | 参数                 | 返回值           | 功能                |
| --------------------------- | -------------------- | ---------------- | ------------------- |
| `ensureDataDir()`           | 无                   | void             | 确保 data 目录存在  |
| `initCSVFiles()`            | 无                   | void             | 初始化所有 CSV 文件 |
| `readAll(type)`             | 表类型               | Array            | 读取所有记录        |
| `writeAll(type, records)`   | 表类型, 记录数组     | void             | 写入所有记录        |
| `add(type, record)`         | 表类型, 记录对象     | 新记录           | 添加一条记录        |
| `update(type, id, updates)` | 表类型, ID, 更新对象 | 更新后记录       | 更新记录            |
| `remove(type, id)`          | 表类型, ID           | boolean          | 删除记录            |
| `find(type, predicate)`     | 表类型, 条件函数     | 记录或 undefined | 查找单条记录        |
| `findAll(type, predicate)`  | 表类型, 条件函数     | 记录数组         | 查找所有匹配记录    |

**CSV 文件表头定义**:

```javascript
const HEADERS = {
  users: "id,username,password,email,name,created_at,updated_at",
  funds: "id,user_id,code,name,group_id,created_at",
  favorites: "id,user_id,code,created_at",
  configs: "id,user_id,data,updated_at",
};
```

---

### 3.4 基金数据 API (`app/api/fund.js`)

**功能**: 通过 JSONP 方式获取基金实时数据

**主要接口**:

| 函数名                               | 数据来源   | 功能             |
| ------------------------------------ | ---------- | ---------------- |
| `fetchFundData(code)`                | 天天基金   | 获取基金实时估值 |
| `searchFunds(keyword)`               | 东方财富   | 搜索基金         |
| `fetchShanghaiIndexDate()`           | 腾讯财经   | 获取上证指数日期 |
| `fetchSmartFundNetValue(code, date)` | 东方财富   | 获取历史净值     |
| `fetchLatestRelease()`               | GitHub API | 获取最新版本信息 |
| `submitFeedback(formData)`           | Web3Forms  | 提交用户反馈     |

**外部 API 地址**:

- 天天基金估值: `https://fundgz.1234567.com.cn/js/{code}.js`
- 东方财富搜索: `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx`
- 腾讯股票: `https://qt.gtimg.cn/q={code}`
- 东方财富持仓: `https://fundf10.eastmoney.com/FundArchivesDatas.aspx`

---

### 3.5 API 路由

#### 用户 API (`app/api/users/route.js`)

```
GET  /api/users          - 获取用户列表
GET  /api/users?id=xxx   - 获取单个用户
GET  /api/users?email=xx - 通过邮箱获取用户
POST /api/users          - 创建/更新用户
```

#### 登录 API (`app/api/users/login/route.js`)

```
POST /api/users/login
Body: { username, password }
返回: { user: { id, username, email, name, ... } }
```

#### 基金 API (`app/api/funds/route.js`)

```
GET    /api/funds?userId=xxx      - 获取用户基金列表
POST   /api/funds                 - 添加基金
PUT    /api/funds                 - 更新基金
DELETE /api/funds?id=xxx          - 删除基金
DELETE /api/funds?userId=xx&code=xx - 通过代码删除
```

#### 收藏 API (`app/api/favorites/route.js`)

```
GET    /api/favorites?userId=xxx  - 获取用户收藏
POST   /api/favorites             - 添加收藏
DELETE /api/favorites?userId=xx&code=xx - 取消收藏
```

#### 配置 API (`app/api/configs/route.js`)

```
GET  /api/configs?userId=xxx - 获取用户配置
POST /api/configs            - 保存用户配置
```

---

## 四、数据存储结构

### 4.1 用户表 (`data/users.csv`)

| 字段       | 类型     | 说明        |
| ---------- | -------- | ----------- |
| id         | string   | 用户唯一 ID |
| username   | string   | 登录账户    |
| password   | string   | 登录密码    |
| email      | string   | 邮箱        |
| name       | string   | 显示名称    |
| created_at | datetime | 创建时间    |
| updated_at | datetime | 更新时间    |

**示例数据**:

```csv
id,username,password,email,name,created_at,updated_at
ft001,ft,123456,ft@example.com,默认用户,2026-01-01T00:00:00.000Z,
```

### 4.2 基金表 (`data/funds.csv`)

| 字段       | 类型     | 说明        |
| ---------- | -------- | ----------- |
| id         | string   | 记录唯一 ID |
| user_id    | string   | 用户 ID     |
| code       | string   | 基金代码    |
| name       | string   | 基金名称    |
| group_id   | string   | 分组 ID     |
| created_at | datetime | 创建时间    |

### 4.3 收藏表 (`data/favorites.csv`)

| 字段       | 类型     | 说明        |
| ---------- | -------- | ----------- |
| id         | string   | 记录唯一 ID |
| user_id    | string   | 用户 ID     |
| code       | string   | 基金代码    |
| created_at | datetime | 创建时间    |

### 4.4 配置表 (`data/configs.csv`)

| 字段       | 类型     | 说明                  |
| ---------- | -------- | --------------------- |
| id         | string   | 记录唯一 ID           |
| user_id    | string   | 用户 ID               |
| data       | JSON     | 配置数据(JSON 字符串) |
| updated_at | datetime | 更新时间              |

---

## 五、组件说明

### 5.1 图标组件 (`app/components/Icons.jsx`)

提供 20+ 个 SVG 图标组件:

| 组件名                 | 用途         |
| ---------------------- | ------------ |
| PlusIcon               | 添加按钮     |
| TrashIcon              | 删除按钮     |
| SettingsIcon           | 设置按钮     |
| RefreshIcon            | 刷新按钮     |
| UserIcon               | 用户头像占位 |
| LoginIcon / LogoutIcon | 登录/登出    |
| StarIcon               | 收藏星星     |
| DragIcon               | 拖拽排序     |
| GridIcon / ListIcon    | 视图切换     |
| ...                    | ...          |

### 5.2 通用组件 (`app/components/Common.jsx`)

| 组件名       | 功能                                   |
| ------------ | -------------------------------------- |
| DatePicker   | 日期选择器(支持月份切换、禁止未来日期) |
| DonateTabs   | 捐赠支付方式切换(支付宝/微信)          |
| NumericInput | 数字输入框(带增减按钮)                 |
| Stat         | 统计数据展示组件                       |

### 5.3 公告组件 (`app/components/Announcement.jsx`)

- 首次访问时显示公告弹窗
- 关闭后记录到 localStorage
- 显示待开发功能预告

---

## 六、样式系统 (`app/globals.css`)

### CSS 变量

```css
:root {
  --bg: #0f172a; /* 背景色 */
  --card: #111827; /* 卡片背景 */
  --text: #e5e7eb; /* 主文字色 */
  --muted: #9ca3af; /* 次要文字色 */
  --primary: #22d3ee; /* 主色调(青色) */
  --accent: #60a5fa; /* 强调色(蓝色) */
  --success: #34d399; /* 成功色(绿色) */
  --danger: #f87171; /* 危险色(红色) */
  --border: #1f2937; /* 边框色 */
}
```

### 主要样式类

| 类名               | 用途           |
| ------------------ | -------------- |
| `.glass`           | 毛玻璃效果卡片 |
| `.card`            | 卡片容器       |
| `.button`          | 主按钮         |
| `.icon-button`     | 图标按钮       |
| `.input`           | 输入框         |
| `.modal-overlay`   | 弹窗遮罩       |
| `.grid` / `.col-*` | 栅格布局       |

### 响应式断点

```css
@media (max-width: 1024px) {
  /* 中等屏幕: 所有列变为全宽 */
}

@media (max-width: 768px) {
  /* 移动端适配 */
}
```

---

## 七、依赖说明

### 生产依赖 (`package.json`)

| 依赖                  | 版本     | 用途                  |
| --------------------- | -------- | --------------------- |
| next                  | ^16.1.5  | Next.js 框架          |
| react                 | 18.3.1   | React 核心库          |
| react-dom             | 18.3.1   | React DOM 渲染        |
| @supabase/supabase-js | ^2.78.0  | Supabase 客户端(可选) |
| framer-motion         | ^12.29.2 | 动画库                |
| dayjs                 | ^1.11.19 | 日期处理              |
| @dicebear/core        | ^9.3.1   | 头像生成              |
| @dicebear/collection  | ^9.3.1   | 头像样式集            |

### 开发依赖

| 依赖                        | 版本   | 用途           |
| --------------------------- | ------ | -------------- |
| babel-plugin-react-compiler | ^1.0.0 | React 编译优化 |

### Node.js 版本要求

```
node >= 20.9.0
```

┌─────────────────────────────────────────────────────────┐
│ 前端 (浏览器) │
│ fetch('/api/funds?userId=xxx') │
└─────────────────────┬───────────────────────────────────┘
│ HTTP 请求
▼
┌─────────────────────────────────────────────────────────┐
│ 后端 (服务器) - app/api/funds/route.js │
│ │
│ GET → 查询数据 │
│ POST → 添加数据 │
│ PUT → 更新数据 │
│ DELETE → 删除数据 │
└─────────────────────┬───────────────────────────────────┘
│ 文件操作
▼
┌─────────────────────────────────────────────────────────┐
│ 数据层 │
│ data/funds.csv (CSV 文件存储) │
└─────────────────────────────────────────────────────────┘

---

## 八、环境变量

### `.env.local` 配置

```bash
# Supabase (可选,不配置则使用 CSV 存储)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Web3Forms 反馈表单
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=
```

---

## 九、部署配置

### 9.1 Vercel 部署 (`vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

### 9.2 Docker 部署

**Dockerfile**:

- 基于 Node.js 镜像
- 支持独立输出模式
- 自动安装依赖并构建

**docker-compose.yml**:

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data # 持久化 CSV 数据
```

### 9.3 GitHub Actions

- `nextjs.yml`: Next.js CI/CD 流程
- `docker-ci.yml`: Docker 构建流程

---

## 十、安全考虑

1. **密码存储**: 当前为明文存储,生产环境建议加密
2. **Session 管理**: 使用 localStorage 存储,重启浏览器后仍有效
3. **API 安全**: 无 Token 验证,生产环境需添加
4. **CORS**: JSONP 方式绕过跨域限制

---

## 十一、开发指南

### 启动开发服务器

```bash
npm run dev
```

访问: http://localhost:3000

### 构建生产版本

```bash
npm run build
npm run start
```

### 添加新用户

编辑 `data/users.csv` 文件,添加新行:

```csv
id,username,password,email,name,created_at,updated_at
新ID,账户名,密码,邮箱,显示名称,时间戳,
```

---

## 十二、待优化项

1. 密码加密存储(bcrypt)
2. JWT Token 认证
3. 数据库索引优化
4. 前端状态管理(Redux/Zustand)
5. TypeScript 类型支持
6. 单元测试覆盖
7. E2E 测试

---

**文档版本**: 1.0  
**更新日期**: 2026-02-24  
**维护者**: AI Assistant
