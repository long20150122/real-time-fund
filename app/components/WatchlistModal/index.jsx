'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, PlusIcon, FolderIcon } from '../Icons';
import WatchlistSidebar from './WatchlistSidebar';
import WatchlistContent from './WatchlistContent';
import StockSearch from './StockSearch';
import { ToastProvider, ConfirmDialogProvider } from '../UI';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { DragDropProvider } from './DragDropContext';

// 自选股上下文
const WatchlistContext = createContext(null);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within WatchlistProvider');
  }
  return context;
};

/**
 * 自选股弹窗主组件
 */
export default function WatchlistModal({ isOpen, onClose, user }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // 所有股票（用于统计）和实时行情（共享）
  const [allStocks, setAllStocks] = useState([]);
  const [realtimeDataMap, setRealtimeDataMap] = useState({});
  const realtimeIntervalRef = useRef(null);
  const allStocksRef = useRef([]); // 用于定时器中获取最新值

  // 同步 ref
  useEffect(() => {
    allStocksRef.current = allStocks;
  }, [allStocks]);

  // 锁定背景滚动
  useLockBodyScroll(isOpen);

  // 获取实时行情（统一管理，避免重复请求）
  const fetchRealtime = useCallback(async (stockList) => {
    const codes = stockList.map(s => s.stock_code).join(',');
    if (!codes) return;
    
    try {
      const res = await fetch(`/api/stock-realtime?codes=${codes}`);
      const data = await res.json();
      if (data.data) {
        setRealtimeDataMap(data.data);
      }
    } catch (error) {
      console.error('获取实时行情失败:', error);
    }
  }, []);

  // 初始化加载 - 并行获取分类和所有股票
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const initData = async () => {
      setLoading(true);
      try {
        // 并行请求：分类 + 所有股票（含实时行情）
        const [catRes, stocksRes] = await Promise.all([
          fetch(`/api/watchlist-categories?user_id=${user.id}`),
          fetch(`/api/watchlist-stocks?user_id=${user.id}&include_info=true`)
        ]);

        const [catData, stocksData] = await Promise.all([
          catRes.json(),
          stocksRes.json()
        ]);

        const cats = catData.categories || [];
        const allStocksList = stocksData.stocks || [];

        setCategories(cats);
        setAllStocks(allStocksList);

        // 默认选中第一个分类
        if (cats.length > 0) {
          setSelectedCategory(cats[0]);
          // 从已加载的所有股票中筛选当前分类的股票
          const firstCatId = cats[0].id;
          setStocks(allStocksList.filter(s => s.category_id === firstCatId));
        }

        // 等待实时行情加载完成后再结束 loading（避免闪烁）
        if (allStocksList.length > 0) {
          await fetchRealtime(allStocksList);
        }
      } catch (error) {
        console.error('初始化数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();

    // 启动实时行情刷新
    realtimeIntervalRef.current = setInterval(() => {
      if (allStocksRef.current.length > 0) {
        fetchRealtime(allStocksRef.current);
      }
    }, 10000);

    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, [isOpen, user?.id, fetchRealtime]);

  // 获取分类列表
  const fetchCategories = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/watchlist-categories?user_id=${user.id}`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  }, [user?.id]);

  // 获取股票列表（从本地缓存优先）
  const fetchStocks = useCallback(async () => {
    if (!user?.id || !selectedCategory) return;
    
    setLoading(true);
    const categoryId = selectedCategory.type === 'stock' ? selectedCategory.categoryId : selectedCategory.id;
    
    // 优先从已加载的数据中筛选
    const cachedStocks = allStocks.filter(s => s.category_id === categoryId);
    if (cachedStocks.length > 0) {
      setStocks(cachedStocks);
      setLoading(false);
      return;
    }

    // 缓存中没有才请求
    try {
      const res = await fetch(
        `/api/watchlist-stocks?user_id=${user.id}&category_id=${categoryId}&include_info=true`
      );
      const data = await res.json();
      setStocks(data.stocks || []);
    } catch (error) {
      console.error('获取自选股失败:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedCategory, allStocks]);

  // 选中分类变化时
  useEffect(() => {
    if (isOpen && selectedCategory && allStocks.length > 0) {
      const categoryId = selectedCategory.type === 'stock' ? selectedCategory.categoryId : selectedCategory.id;
      setStocks(allStocks.filter(s => s.category_id === categoryId));
    }
  }, [isOpen, selectedCategory, allStocks]);

  // 添加股票后刷新
  const handleStockAdded = useCallback(() => {
    fetchCategories();
    fetchStocks();
    setShowSearch(false);
  }, [fetchCategories, fetchStocks]);

  // 移动股票到其他分类
  const handleMoveStock = useCallback(async (stock, targetCategoryId) => {
    try {
      // 获取目标分类的最大排序值
      const allStocksRes = await fetch(`/api/watchlist-stocks?user_id=${user.id}&include_info=false`);
      const allStocksData = await allStocksRes.json();
      const targetStocks = (allStocksData.stocks || []).filter(s => s.category_id === targetCategoryId);
      const maxOrder = targetStocks.reduce((max, s) => Math.max(max, parseInt(s.sort_order) || 0), 0);

      // 调用 API 移动股票
      const res = await fetch('/api/watchlist-stocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stock.id,
          user_id: user.id,
          category_id: targetCategoryId,
          sort_order: maxOrder + 1, // 移动到目标分类最上面
        }),
      });

      if (!res.ok) {
        throw new Error('移动失败');
      }

      // 刷新数据
      fetchCategories();
      fetchStocks();
    } catch (error) {
      console.error('移动股票失败:', error);
      throw error;
    }
  }, [user?.id, fetchCategories, fetchStocks]);

  // 分类排序
  const handleReorderCategories = useCallback(async (draggedCategory, targetCategory, position) => {
    if (!user?.id) return;
    
    try {
      // 获取扁平化的分类列表
      const flatCategories = await fetch(`/api/watchlist-categories?user_id=${user.id}&flat=true`);
      const data = await flatCategories.json();
      const allCategories = data.categories || [];
      
      // 筛选同级别的分类
      const sameParentId = draggedCategory.parent_id || '';
      const sameLevelCategories = allCategories
        .filter(c => (c.parent_id || '') === sameParentId)
        .sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));
      
      // 找到被拖拽分类和目标分类的索引
      const draggedIndex = sameLevelCategories.findIndex(c => c.id === draggedCategory.id);
      const targetIndex = sameLevelCategories.findIndex(c => c.id === targetCategory.id);
      
      if (draggedIndex === -1 || targetIndex === -1) return;
      
      // 移除被拖拽的分类
      const [removed] = sameLevelCategories.splice(draggedIndex, 1);
      
      // 计算新位置
      let newIndex = targetIndex;
      if (draggedIndex < targetIndex) {
        newIndex = position === 'before' ? targetIndex - 1 : targetIndex;
      } else {
        newIndex = position === 'before' ? targetIndex : targetIndex + 1;
      }
      
      // 插入到新位置
      sameLevelCategories.splice(newIndex, 0, removed);
      
      // 批量更新排序
      const updates = sameLevelCategories.map((cat, index) => ({
        id: cat.id,
        sort_order: index,
      }));
      
      // 调用 API 批量更新
      const res = await fetch('/api/watchlist-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          updates,
        }),
      });
      
      if (res.ok) {
        // 刷新分类列表
        fetchCategories();
      }
    } catch (error) {
      console.error('分类排序失败:', error);
    }
  }, [user?.id, fetchCategories]);

  // Context 值
  const contextValue = useMemo(() => ({
    user,
    categories,
    setCategories,
    selectedCategory,
    setSelectedCategory,
    stocks,
    setStocks,
    loading,
    fetchCategories,
    fetchStocks,
    // 共享数据，避免子组件重复请求
    allStocks,
    realtimeDataMap,
    fetchRealtime,
  }), [user, categories, selectedCategory, stocks, loading, fetchCategories, fetchStocks, allStocks, realtimeDataMap, fetchRealtime]);

  if (!isOpen) return null;

  return (
    <WatchlistContext.Provider value={contextValue}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <motion.div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="自选股票"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass card modal watchlist-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '95vw',
                maxWidth: '1100px',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: 0,
              }}
            >
          {/* 顶部标题栏 */}
          <div className="title" style={{ 
            marginBottom: 0, 
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FolderIcon width="20" height="20" />
              <span>自选股票</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="button"
                onClick={() => setShowSearch(true)}
                style={{ 
                  height: 32, 
                  padding: '0 12px', 
                  fontSize: 13,
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                }}
              >
                <PlusIcon width="14" height="14" />
                添加
              </button>
              <button
                className="icon-button"
                onClick={onClose}
                style={{ border: 'none', background: 'transparent' }}
              >
                <CloseIcon width="20" height="20" />
              </button>
            </div>
          </div>

          {/* 主体内容 */}
          <DragDropProvider onMoveStock={handleMoveStock} onReorderCategories={handleReorderCategories}>
            <div style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
            }}>
              {/* 左侧分类管理 */}
              <WatchlistSidebar onReorderCategories={handleReorderCategories} />

              {/* 右侧股票列表 */}
              <WatchlistContent />
            </div>
          </DragDropProvider>
        </motion.div>

            {/* 股票搜索弹窗 */}
            <AnimatePresence>
              {showSearch && (
                <StockSearch
                  onClose={() => setShowSearch(false)}
                  onStockAdded={handleStockAdded}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </ConfirmDialogProvider>
      </ToastProvider>
    </WatchlistContext.Provider>
  );
}

// 导出子组件
export { default as WatchlistSidebar } from './WatchlistSidebar';
export { default as WatchlistContent } from './WatchlistContent';
export { default as StockSearch } from './StockSearch';
