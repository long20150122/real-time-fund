'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchlist } from './index';
import StockKlineModal from '../StockKlineChart';
import { useToast, useConfirmDialog } from '../UI';
import FavoriteButton from './FavoriteButton';
import { useStockDrag } from './DragDropContext';

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(2) + '万';
  return num?.toLocaleString() || '0';
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.split('T')[0].slice(5);
}

/**
 * 获取涨跌颜色（红涨绿跌）
 */
function getChangeColor(value) {
  if (value > 0) return 'var(--danger)';
  if (value < 0) return 'var(--success)';
  return 'var(--muted)';
}

/**
 * 计算自选收益
 */
function calculateReturn(currentPrice, addPrice) {
  if (!currentPrice || !addPrice || addPrice === 0) return null;
  return ((currentPrice - addPrice) / addPrice) * 100;
}

/**
 * 计算实体涨幅
 */
function calculateBodyPercent(open, close) {
  if (!open || open === 0) return null;
  return ((close - open) / open) * 100;
}

/**
 * 拖拽手柄图标（三条横线）
 */
function DragHandleIcon({ width = 12, height = 12, style }) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 12 12" 
      fill="currentColor"
      style={{ ...style, pointerEvents: 'none' }}
    >
      <rect x="1" y="2" width="10" height="1.5" rx="0.5" />
      <rect x="1" y="5" width="10" height="1.5" rx="0.5" />
      <rect x="1" y="8" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

/**
 * 股票列表项组件（支持拖拽）
 */
