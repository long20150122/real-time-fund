# 开发接口文档 (dev.md)

本文档记录项目使用的所有外部数据接口，采用 JSONP / Script Tag Injection 方式调用，纯前端运行。

---

## 1. 基金实时估值接口

### 1.1 天天基金 (主接口)

**接口地址**
```
https://fundgz.1234567.com.cn/js/{fundCode}.js?rt={timestamp}
```

**请求方式**: JSONP (通过 `<script>` 标签注入)

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fundCode | string | 是 | 6位基金代码，如 `110022` |
| rt | number | 否 | 时间戳，防止缓存 |

**回调函数**: `window.jsonpgz`

**返回数据结构**
```javascript
{
  "fundcode": "110022",      // 基金代码
  "name": "易方达消费行业",   // 基金名称
  "jzrq": "2024-01-15",      // 净值日期
  "dwjz": "3.8520",          // 单位净值
  "gsz": "3.8678",           // 估算净值
  "gszzl": "0.41",           // 估算涨跌幅(%)
  "gztime": "2024-01-16 15:00" // 估值时间
}
```

**调用示例**
```javascript
const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;
const script = document.createElement('script');
script.src = url;
window.jsonpgz = (data) => {
  console.log(data);
  // 处理数据...
};
document.body.appendChild(script);
```

---

## 2. 基金搜索接口

### 2.1 东方财富基金搜索

**接口地址**
```
https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key={keyword}&callback={callbackName}&_={timestamp}
```

**请求方式**: JSONP

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| m | number | 是 | 固定值 `1` |
| key | string | 是 | 搜索关键词（基金代码或名称） |
| callback | string | 是 | JSONP 回调函数名 |
| _ | number | 否 | 时间戳，防止缓存 |

**返回数据结构**
```javascript
{
  "Datas": [
    {
      "CODE": "110022",           // 基金代码
      "NAME": "易方达消费行业股票", // 基金全称
      "SHORTNAME": "易方达消费行业", // 基金简称
      "CATEGORY": "700",          // 类别（700=基金）
      "CATEGORYDESC": "基金"       // 类别描述
    }
  ]
}
```

**调用示例**
```javascript
const callbackName = `SuggestData_${Date.now()}`;
const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${keyword}&callback=${callbackName}`;

window[callbackName] = (data) => {
  const funds = data.Datas.filter(d => d.CATEGORY === '700');
  console.log(funds);
};
// 创建 script 标签注入...
```

---

## 3. 基金净值历史接口

### 3.1 东方财富净值历史

**接口地址**
```
https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code={fundCode}&page={page}&per={perPage}&sdate={startDate}&edate={endDate}
```

**请求方式**: JSONP

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 `lsjz` |
| code | string | 是 | 6位基金代码 |
| page | number | 否 | 页码，默认 `1` |
| per | number | 否 | 每页条数，默认 `10` |
| sdate | string | 否 | 开始日期，格式 `YYYY-MM-DD` |
| edate | string | 否 | 结束日期，格式 `YYYY-MM-DD` |

**返回数据**: HTML 表格片段，存储在 `window.apidata.content`

**解析方式**
```javascript
// 解析 HTML 表格获取净值
const rows = content.split('<tr>');
for (const row of rows) {
  if (row.includes(`<td>${date}</td>`)) {
    const cells = row.match(/<td[^>]*>(.*?)<\/td>/g);
    // cells[1] 为净值
  }
}
```

---

## 4. 腾讯财经接口

### 4.1 基金数据补充

**接口地址**
```
https://qt.gtimg.cn/q=jj{fundCode}
```

**请求方式**: Script Tag Injection

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 查询代码，格式 `jj` + 基金代码 |

**返回数据**: 全局变量 `window.v_jj{fundCode}`

**数据格式**: `~` 分隔的字符串
```javascript
// 示例: window.v_jj110022
"v_jj110022=\"1~易方达消费行业~...~3.8520~...~0.41~2024-01-15~...\""

