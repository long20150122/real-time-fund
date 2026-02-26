# 数据拆分测试报告

**测试时间**: 2026-02-26T06:22:34.245Z

## 测试摘要

| 指标 | 值 |
|------|-----|
| 总测试数 | 35 |
| 通过 | 34 |
| 失败 | 0 |
| 警告 | 1 |
| 通过率 | 97.1% |

## 测试范围

1. **数据文件存在性与结构测试** - 验证两个CSV文件存在且字段正确
2. **数据完整性测试** - 验证数据无缺失、格式正确、数值合理
3. **API接口测试** - 验证所有API正常工作且返回正确数据
4. **爬虫脚本测试** - 验证爬虫已更新支持双表写入
5. **迁移脚本测试** - 验证迁移脚本存在且逻辑正确

## 数据拆分说明

### stock_quarter_finance.csv (静态季度财务数据)
- 字段: id, stock_code, stock_name, report_quarter, report_year, report_date, quarter_revenue, quarter_net_profit, quarter_deducted_net_profit, revenue_yoy, net_profit_yoy, deducted_net_profit_yoy, basic_eps, eps_yoy, bps, roe, gross_margin, ttm_revenue, ttm_net_profit, created_at
- 更新频率: 按季度更新

### stock_history.csv (动态历史数据)
- 字段: id, stock_code, stock_name, trade_date, pe_ttm, pb, ps, total_market_cap, float_market_cap, ttm_eps, created_at
- 更新频率: 每日更新

## 测试详情

### 通过项
- ✅ [数据文件] stock_quarter_finance.csv 存在
- ✅ [数据文件] stock_history.csv 存在
- ✅ [数据文件] 季度财务表解析: 1139 条记录
- ✅ [数据文件] 历史动态表解析: 1140 条记录
- ✅ [数据文件] 季度财务表字段完整性: 20 个字段全部存在
- ✅ [数据文件] 历史动态表字段完整性: 11 个字段全部存在
- ✅ [数据拆分] 季度财务表不含动态字段: 动态字段已正确移除
- ✅ [数据拆分] 历史动态表不含静态字段: 静态字段已正确移除
- ✅ [数据完整性] 两表股票代码一致: 57 只股票
- ✅ [数据完整性] 季度财务表-季度字段: 空值: 0/1139
- ✅ [数据完整性] 季度财务表-营收字段: 空值: 0/1139
- ✅ [数据完整性] 历史动态表-日期字段: 空值: 0/1140
- ✅ [数据完整性] 季度财务表-代码格式
- ✅ [数据完整性] 历史动态表-代码格式
- ✅ [数据完整性] 季度格式(YYYYQx)
- ✅ [数据完整性] 日期格式(YYYY-MM-DD)
- ✅ [数据完整性] 季度财务-quarter_revenue非空率: 100.0%
- ✅ [数据完整性] 季度财务-quarter_net_profit非空率: 100.0%
- ✅ [数据完整性] 季度财务-basic_eps非空率: 99.2%
- ✅ [数据完整性] 季度财务-roe非空率: 99.1%
- ✅ [数据完整性] 季度财务数据量: 57 只股票, 21 个季度, 1139 条记录
- ✅ [数据完整性] 历史动态数据量: 57 只股票, 22 个日期, 1140 条记录
- ✅ [爬虫脚本] quarterFinanceSpider.js 存在
- ✅ [爬虫脚本] 关键函数检查: 全部检查项通过
- ✅ [爬虫脚本] 历史表写入逻辑: 已实现拆分写入
- ✅ [迁移脚本] migrateStockData.js 存在
- ✅ [迁移脚本] 拆分逻辑: 已实现数据拆分
- ✅ [API接口] GET /api/stock-finance (概览): 1139 条记录，57 只股票
- ✅ [API接口] GET /api/stock-finance?code=002027: 20 条记录，含动态数据
- ✅ [API接口] GET /api/stock-history?code=002027: 21 条历史记录
- ✅ [API接口] GET /api/stock-finance?peg=all: 57 只股票，12 只低估
- ✅ [API接口] GET /api/stock-finance?quarter=2025Q3: 57 条记录
- ✅ [API接口] 不存在的股票返回404
- ✅ [API接口] GET /api/stock-finance?codes=...: 返回 40 条记录

### 失败项
无

### 警告项
- ⚠️ [数据完整性] 数值合理性: 1 条可能异常

## 结论

✅ 所有测试通过，数据拆分成功，功能正常
