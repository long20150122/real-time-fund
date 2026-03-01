/**
 * 技术指标计算模块
 * 独立、可复用的指标计算函数
 * 
 * 包含指标：
 * - RSI (Relative Strength Index) 相对强弱指标
 */

/**
 * 计算RSI指标
 * RSI = 100 - 100 / (1 + RS)
 * RS = 平均上涨幅度 / 平均下跌幅度
 * 
 * @param {Array} closes - 收盘价数组，按时间升序排列（旧 -> 新）
 * @param {number} period - RSI周期（默认6、12、24）
 * @returns {Array} RSI值数组，与输入数组长度相同，前period-1个为null
 */
export function calculateRSI(closes, period) {
  if (!closes || closes.length < period) {
    return closes.map(() => null);
  }

  const rsiValues = [];
  const gains = []; // 上涨幅度
  const losses = []; // 下跌幅度

  // 计算每日涨跌幅
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // 前period-1个数据无法计算RSI
  for (let i = 0; i < period - 1; i++) {
    rsiValues.push(null);
  }

  // 计算第一个RSI值（使用简单平均）
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    rsiValues.push(100);
  } else {
    const rs = avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  // 计算后续RSI值（使用平滑平均）
  for (let i = period; i < gains.length; i++) {
    // 使用Wilder平滑方法
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
  }

  return rsiValues;
}

/**
 * 批量计算多个周期的RSI
 * @param {Array} closes - 收盘价数组
 * @param {Array<number>} periods - 周期数组，默认 [6, 12, 24]
 * @returns {Object} { rsi6: [], rsi12: [], rsi24: [] }
 */
export function calculateMultipleRSI(closes, periods = [6, 12, 24]) {
  const result = {};
  
  for (const period of periods) {
    result[`rsi${period}`] = calculateRSI(closes, period);
  }
  
  return result;
}

/**
 * 格式化RSI值为字符串（保留2位小数）
 * @param {number|null} value - RSI值
 * @returns {string} 格式化后的字符串
 */
export function formatRSI(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return value.toFixed(2);
}