// 解析
const parts = data.split('~');
// parts[1]  - 基金名称
// parts[5]  - 单位净值
// parts[7]  - 涨跌幅(%)
// parts[8]  - 净值日期 (前10位为日期)
// parts[30] - 更新时间 (前8位为日期 YYYYMMDD)
```

### 4.2 股票实时行情

**接口地址**
```
https://qt.gtimg.cn/q={stockCodes}
```

**请求方式**: Script Tag Injection

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 股票代码列表，逗号分隔 |

**股票代码格式**

| 市场类型 | 格式 | 示例 |
|----------|------|------|
| 上海A股 | `sh{code}` | `sh600519` |
| 深圳A股 | `sz{code}` | `sz000858` |
| 北京A股 | `bj{code}` | `bj830799` |
| 港股 | `hk{code}` | `hk00700` |

**简化格式** (仅返回涨跌幅):
```
s_sh600519    // 上海
s_sz000858    // 深圳
s_bj830799    // 北京
s_hk00700     // 港股
```

**返回数据**: 全局变量 `window.v_{code}`

**数据格式**
```javascript
// 示例
"v_s_sh600519=\"1~贵州茅台~...~1700.00~...~2.35~...\""

// 解析
const parts = data.split('~');
// parts[1]  - 股票名称
// parts[3]  - 当前价格
// parts[5]  - 涨跌幅(%)
// parts[30] - 日期
```

**市场判断规则**
```javascript
const getMarketPrefix = (code) => {
  if (code.startsWith('6') || code.startsWith('9')) return 'sh';  // 上海
  if (code.startsWith('4') || code.startsWith('8')) return 'bj';  // 北京
  return 'sz';  // 深圳
};
```

### 4.3 上证指数

**接口地址**
```
https://qt.gtimg.cn/q=sh000001
```

**返回数据**: `window.v_sh000001`

**用途**: 获取最新交易日日期
```javascript
const parts = data.split('~');
const dateStr = parts[30].slice(0, 8);  // YYYYMMDD
```

---

## 5. 基金持仓接口

### 5.1 前十大重仓股

**接口地址**
```
https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code={fundCode}&topline=10&year=&month=&_={timestamp}
```

**请求方式**: JSONP

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 `jjcc` |
| code | string | 是 | 6位基金代码 |
| topline | number | 是 | 返回条数，默认 `10` |
| year | string | 否 | 年份，为空取最新 |
| month | string | 否 | 月份，为空取最新 |
| _ | number | 否 | 时间戳 |

**返回数据**: HTML 表格，存储在 `window.apidata.content`

**HTML 结构**
```html
<thead>
  <tr>
    <th>序号</th>
    <th>股票代码</th>
    <th>股票名称</th>
    <th>占净值比例</th>
    ...
  </tr>
</thead>
<tbody>
  <tr>
    <td>1</td>
    <td>600519</td>
    <td>贵州茅台</td>
    <td>8.52%</td>
    ...
  </tr>
</tbody>
```

**解析逻辑**
```javascript
// 1. 获取表头确定列索引
const headerCells = headerRow.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi);
let idxCode = -1, idxName = -1, idxWeight = -1;
headerCells.forEach((h, i) => {
  if (h.includes('股票代码') || h.includes('证券代码')) idxCode = i;
  if (h.includes('股票名称') || h.includes('证券名称')) idxName = i;
  if (h.includes('占净值比例') || h.includes('占比')) idxWeight = i;
});

