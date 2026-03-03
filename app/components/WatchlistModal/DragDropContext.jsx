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
  CATEGORY: 'category',
};

/**
 * 拖拽上下文提供者
 */
export function DragDropProvider({ children, onMoveStock, onReorderCategories }) {
  // 当前拖拽的股票数据
  const [draggedStock, setDraggedStock] = useState(null);
  // 当前拖拽悬停的分类ID
  const [dropTargetId, setDropTargetId] = useState(null);
  // 是否正在拖拽
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽计数器（用于处理 dragEnter/dragLeave 事件）
  const dragCounterRef = useRef(0);

  // ========== 分类拖拽状态 ==========
  // 当前拖拽的分类数据
  const [draggedCategory, setDraggedCategory] = useState(null);
  // 分类拖拽悬停目标
  const [categoryDropTarget, setCategoryDropTarget] = useState(null);
  // 分类拖拽计数器
  const categoryDragCounterRef = useRef(0);

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

  // ========== 分类拖拽方法 ==========

  /**
   * 开始拖拽分类
   */
  const startCategoryDrag = useCallback((category) => {
    setDraggedCategory(category);
  }, []);

  /**
   * 结束分类拖拽
   */
  const endCategoryDrag = useCallback(() => {
    setDraggedCategory(null);
    setCategoryDropTarget(null);
    categoryDragCounterRef.current = 0;
  }, []);

  /**
   * 进入分类拖放目标
   */
  const enterCategoryDropTarget = useCallback((targetCategory) => {
    categoryDragCounterRef.current++;
    setCategoryDropTarget(targetCategory);
  }, []);

  /**
   * 离开分类拖放目标
   */
  const leaveCategoryDropTarget = useCallback(() => {
    categoryDragCounterRef.current--;
    if (categoryDragCounterRef.current <= 0) {
      setCategoryDropTarget(null);
      categoryDragCounterRef.current = 0;
    }
  }, []);

  /**
   * 执行分类排序
   */
  const handleCategoryDrop = useCallback(async (targetCategory, position) => {
    if (!draggedCategory || !targetCategory) return false;
    
    // 不能拖到自己身上
    if (draggedCategory.id === targetCategory.id) {
      return false;
    }

    // 调用排序回调
    if (onReorderCategories) {
      try {
        await onReorderCategories(draggedCategory, targetCategory, position);
        return true;
      } catch (error) {
        console.error('分类排序失败:', error);
        return false;
      }
    }
    return false;
  }, [draggedCategory, onReorderCategories]);

  const value = {
    // 股票拖拽状态
    draggedStock,
    dropTargetId,
    isDragging,
    
    // 股票拖拽方法
    startDrag,
    endDrag,
    enterDropTarget,
    leaveDropTarget,
    handleDrop,

    // 分类拖拽状态
    draggedCategory,
    categoryDropTarget,

    // 分类拖拽方法
    startCategoryDrag,
    endCategoryDrag,
    enterCategoryDropTarget,
    leaveCategoryDropTarget,
    handleCategoryDrop,
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
    e.dataTransfer.setData('application/drag-type', 'stock');
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
 * 用于分类项（接收股票拖放）
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
    // 只接受股票拖拽
    if (e.dataTransfer.types.includes('application/drag-type') && 
        e.dataTransfer.getData('application/drag-type') === 'category') {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e) => {
    // 只接受股票拖拽
    if (e.dataTransfer.types.includes('application/drag-type') && 
        e.dataTransfer.getData('application/drag-type') === 'category') {
      return;
    }
    e.preventDefault();
    enterDropTarget(categoryId);
  }, [categoryId, enterDropTarget]);

  const handleDragLeave = useCallback(() => {
    leaveDropTarget();
  }, [leaveDropTarget]);

  const handleDrop_ = useCallback(async (e) => {
    // 只接受股票拖拽
    const dragType = e.dataTransfer.getData('application/drag-type');
    if (dragType === 'category') {
      return false;
    }
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

/**
 * 分类拖拽 Hook
 * 用于分类项本身的拖拽排序
 */
export function useCategoryDrag(category) {
  const { startCategoryDrag, endCategoryDrag, draggedCategory } = useDragDrop();
  
  const isThisDragging = draggedCategory?.id === category.id;

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/drag-type', 'category');
    e.dataTransfer.setData('application/category-id', category.id);
    startCategoryDrag(category);
  }, [category, startCategoryDrag]);

  const handleDragEnd = useCallback(() => {
    endCategoryDrag();
  }, [endCategoryDrag]);

  return {
    isDragging: isThisDragging,
    handleDragStart,
    handleDragEnd,
  };
}

/**
 * 分类排序放置目标 Hook
 * 用于分类项接收其他分类的拖放排序
 */
export function useCategoryReorderDrop(category, onReorder) {
  const { 
    categoryDropTarget, 
    enterCategoryDropTarget, 
    leaveCategoryDropTarget, 
    handleCategoryDrop,
    endCategoryDrag,
    draggedCategory,
  } = useDragDrop();

  // 判断放置位置（上方或下方）
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'after'
  const dropRef = useRef(null);

  const isDropTarget = categoryDropTarget?.id === category.id;
  const canDrop = draggedCategory && draggedCategory.id !== category.id;

  const handleDragOver = useCallback((e) => {
    // 只接受分类拖拽
    const dragType = e.dataTransfer.getData('application/drag-type');
    if (dragType !== 'category') {
      e.dataTransfer.dropEffect = 'move';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 计算放置位置
    if (dropRef.current) {
      const rect = dropRef.current.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropPosition(e.clientY < midY ? 'before' : 'after');
    }
  }, []);

  const handleDragEnter = useCallback((e) => {
    // 只接受分类拖拽
    const dragType = e.dataTransfer.getData('application/drag-type');
    if (dragType !== 'category') return;
    
    e.preventDefault();
    enterCategoryDropTarget(category);
  }, [category, enterCategoryDropTarget]);

  const handleDragLeave = useCallback((e) => {
    // 确保是真正离开了元素（而不是进入子元素）
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      leaveCategoryDropTarget();
      setDropPosition(null);
    }
  }, [leaveCategoryDropTarget]);

  const handleDrop_ = useCallback(async (e) => {
    const dragType = e.dataTransfer.getData('application/drag-type');
    if (dragType !== 'category') return false;
    
    e.preventDefault();
    
    if (draggedCategory && draggedCategory.id !== category.id && dropPosition) {
      if (onReorder) {
        await onReorder(draggedCategory, category, dropPosition);
      }
    }
    
    endCategoryDrag();
    setDropPosition(null);
    return true;
  }, [category, dropPosition, draggedCategory, endCategoryDrag, onReorder]);

  return {
    isDropTarget,
    canDrop,
    dropPosition,
    dropRef,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop: handleDrop_,
  };
}
