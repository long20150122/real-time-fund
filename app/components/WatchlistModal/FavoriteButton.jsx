'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * 心形图标组件
 */
function HeartIcon({ filled, width = 14, height = 14 }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  );
}

/**
 * 关注按钮组件
 * 
 * 特性：
 * - 松耦合：只依赖 props，不依赖外部状态
 * - 可扩展：支持自定义样式和回调
 * - 乐观更新：先更新 UI，再同步服务器
 * 
 * @param {Object} props
 * @param {string} props.stockId - 股票记录ID
 * @param {boolean} props.isFavorite - 当前关注状态
 * @param {Function} props.onToggle - 状态变更回调 (isFavorite: boolean) => void
 * @param {Function} props.onApiUpdate - API 更新函数，返回 Promise
 */
export default function FavoriteButton({
  stockId,
  isFavorite: initialIsFavorite,
  onToggle,
  onApiUpdate,
  size = 14,
  style = {},
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async (e) => {
    e.stopPropagation();
    
    if (isLoading) return;

    const newIsFavorite = !isFavorite;
    
    // 乐观更新 UI
    setIsFavorite(newIsFavorite);
    setIsLoading(true);

    try {
      // 调用外部 API 更新函数
      if (onApiUpdate) {
        await onApiUpdate(stockId, newIsFavorite);
      }
      
      // 通知父组件状态变更
      if (onToggle) {
        onToggle(newIsFavorite);
      }
    } catch (error) {
      // 失败时回滚
      setIsFavorite(!newIsFavorite);
      console.error('更新关注状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [stockId, isFavorite, isLoading, onToggle, onApiUpdate]);

  return (
    <motion.button
      onClick={handleClick}
      disabled={isLoading}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        border: 'none',
        background: 'transparent',
        cursor: isLoading ? 'wait' : 'pointer',
        color: isFavorite ? 'var(--danger)' : 'var(--muted)',
        opacity: isLoading ? 0.6 : 1,
        transition: 'color 0.2s, opacity 0.2s',
        ...style,
      }}
      title={isFavorite ? '取消关注' : '添加关注'}
      aria-label={isFavorite ? '取消关注' : '添加关注'}
    >
      <HeartIcon filled={isFavorite} width={size} height={size} />
    </motion.button>
  );
}
