'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderIcon, FolderOpenIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon, EditIcon, TrashIcon } from '../Icons';
import { useWatchlist } from './index';
import { useToast } from '../UI';
import CategoryStats, { calculateCategoryStats } from './CategoryStats';
import { useCategoryDrop } from './DragDropContext';

/**
 * 分类项组件
 */
function CategoryItem({ category, level = 0, onSelect, onEdit, onDelete, onAddChild, stats }) {
  const { selectedCategory } = useWatchlist();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);

  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedCategory?.id === category.id;
  const isSystem = category.is_system === '1';

  // 拖放目标功能
  const {
    isDropTarget,
    canDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  } = useCategoryDrop(category.id, selectedCategory?.id);

  // 处理放置
  const handleDrop_ = useCallback(async (e) => {
    e.preventDefault();
    await handleDrop(e);
  }, [handleDrop]);
  
  // 计算子分类的合计统计
  const childStats = useMemo(() => {
    if (!hasChildren) return null;
    let totalStocks = 0;
    let totalFavorites = 0;
    let weightedSum = 0;
    let totalFloatCap = 0;
    let hasValidData = false;
    
    const collectChildStats = (cat) => {
      const catStats = stats?.[cat.id];
      if (catStats) {
        totalStocks += catStats.total || 0;
        totalFavorites += catStats.favoriteCount || 0;
        // 注意：这里无法直接累加加权涨跌幅，需要重新计算
      }
      if (cat.children) {
        cat.children.forEach(collectChildStats);
      }
    };
    
    category.children.forEach(collectChildStats);
    
    return { total: totalStocks, favoriteCount: totalFavorites };
  }, [hasChildren, category, stats]);

  // 使用子分类合计或自身统计
  const displayStats = hasChildren ? childStats : stats?.[category.id];

  return (
    <div style={{ marginLeft: level * 12 }}>
      <div
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => onSelect(category)}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop_}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '7px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          background: isDropTarget 
            ? 'rgba(34, 197, 94, 0.2)' 
            : isSelected 
              ? 'rgba(96, 165, 250, 0.15)' 
              : 'transparent',
          marginBottom: 2,
          transition: 'background 0.15s, transform 0.15s',
          gap: 6,
          transform: isDropTarget ? 'scale(1.02)' : 'scale(1)',
          outline: isDropTarget ? '2px solid var(--success)' : 'none',
        }}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon width="14" height="14" />
            ) : (
              <ChevronRightIcon width="14" height="14" />
            )}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {/* 文件夹图标 */}
        {isSelected ? (
          <FolderOpenIcon width="16" height="16" style={{ color: 'var(--primary)', flexShrink: 0 }} />
        ) : (
          <FolderIcon width="16" height="16" style={{ flexShrink: 0 }} />
        )}

        {/* 分类名称 */}
        <span style={{ 
          flex: 1, 
          fontSize: isDropTarget ? '15px' : '13px',
          fontWeight: isDropTarget ? 600 : 400,
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          minWidth: 0,
          transition: 'font-size 0.15s, font-weight 0.15s',
        }}>{category.name}</span>

        {/* 统计信息 */}
        <CategoryStats
          total={displayStats?.total || 0}
          favoriteCount={displayStats?.favoriteCount || 0}
          avgChange={hasChildren ? null : displayStats?.avgChange}
          upCount={displayStats?.upCount || 0}
          downCount={displayStats?.downCount || 0}
        />

        {/* 系统标签 */}
        {isSystem && (
          <span style={{
            fontSize: '10px',
            padding: '1px 5px',
            background: 'rgba(96, 165, 250, 0.15)',
            borderRadius: 3,
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            默认
          </span>
        )}

        {/* 操作按钮 */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', gap: 2, flexShrink: 0 }}
            >
              {/* 大分类可以添加小分类 */}
              {!category.parent_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(category);
                  }}
                  style={{
                    padding: '2px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    opacity: 0.5,
                    lineHeight: 1,
                  }}
                  title="添加子分类"
                >
                  <PlusIcon width="12" height="12" />
                </button>
              )}
              {/* 非系统分类可以编辑删除 */}
              {!isSystem && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(category);
                    }}
                    style={{
                      padding: '2px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      opacity: 0.5,
                      lineHeight: 1,
                    }}
                    title="编辑"
                  >
                    <EditIcon width="12" height="12" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(category);
                    }}
                    style={{
                      padding: '2px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      opacity: 0.5,
                      lineHeight: 1,
                    }}
                    title="删除"
                  >
                    <TrashIcon width="12" height="12" />
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 子分类 */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {category.children.map(child => (
              <CategoryItem
                key={child.id}
                category={child}
                level={level + 1}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                stats={stats}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 左侧分类管理组件
 */
export default function WatchlistSidebar() {
  // 使用 Context 中的共享数据，避免重复请求
  const { user, categories, fetchCategories, setSelectedCategory, allStocks, realtimeDataMap } = useWatchlist();
  const toast = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 按分类分组股票（使用共享的 allStocks）
  const stocksByCategory = useMemo(() => {
    const map = {};
    if (allStocks && allStocks.length > 0) {
      allStocks.forEach(stock => {
        const catId = stock.category_id;
        if (!map[catId]) map[catId] = [];
        map[catId].push(stock);
      });
    }
    return map;
  }, [allStocks]);

  // 计算分类统计数据（使用共享的 realtimeDataMap）
  const categoryStatsMap = useMemo(() => {
    const map = {};
    Object.keys(stocksByCategory).forEach(catId => {
      const stocks = stocksByCategory[catId];
      map[catId] = calculateCategoryStats(stocks, realtimeDataMap || {});
    });
    return map;
  }, [stocksByCategory, realtimeDataMap]);

  // 选择分类
  const handleSelect = useCallback((category) => {
    setSelectedCategory({ ...category, type: 'category' });
  }, [setSelectedCategory]);

  // 添加分类
  const handleAddCategory = useCallback(async (parentId = null) => {
    if (!inputValue.trim()) return;

    try {
      const res = await fetch('/api/watchlist-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          parent_id: parentId,
          name: inputValue.trim(),
        }),
      });

      if (res.ok) {
        fetchCategories();
        setShowAddModal(false);
        setAddParentId(null);
        setInputValue('');
      }
    } catch (error) {
      console.error('添加分类失败:', error);
    }
  }, [user?.id, inputValue, fetchCategories]);

  // 编辑分类
  const handleEditCategory = useCallback(async () => {
    if (!inputValue.trim() || !editingCategory) return;

    try {
      const res = await fetch('/api/watchlist-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory.id,
          user_id: user.id,
          name: inputValue.trim(),
        }),
      });

      if (res.ok) {
        fetchCategories();
        setEditingCategory(null);
        setInputValue('');
      }
    } catch (error) {
      console.error('编辑分类失败:', error);
    }
  }, [user?.id, editingCategory, inputValue, fetchCategories]);

  // 删除分类
  const handleDeleteCategory = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`/api/watchlist-categories?id=${deleteConfirm.id}&user_id=${user.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok) {
        fetchCategories();
        setDeleteConfirm(null);
        toast.success('分类已删除');
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除分类失败:', error);
      toast.error('删除失败');
    }
  }, [user?.id, deleteConfirm, fetchCategories, toast]);

  // 打开添加子分类
  const handleAddChild = useCallback((parent) => {
    setAddParentId(parent.id);
    setShowAddModal(true);
    setInputValue('');
  }, []);

  // 打开编辑
  const handleEdit = useCallback((category) => {
    setEditingCategory(category);
    setInputValue(category.name);
  }, []);

  // 打开删除确认
  const handleDelete = useCallback((category) => {
    setDeleteConfirm(category);
  }, []);

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 标题和添加按钮 */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>分类</span>
        <button
          className="icon-button"
          onClick={() => {
            setAddParentId(null);
            setShowAddModal(true);
            setInputValue('');
          }}
          style={{ width: 28, height: 28 }}
          title="新建分类"
        >
          <PlusIcon width="14" height="14" />
        </button>
      </div>

      {/* 分类树 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
        {categories.map(category => (
          <CategoryItem
            key={category.id}
            category={category}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            stats={categoryStatsMap}
          />
        ))}

        {categories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13 }}>
            暂无分类
          </div>
        )}
      </div>

      {/* 添加/编辑分类弹窗 */}
      <AnimatePresence>
        {(showAddModal || editingCategory) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => {
              setShowAddModal(false);
              setEditingCategory(null);
              setInputValue('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass card"
              onClick={(e) => e.stopPropagation()}
              style={{ padding: 16, width: 300 }}
            >
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>
                {editingCategory ? '编辑分类' : addParentId ? '添加子分类' : '添加大分类'}
              </h3>
              <input
                type="text"
                placeholder="请输入分类名称"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (editingCategory ? handleEditCategory() : handleAddCategory(addParentId))}
                className="input"
                style={{ width: '100%', height: 38 }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  className="icon-button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                    setInputValue('');
                  }}
                  style={{ width: 'auto', padding: '0 12px' }}
                >
                  取消
                </button>
                <button
                  className="button"
                  onClick={() => editingCategory ? handleEditCategory() : handleAddCategory(addParentId)}
                  style={{ height: 36 }}
                >
                  {editingCategory ? '保存' : '添加'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass card"
              onClick={(e) => e.stopPropagation()}
              style={{ padding: 16, width: 300 }}
            >
              <h3 style={{ marginBottom: 8, fontSize: 15 }}>确认删除</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
                确定要删除分类「{deleteConfirm.name}」吗？
                <br />
                <small style={{ fontSize: 12 }}>分类下的股票将移至默认分类</small>
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="icon-button" onClick={() => setDeleteConfirm(null)} style={{ width: 'auto', padding: '0 12px' }}>
                  取消
                </button>
                <button 
                  className="icon-button danger" 
                  onClick={handleDeleteCategory}
                  style={{ width: 'auto', padding: '0 12px' }}
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
