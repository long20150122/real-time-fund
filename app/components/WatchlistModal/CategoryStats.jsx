'use client';

import { useMemo } from 'react';

/**
 * 获取涨跌颜色
 */
function getChangeColor(value) {
  if (value > 0) return 'var(--danger)';
  if (value < 0) return 'var(--success)';
  return 'var(--muted)';
}

/**
 * 格式化涨跌幅
 */
function formatChangePercent(value) {
  if (value === null || value === undefined) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 计算分类统计数据
 * 
 * @param {Array} stocks - 分类下的股票列表
 * @param {Object} realtimeDataMap - 实时行情数据 { stock_code: data }
 * @returns {Object} { total, favoriteCount, avgChange, upCount, downCount }
 */
export function calculateCategoryStats(stocks, realtimeDataMap) {
  if (!stocks || stocks.length === 0) {
    return { total: 0, favoriteCount: 0, avgChange: null, upCount: 0, downCount: 0 };
  }

  const total = stocks.length;
  const favoriteCount = stocks.filter(s => s.is_favorite).length;

  // 计算涨跌幅简单算术平均（每只股票权重相等）
  let changeSum = 0;
  let validCount = 0;
  let upCount = 0;
  let downCount = 0;

  stocks.forEach(stock => {
    const realtime = realtimeDataMap[stock.stock_code];
    if (realtime?.change_percent !== undefined && realtime?.change_percent !== null) {
      const changePercent = realtime.change_percent;
      changeSum += changePercent;
      validCount++;
      
      if (changePercent > 0) upCount++;
      else if (changePercent < 0) downCount++;
    }
  });

  const avgChange = validCount > 0
    ? changeSum / validCount
    : null;

  return { total, favoriteCount, avgChange, upCount, downCount };
}

/**
 * 分类统计显示组件
 * 
 * 特性：
 * - 松耦合：只依赖 props
 * - 可扩展：支持自定义样式
 * 
 * @param {Object} props
 * @param {number} props.total - 股票总数
 * @param {number} props.favoriteCount - 关注股票数
 * @param {number|null} props.avgChange - 涨跌幅算术平均
 * @param {number} props.upCount - 上涨股票数
 * @param {number} props.downCount - 下跌股票数
 * @param {Object} props.style - 自定义样式
 */
export default function CategoryStats({ total, favoriteCount, avgChange, upCount, downCount, style = {} }) {
  const changeColor = getChangeColor(avgChange);
  const changeText = formatChangePercent(avgChange);

  return (
    <span style={{
      fontSize: '10px',
      color: 'var(--muted)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
      ...style,
    }}>
      <span style={{ opacity: 0.7 }}>
        ({total}/{favoriteCount})
      </span>
      <span style={{ color: changeColor, fontWeight: 500 }}>
        {changeText}
      </span>
    </span>
  );
}