function StockItem({ 
  stock, 
  onRemove, 
  onClick, 
  onDragStart, 
  onDragEnd, 
  onDragOver, 
  onDrop,
  isDragging: isDraggingFromProps,
  isDragOver,
  realtimeData,
  showActions,
  onMouseEnter,
  onMouseLeave,
  onToggleFavorite,
  onApiUpdateFavorite,
}) {
  // 跨分类拖拽 Hook
  const { isDragging: isCrossCategoryDragging, handleDragStart, handleDragEnd } = useStockDrag(stock);

  // 合并拖拽状态
  const isDragging = isDraggingFromProps || isCrossCategoryDragging;

  // 合并数据（保留 stock 的名称，因为 realtimeData 的名称是 GBK 乱码）
  const displayData = { ...stock, ...realtimeData, stock_name: stock.stock_name };
  const change = realtimeData?.change || 0;
  const changePercent = realtimeData?.change_percent || 0;
  const changeColor = getChangeColor(change);

  const addPrice = stock.add_price;
  const currentPrice = realtimeData?.price;
  const watchReturn = calculateReturn(currentPrice, addPrice);
  const returnColor = getChangeColor(watchReturn);

  const openPrice = realtimeData?.open;
  const closePrice = realtimeData?.price;
  const bodyPercent = calculateBodyPercent(openPrice, closePrice);
  const bodyColor = getChangeColor(bodyPercent);

  // 处理拖拽开始：同时触发排序和跨分类拖拽
  const handleCombinedDragStart = useCallback((e) => {
    // 先调用跨分类拖拽
    handleDragStart(e);
    // 再调用排序拖拽（如果有的话）
    if (onDragStart) onDragStart(e);
  }, [handleDragStart, onDragStart]);

  // 处理拖拽结束
  const handleCombinedDragEnd = useCallback(() => {
    handleDragEnd();
    if (onDragEnd) onDragEnd();
  }, [handleDragEnd, onDragEnd]);

  return (
    <div
      onClick={() => onClick(stock)}
      draggable
      onDragStart={handleCombinedDragStart}
      onDragEnd={handleCombinedDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 20px 80px 56px 50px 54px 52px 52px 52px 76px 76px 50px 46px 46px 52px',
        gap: 4,
        padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        transition: 'opacity 0.15s, background 0.15s',
        cursor: 'pointer',
        opacity: isDragging ? 0.5 : 1,
        background: isDragOver ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
      }}
    >
      {/* 关注按钮 */}
      <FavoriteButton
        stockId={stock.id}
        isFavorite={stock.is_favorite}
        onToggle={(isFavorite) => onToggleFavorite(stock.id, isFavorite)}
        onApiUpdate={onApiUpdateFavorite}
        size={14}
      />
      {/* 拖拽手柄 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          padding: '2px',
          borderRadius: 4,
          transition: 'background 0.15s',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragHandleIcon width={10} height={10} style={{ opacity: 0.4 }} />
      </div>

      {/* 股票名称和代码 */}
      <div style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
        <div style={{
          fontWeight: 500,
          fontSize: 11,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {displayData.stock_name || '-'}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--muted)', lineHeight: 1 }}>
          {displayData.stock_code}
        </div>
      </div>

      {/* 最新价 */}
      <div style={{ fontWeight: 600, fontSize: 11, textAlign: 'right', color: changeColor }}>
        {displayData.price?.toFixed(2) || '-'}
      </div>

      {/* 上涨 */}
      <div style={{ color: changeColor, fontWeight: 500, fontSize: 10, textAlign: 'right' }}>
        {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(2)}` : '-'}
      </div>

      {/* 涨跌幅 */}
      <div style={{ color: changeColor, fontWeight: 500, fontSize: 10, textAlign: 'right' }}>
        {changePercent !== 0 ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '-'}
      </div>

      {/* 自选日 */}
      <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)' }}>
        {formatDate(stock.add_date)}
      </div>

      {/* 自选价 */}
      <div style={{ fontSize: 10, textAlign: 'right' }}>
        {addPrice ? addPrice.toFixed(2) : '-'}
      </div>

      {/* 自选收益 */}
      <div style={{ fontSize: 10, textAlign: 'right', color: returnColor, fontWeight: 500 }}>
        {watchReturn !== null ? `${watchReturn > 0 ? '+' : ''}${watchReturn.toFixed(2)}%` : '-'}
      </div>

      {/* 总市值 */}
      <div style={{ fontSize: 9, textAlign: 'right' }}>
        {displayData.total_cap ? formatNumber(displayData.total_cap) : '-'}
      </div>

      {/* 流通市值 */}
      <div style={{ fontSize: 9, textAlign: 'right' }}>
        {displayData.float_cap ? formatNumber(displayData.float_cap) : '-'}
      </div>

      {/* 实体涨幅 */}
      <div style={{ fontSize: 9, textAlign: 'right', color: bodyColor }}>
        {bodyPercent !== null ? `${bodyPercent > 0 ? '+' : ''}${bodyPercent.toFixed(2)}%` : '-'}
      </div>

      {/* RSI6 */}
      <div style={{
        fontSize: 9,
        textAlign: 'right',
        color: displayData.rsi6 > 70 ? 'var(--danger)' : displayData.rsi6 < 30 ? 'var(--success)' : 'inherit',
      }}>
        {displayData.rsi6?.toFixed(1) || '-'}
      </div>

      {/* RSI极值 */}
      <div style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'right' }}>
        {displayData.rsi6_max_6m?.toFixed(0) || '-'}/{displayData.rsi6_min_6m?.toFixed(0) || '-'}
      </div>

      {/* 操作按钮 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(stock);
              }}
              style={{
                padding: '1px 5px',
                fontSize: 8,
                border: 'none',
                background: 'rgba(248, 113, 113, 0.15)',
                color: 'var(--danger)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              删除
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 拖拽排序 Hook
 */
function useDragSort(onReorder) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragStart = useCallback((index) => (e) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleDragOver = useCallback((index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((targetIndex) => (e) => {
    e.preventDefault();
    
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    // 执行重新排序
    onReorder(dragIndex, targetIndex);
    
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, onReorder]);

  return {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}

/**
 * 右侧股票列表组件
 */
export default function WatchlistContent() {
  // 使用 Context 中的共享数据，避免重复请求
  const { selectedCategory, stocks, loading, user, fetchStocks, setStocks, realtimeDataMap } = useWatchlist();
  const [selectedStock, setSelectedStock] = useState(null);
  const [hoveredStockId, setHoveredStockId] = useState(null);
  const toast = useToast();
  const confirmDialog = useConfirmDialog();

  // 删除股票
  const handleRemove = useCallback(async (stock) => {
    const confirmed = await confirmDialog.confirm({
      title: '移除股票',
      message: `确定要将「${stock.stock_name || stock.stock_code}」从自选中移除吗？`,
      confirmText: '移除',
      cancelText: '取消',
      danger: true,
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/watchlist-stocks?id=${stock.id}&user_id=${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchStocks();
        toast.success('已移除');
      }
    } catch (error) {
      console.error('删除股票失败:', error);
      toast.error('移除失败');
    }
  }, [user?.id, fetchStocks, confirmDialog, toast]);

  // 重新排序处理 - 优化：直接更新本地状态，避免重新加载
  const handleReorder = useCallback(async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    // 创建新的排序数组
    const newStocks = [...stocks];
    const [movedItem] = newStocks.splice(fromIndex, 1);
    newStocks.splice(toIndex, 0, movedItem);

    // 立即更新本地状态（乐观更新）
    setStocks(newStocks);

    // 构建更新数据（倒序：第一个是最大的sort_order）
    const updates = newStocks.map((stock, index) => ({
      id: stock.id,
      category_id: stock.category_id,
      sort_order: newStocks.length - index,
    }));

    // 调用API批量更新
    try {
      const res = await fetch('/api/watchlist-stocks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          updates,
        }),
      });
      
      if (!res.ok) {
        // 如果失败，恢复原状
        fetchStocks();
        toast.error('排序更新失败');
      }
    } catch (error) {
      console.error('更新排序失败:', error);
      // 如果失败，恢复原状
      fetchStocks();
      toast.error('排序更新失败');
    }
  }, [stocks, user?.id, setStocks, fetchStocks, toast]);

  const {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useDragSort(handleReorder);

  // 点击股票行
  const handleStockClick = useCallback((stock) => {
    if (!stock.has_history) {
      toast.info('数据还在准备中，稍等1-2分钟');
      return;
    }
    setSelectedStock({ code: stock.stock_code, name: stock.stock_name });
  }, [toast]);

  // 关闭K线图弹窗
  const handleCloseKline = useCallback(() => {
    setSelectedStock(null);
  }, []);

  // 切换关注状态（本地更新）
  const handleToggleFavorite = useCallback((stockId, isFavorite) => {
    setStocks(prevStocks =>
      prevStocks.map(s =>
        s.id === stockId ? { ...s, is_favorite: isFavorite } : s
      )
    );
  }, [setStocks]);

  // API 更新关注状态
  const handleApiUpdateFavorite = useCallback(async (stockId, isFavorite) => {
    const res = await fetch('/api/watchlist-stocks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: stockId,
        user_id: user.id,
        is_favorite: isFavorite,
      }),
    });
    if (!res.ok) {
      throw new Error('更新失败');
    }
    return res.json();
  }, [user?.id]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCategory?.name || '选择分类'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--muted)', flexShrink: 0 }}>
            {stocks.length} 只
          </span>
        </div>
      </div>

      {/* 表头 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '20px 20px 80px 56px 50px 54px 52px 52px 52px 76px 76px 50px 46px 46px 52px',
        gap: 4,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        fontSize: '8px',
        color: 'var(--muted)',
        background: 'rgba(255, 255, 255, 0.02)',
      }}>
        <div></div>
        <div></div>
        <div>股票名称</div>
        <div style={{ textAlign: 'right' }}>最新价</div>
        <div style={{ textAlign: 'right' }}>上涨</div>
        <div style={{ textAlign: 'right' }}>涨跌幅</div>
        <div style={{ textAlign: 'center' }}>自选日</div>
        <div style={{ textAlign: 'right' }}>自选价</div>
        <div style={{ textAlign: 'right' }}>自选收益</div>
        <div style={{ textAlign: 'right' }}>总市值</div>
        <div style={{ textAlign: 'right' }}>流通市值</div>
        <div style={{ textAlign: 'right' }}>实体涨幅</div>
        <div style={{ textAlign: 'right' }}>RSI6</div>
        <div style={{ textAlign: 'right' }}>RSI极值</div>
        <div></div>
      </div>

      {/* 股票列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: 13 }}>
            加载中...
          </div>
        ) : stocks.length > 0 ? (
          stocks.map((stock, index) => (
            <StockItem 
              key={stock.id} 
              stock={stock} 
              realtimeData={realtimeDataMap[stock.stock_code]}
              showActions={hoveredStockId === stock.id}
              onClick={handleStockClick}
              onRemove={handleRemove}
              onDragStart={handleDragStart(index)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              isDragging={dragIndex === index}
              isDragOver={overIndex === index && dragIndex !== index}
              onMouseEnter={() => setHoveredStockId(stock.id)}
              onMouseLeave={() => setHoveredStockId(null)}
              onToggleFavorite={handleToggleFavorite}
              onApiUpdateFavorite={handleApiUpdateFavorite}
            />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 13 }}>暂无数据</div>
            <div style={{ fontSize: '11px', marginTop: 6 }}>点击右上角「添加」开始添加股票</div>
          </div>
        )}
      </div>

      {/* K线图弹窗 */}
      <AnimatePresence>
        {selectedStock && (
          <StockKlineModal
            stock={selectedStock}
            onClose={handleCloseKline}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