// 2. 解析表格行
const rows = html.match(/<tr[\s\S]*?<\/tr>/gi);
for (const row of rows) {
  const tds = row.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi);
  const code = tds[idxCode].replace(/<[^>]*>/g, '').trim();
  const name = tds[idxName].replace(/<[^>]*>/g, '').trim();
  const weight = tds[idxWeight].replace(/<[^>]*>/g, '').trim();
  holdings.push({ code, name, weight });
}
```

---

## 6. 内部 API 接口 (CSV 存储)

### 6.1 用户接口 `/api/users`

**GET 获取用户**
```
GET /api/users?email={email}
GET /api/users?id={id}
```

**POST 创建/更新用户**
```
POST /api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "用户名"
}
```

### 6.2 基金接口 `/api/funds`

**GET 获取用户基金列表**
```
GET /api/funds?userId={userId}
```

**POST 添加基金**
```
POST /api/funds
Content-Type: application/json

{
  "userId": "xxx",
  "code": "110022",
  "name": "易方达消费行业",
  "groupId": "可选"
}
```

**PUT 更新基金**
```
PUT /api/funds
Content-Type: application/json

{
  "id": "xxx",
  "name": "新名称",
  "groupId": "分组ID"
}
```

**DELETE 删除基金**
```
DELETE /api/funds?id={id}
DELETE /api/funds?userId={userId}&code={code}
```

### 6.3 收藏接口 `/api/favorites`

**GET 获取收藏**
```
GET /api/favorites?userId={userId}
```

**POST 添加收藏**
```
POST /api/favorites
Content-Type: application/json

{
  "userId": "xxx",
  "code": "110022"
}
```

**DELETE 取消收藏**
```
DELETE /api/favorites?userId={userId}&code={code}
```

### 6.4 配置接口 `/api/configs`

**GET 获取配置**
```
GET /api/configs?userId={userId}
```

**POST 保存配置**
```
POST /api/configs
Content-Type: application/json

{
  "userId": "xxx",
  "data": {
    "refreshMs": 30000,
    "viewMode": "card",
    "groups": [...],
    "collapsedCodes": [...]
  }
}
```

---

## 7. 其他接口

### 6.1 GitHub Releases (版本检测)

**接口地址**
```
https://api.github.com/repos/hzm0321/real-time-fund/releases/latest
```

**请求方式**: Fetch API

**返回数据**
```javascript
{
  "tag_name": "v0.1.5",
  "body": "更新说明..."
}
```

### 6.2 Web3Forms (反馈提交)

**接口地址**
```
https://api.web3forms.com/submit
```

**请求方式**: POST (FormData)

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| access_key | string | 是 | Web3Forms Access Key |
| email | string | 是 | 用户邮箱 |
| message | string | 是 | 反馈内容 |

---

## 7. 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户输入基金代码                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  天天基金 API (JSONP)                                        │
│  https://fundgz.1234567.com.cn/js/{code}.js                 │
│  → 基金名称、实时估值、涨跌幅                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌─────────────────────────────────────┐
│ 腾讯财经 API      │    │ 东方财富持仓 API (JSONP)             │
│ qt.gtimg.cn      │    │ fundf10.eastmoney.com               │
│ → 补充净值数据    │    │ → 前10大重仓股代码、名称、占比        │
└──────────────────┘    └─────────────────┬───────────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────────┐
                          │ 腾讯财经 API (批量查询)            │
                          │ qt.gtimg.cn/q=s_sh600519,...      │
                          │ → 重仓股实时涨跌幅                 │
                          └───────────────────────────────────┘
```

---

## 8. 注意事项

### 8.1 跨域处理
- 所有接口通过 JSONP 或 Script Tag Injection 调用
- 无需后端代理，支持纯前端部署 (如 GitHub Pages)

### 8.2 错误处理
- 设置超时机制 (通常 3-5 秒)
- 主接口失败时使用备用接口
- 清理全局变量和 DOM 节点，防止内存泄漏

### 8.3 数据可靠性
- 数据来自公开接口，可能存在延迟
- 估值数据仅供参考，不作为投资建议
- 建议添加频率限制，避免频繁请求

### 8.4 代码清理
```javascript
// 请求完成后清理
const cleanup = () => {
  if (document.body.contains(script)) {
    document.body.removeChild(script);
  }
  delete window[callbackName];
};
```
