'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * 拖拽上下文
 * 
 * 用于在股票列表和分类列表之间共享拖拽状态
 */
const DragDropContext = createContext(null);

/**
 * 拖拽类型常量
 */
export const DragTypes = {
  STOCK: 'stock',
};

/**
 * 拖拽上下文提供者
 */
export function DragDropProvider({ children, onMoveStock }) {
  // 当前拖拽的股票数据
  const [draggedStock, setDraggedStock] = useState(null);
  // 当前拖拽悬停的分类ID
  const [dropTargetId, setDropTargetId] = useState(null);
  // 是否正在拖拽
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽计数器（用于处理 dragEnter/dragLeave 事件）
  const dragCounterRef = useRef(0);

  /**
   * 开始拖拽股票
   */
  const startDrag = useCallback((stock) => {
    setDraggedStock(stock);
    setIsDragging(true);
  }, []);

  /**
   * 结束拖拽
   */
  const endDrag = useCallback(() => {
    setDraggedStock(null);
    setDropTargetId(null);
    setIsDragging(false);
    dragCounterRef.current = 0;
  }, []);

  /**
   * 进入拖放目标
   */
  const enterDropTarget = useCallback((categoryId) => {
    dragCounterRef.current++;
    setDropTargetId(categoryId);
  }, []);

  /**
   * 离开拖放目标
   */
  const leaveDropTarget = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setDropTargetId(null);
      dragCounterRef.current = 0;
    }
  }, []);

  /**
   * 执行放置
   */
  const handleDrop = useCallback(async (targetCategoryId) => {
    if (!draggedStock || !targetCategoryId) return false;
    
    // 不能移动到当前所在分类
    if (draggedStock.category_id === targetCategoryId) {
      return false;
    }

    // 调用移动回调
    if (onMoveStock) {
      try {
        await onMoveStock(draggedStock, targetCategoryId);
        return true;
      } catch (error) {
        console.error('移动股票失败:', error);
        return false;
      }
    }
    return false;
  }, [draggedStock, onMoveStock]);

  const value = {
    // 状态
    draggedStock,
    dropTargetId,
    isDragging,
    
    // 方法
    startDrag,
    endDrag,
    enterDropTarget,
    leaveDropTarget,
    handleDrop,
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}

/**
 * 使用拖拽上下文的 Hook
 */
export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within DragDropProvider');
  }
  return context;
}

/**
 * 股票拖拽 Hook
 * 用于股票列表项
 */
export function useStockDrag(stock) {
  const { startDrag, endDrag, isDragging, draggedStock } = useDragDrop();
  
  const isThisDragging = draggedStock?.id === stock.id;

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stock.stock_code);
    startDrag(stock);
  }, [stock, startDrag]);

  const handleDragEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return {
    isDragging: isThisDragging,
    handleDragStart,
    handleDragEnd,
  };
}

/**
 * 分类拖放目标 Hook
 * 用于分类项
 */
export function useCategoryDrop(categoryId, currentStockCategoryId) {
  const { 
    dropTargetId, 
    enterDropTarget, 
    leaveDropTarget, 
    handleDrop,
    endDrag,
    draggedStock,
  } = useDragDrop();

  const isDropTarget = dropTargetId === categoryId;
  const canDrop = draggedStock?.category_id !== categoryId;

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    enterDropTarget(categoryId);
  }, [categoryId, enterDropTarget]);

  const handleDragLeave = useCallback(() => {
    leaveDropTarget();
  }, [leaveDropTarget]);

  const handleDrop_ = useCallback(async (e) => {
    e.preventDefault();
    const success = await handleDrop(categoryId);
    endDrag();
    return success;
  }, [categoryId, handleDrop, endDrag]);

  return {
    isDropTarget,
    canDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop: handleDrop_,
  };
}
