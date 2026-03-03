/**
 * 产业链拖拽相关 Hooks
 * 职责：拖拽状态管理、放置逻辑
 */
'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * 产业链拖拽状态管理 Hook
 */
export function useChainDrag() {
  const [draggedChain, setDraggedChain] = useState(null);

  const handleDragStart = useCallback((chain) => {
    setDraggedChain(chain);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedChain(null);
  }, []);

  return {
    draggedChain,
    handleDragStart,
    handleDragEnd,
  };
}

/**
 * 产业链放置 Hook
 */
export function useChainDrop(targetChain, draggedChain, onReorder) {
  const [dropPosition, setDropPosition] = useState(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const dropRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 检查是否是产业链拖拽
    const dragType = e.dataTransfer.types.includes('application/drag-type');
    if (!dragType || !draggedChain || draggedChain.id === targetChain.id) {
      setIsDropTarget(false);
      setDropPosition(null);
      return;
    }

    setIsDropTarget(true);

    // 计算放置位置（基于元素中心点）
    if (dropRef.current) {
      const rect = dropRef.current.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropPosition(e.clientY < midY ? 'before' : 'after');
    }
  }, [draggedChain, targetChain.id]);

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDropTarget(false);

    if (!draggedChain || draggedChain.id === targetChain.id) {
      setDropPosition(null);
      return;
    }

    // 执行排序回调
    onReorder?.(draggedChain, targetChain, dropPosition);
    setDropPosition(null);
  }, [draggedChain, targetChain, dropPosition, onReorder]);

  // 创建 ref 回调
  const setRef = useCallback((node) => {
    dropRef.current = node;
    if (node) {
      node.addEventListener('dragover', handleDragOver);
      node.addEventListener('dragleave', handleDragLeave);
      node.addEventListener('drop', handleDrop);
    }
  }, [handleDragOver, handleDragLeave, handleDrop]);

  return {
    isDropTarget,
    dropPosition,
    dropRef: setRef,
  };
}
