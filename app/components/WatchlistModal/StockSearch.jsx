'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon, CloseIcon } from '../Icons';
import { useWatchlist } from './index';
import { useToast } from '../UI';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

/**
 * 获取涨跌颜色（红涨绿跌）
 */
function getChangeColor(value) {
  if (value > 0) return 'var(--danger)';  // 红色
  if (value < 0) return 'var(--success)'; // 绿色
  return 'var(--muted)';
}

/**
 * 股票搜索组件
 */
export default function StockSearch({ onClose, onStockAdded }) {
  const { user, selectedCategory } = useWatchlist();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // 锁定背景滚动
  useLockBodyScroll(true);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 搜索股票
  const handleSearch = useCallback(async (kw) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/stock-search?keyword=${encodeURIComponent(kw)}&limit=20`);
      const data = await res.json();
      setResults(data.stocks || []);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, handleSearch]);

  // 添加股票
  const handleAddStock = useCallback(async (stock) => {
    try {
      const res = await fetch('/api/watchlist-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          category_id: selectedCategory?.id || null,
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onStockAdded?.();
        toast.success('添加成功');
      } else {
        toast.error(data.error || '添加失败');
      }
    } catch (error) {
      console.error('添加股票失败:', error);
      toast.error('添加失败');
    }
  }, [user?.id, selectedCategory, onStockAdded, toast]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10020,
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          height: 480,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* 标题 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>添加股票</span>
          <button
            onClick={onClose}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              opacity: 0.5,
              lineHeight: 1,
            }}
          >
            <CloseIcon width="16" height="16" />
          </button>
        </div>

        {/* 搜索框 */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'var(--bg)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            <SearchIcon width="16" height="16" style={{ opacity: 0.4, flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索股票代码、名称或拼音首字母"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                outline: 'none',
                color: 'var(--text)',
                minWidth: 0,
              }}
            />
            {keyword && (
              <button
                onClick={() => setKeyword('')}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  opacity: 0.4,
                  lineHeight: 1,
                }}
              >
                <CloseIcon width="14" height="14" />
              </button>
            )}
          </div>
        </div>

        {/* 表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 60px 60px',
          gap: 8,
          padding: '6px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--muted)',
          background: 'rgba(255, 255, 255, 0.02)',
          flexShrink: 0,
        }}>
          <div>股票名称</div>
          <div style={{ textAlign: 'right' }}>最新价</div>
          <div style={{ textAlign: 'right' }}>上涨</div>
          <div style={{ textAlign: 'right' }}>涨跌幅</div>
        </div>

        {/* 搜索结果 - 固定高度，内容滚动 */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: 13 }}>
              搜索中...
            </div>
          ) : results.length > 0 ? (
            results.map((stock) => {
              const change = stock.change || 0;
              const changePct = stock.change_pct || 0;
              const changeColor = getChangeColor(change);
              
              return (
                <div
                  key={stock.stock_code}
                  onClick={() => handleAddStock(stock)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 70px 60px 60px',
                    gap: 8,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* 股票名称和代码 */}
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ 
                      fontWeight: 500, 
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{stock.stock_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: 8 }}>
                      <span>{stock.stock_code}</span>
                      <span>{stock.type}</span>
                    </div>
                  </div>
                  
                  {/* 最新价 */}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14, color: changeColor }}>
                    {stock.price ? stock.price.toFixed(2) : '-'}
                  </div>
                  
                  {/* 上涨（涨跌额） */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: changeColor, fontWeight: 500 }}>
                    {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(2)}` : '-'}
                  </div>
                  
                  {/* 涨跌幅 */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: changeColor, fontWeight: 500 }}>
                    {changePct !== 0 ? `${change > 0 ? '+' : ''}${changePct.toFixed(2)}%` : '-'}
                  </div>
                </div>
              );
            })
          ) : keyword ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: 13 }}>
              未找到匹配的股票
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 13 }}>输入股票代码、名称或拼音首字母搜索</div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--muted)',
          flexShrink: 0,
        }}>
          点击股票即可添加到自选
        </div>
      </motion.div>
    </motion.div>
  );
}
