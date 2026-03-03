/**
 * 单个产业链卡片组件
 * 职责：卡片渲染、拖拽启动
 */
'use client';

import { useCallback } from 'react';

// 拖拽手柄图标
function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

export default function ChainCard({
  chain,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}) {
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('application/drag-type', 'chain');
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(chain);
  }, [chain, onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      style={{
        background: 'var(--bg-tertiary, #16213e)',
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        border: '2px solid transparent',
        opacity: isDragging ? 0.5 : 1,
        borderColor: isDragging ? 'var(--primary, #4f46e5)' : 'transparent',
        height: '100%',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = 'var(--bg-hover, #1a2744)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary, #16213e)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary, #fff)',
        }}>
          {chain.name}
        </span>
        <span
          style={{
            color: 'var(--text-secondary, #888)',
            cursor: 'grab',
            padding: 4,
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          className="drag-handle"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DragHandleIcon />
        </span>
      </div>
      
      {chain.description && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary, #888)',
          marginBottom: 8,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}>
          {chain.description}
        </div>
      )}
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'var(--text-muted, #666)',
        marginTop: 'auto',
      }}>
        <span>{chain.conceptCount || 0} 个概念</span>
      </div>
    </div>
  );
}
