/**
 * 产业链格子展示组件
 * 职责：格子布局、拖拽放置
 */
'use client';

import ChainCard from './ChainCard';
import { useChainDrop } from './hooks/useChainDrag';

export default function ChainGrid({
  chains,
  draggedChain,
  onDragStart,
  onDragEnd,
  onReorder,
  onChainClick,
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '16px',
    }}>
      {chains.map((chain) => (
        <ChainCardWithDrop
          key={chain.id}
          chain={chain}
          isDragging={draggedChain?.id === chain.id}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onReorder={onReorder}
          onClick={() => onChainClick(chain)}
          draggedChain={draggedChain}
        />
      ))}
    </div>
  );
}

// 带放置功能的卡片
function ChainCardWithDrop({
  chain,
  isDragging,
  onDragStart,
  onDragEnd,
  onReorder,
  onClick,
  draggedChain,
}) {
  const { isDropTarget, dropPosition, dropRef } = useChainDrop(
    chain,
    draggedChain,
    onReorder
  );

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* 上方放置指示器 */}
      {isDropTarget && dropPosition === 'before' && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -4,
          height: 3,
          background: 'var(--primary, #4f46e5)',
          borderRadius: 2,
          zIndex: 10,
        }} />
      )}
      
      <ChainCard
        chain={chain}
        isDragging={isDragging}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
      />
      
      {/* 下方放置指示器 */}
      {isDropTarget && dropPosition === 'after' && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -4,
          height: 3,
          background: 'var(--primary, #4f46e5)',
          borderRadius: 2,
          zIndex: 10,
        }} />
      )}
    </div>
  );
}
