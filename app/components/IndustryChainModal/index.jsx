/**
 * 产业链分析弹框 - 主入口组件
 * 职责：状态管理、数据获取、弹框容器
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChainGrid from './ChainGrid';
import ChainDetailModal from './ChainDetailModal';
import { useChainDrag } from './hooks/useChainDrag';
import { CloseIcon } from '../Icons';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

export default function IndustryChainModal({ isOpen, onClose, userId }) {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 锁定背景滚动
  useLockBodyScroll(isOpen || detailModalOpen);

  // 拖拽状态
  const { draggedChain, handleDragStart, handleDragEnd } = useChainDrag();

  // 获取产业链列表
  const fetchChains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/industry-chains?userId=${userId || ''}`);
      const data = await res.json();
      setChains(data.chains || []);
    } catch (error) {
      console.error('获取产业链数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 保存排序
  const saveSortOrder = useCallback(async (newChains) => {
    try {
      const updates = newChains.map((chain, idx) => ({
        chainId: chain.id,
        sortOrder: idx,
      }));
      await fetch('/api/industry-chains', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates }),
      });
    } catch (error) {
      console.error('保存排序失败:', error);
    }
  }, [userId]);

  // 拖拽排序处理
  const handleReorder = useCallback(async (draggedChain, targetChain, position) => {
    const newChains = [...chains];
    const draggedIndex = newChains.findIndex(c => c.id === draggedChain.id);
    const targetIndex = newChains.findIndex(c => c.id === targetChain.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 移除拖拽项
    const [removed] = newChains.splice(draggedIndex, 1);
    
    // 计算新位置
    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) newIndex--;
    if (position === 'after') newIndex++;

    // 插入新位置
    newChains.splice(newIndex, 0, removed);

    // 更新排序号
    const updatedChains = newChains.map((chain, idx) => ({
      ...chain,
      finalSortOrder: idx,
    }));

    setChains(updatedChains);
    await saveSortOrder(updatedChains);
  }, [chains, saveSortOrder]);

  // 点击产业链
  const handleChainClick = useCallback((chain) => {
    setSelectedChain(chain);
    setDetailModalOpen(true);
  }, []);

  // 初始化
  useEffect(() => {
    if (isOpen) {
      fetchChains();
    }
  }, [isOpen, fetchChains]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="产业链分析"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass card modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '90vw',
            maxWidth: '900px',
            height: '75vh',
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
              <span>产业链分析</span>
            </div>
            <button
              className="icon-button"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent' }}
            >
              <CloseIcon width="20" height="20" />
            </button>
          </div>

          {/* 内容区 */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
              }}>
                加载中...
              </div>
            ) : (
              <ChainGrid
                chains={chains}
                draggedChain={draggedChain}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onReorder={handleReorder}
                onChainClick={handleChainClick}
              />
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* 产业链详情弹框 */}
      <ChainDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        chain={selectedChain}
      />
    </AnimatePresence>
  );
}
