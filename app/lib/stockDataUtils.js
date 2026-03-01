/**
 * 股票数据工具模块
 * 统一股票数据解析、格式化逻辑
 * 
 * 腾讯接口字段索引（从0开始）：
 * 0: 未知
 * 1: 股票名称（GBK编码，不建议直接使用）
 * 2: 股票代码
 * 3: 当前价格
 * 4: 昨日收盘价
 * 5: 今日开盘价
 * 6: 成交量（手）
 * 7: 成交额（万元）
 * ...
 * 30: 时间戳
 * 31: 涨跌幅（百分比）✅
 * 32: 涨跌额
 * 33: 最高价 ✅
 * 34: 最低价 ✅
 * ...
 * 44: 总市值（亿元）
 * 45: 流通市值（亿元）
 * 46: 市盈率（PE-TTM）
 * 47: 市净率（PB）
 */

/**
 * 根据股票代码获取市场代码（腾讯接口格式）
 */
export function getTencentCode(stockCode) {
  if (!stockCode) return '';
  if (stockCode.length === 5) return `hk${stockCode}`; // 港股
  if (stockCode.startsWith('6')) return `sh${stockCode}`; // 上海
  return `sz${stockCode}`; // 深圳
}

/**
 * 根据股票代码判断市场类型
 */
export function getStockType(code) {
  if (!code) return { market: 'sz', type: '主板' };
  const isHK = code.length === 5;
  if (isHK) return { market: 'hk', type: '港股' };
  if (code.startsWith('68')) return { market: 'sh', type: '科创板' };
  if (code.startsWith('30')) return { market: 'sz', type: '创业板' };
  if (code.startsWith('8') || code.startsWith('4')) return { market: 'bj', type: '北交所' };
  if (code.startsWith('6')) return { market: 'sh', type: '主板' };
  return { market: 'sz', type: '主板' };
}

/**
 * 根据股票代码获取东方财富 secid
 */
export function getSecId(code) {
  if (!code) return '';
  if (code.length === 5) return `116.${code}`; // 港股
  if (code.startsWith('6')) return `1.${code}`; // 上海
  return `0.${code}`; // 深圳
}

/**
 * 格式化数字（大数字转换为亿/万）
 */
export function formatNumber(num) {
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(2) + '万';
  return num?.toLocaleString() || '0';
}

/**
 * 格式化涨跌幅（带颜色类名）
 */
export function formatChangePercent(change) {
  if (change === null || change === undefined) return { text: '-', className: '' };
  const sign = change > 0 ? '+' : '';
  const className = change > 0 ? 'up' : change < 0 ? 'down' : '';
  return {
    text: `${sign}${change.toFixed(2)}%`,
    className,
  };
}

/**
 * 格式化市值（智能单位）
 */
export function formatCap(cap) {
  if (!cap || cap === 0) return '-';
  return formatNumber(cap);
}
