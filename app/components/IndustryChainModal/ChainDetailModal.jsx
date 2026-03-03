/**
 * 产业链详情弹框组件
 * 职责：展示产业链的详细信息、概念列表、产业链图
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import ConceptList from './ConceptList';
import ChainImageViewer from './ChainImageViewer';
import ConceptStocks from './ConceptStocks';

export default function ChainDetailModal({ isOpen, onClose, chain }) {
  const [concepts, setConcepts] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [loading, setLoading] = useState(false);

  // 获取产业链详情
  const fetchChainDetail = useCallback(async () => {
    if (!chain?.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/industry-chains?chainId=${chain.id}`);
      const data = await res.json();
      setConcepts(data.concepts || []);
      setImages(data.images || []);
      
      // 默认选中第一个概念
      if (data.concepts?.length > 0 && !selectedConcept) {
        setSelectedConcept(data.concepts[0]);
      }
    } catch (error) {
      console.error('获取产业链详情失败:', error);
    } finally {
      setLoading(false);
    }
  }, [chain?.id, selectedConcept]);

  // 初始化
  useEffect(() => {
    if (isOpen && chain) {
      fetchChainDetail();
      setSelectedConcept(null); // 重置选中概念
    }
  }, [isOpen, chain, fetchChainDetail]);

  // 处理概念选择
  const handleConceptSelect = useCallback((concept) => {
    setSelectedConcept(concept);
  }, []);

  // 添加概念
  const handleAddConcept = useCallback(async (conceptName) => {
    try {
      const res = await fetch('/api/industry-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: chain.id,
          conceptName,
          action: 'add',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConcepts(prev => [...prev, data.concept]);
      } else if (data.exists) {
        alert('该概念已存在');
      }
    } catch (error) {
      console.error('添加概念失败:', error);
    }
  }, [chain?.id]);

  // 删除概念
  const handleRemoveConcept = useCallback(async (conceptName) => {
    try {
      const res = await fetch('/api/industry-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: chain.id,
          conceptName,
          action: 'remove',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConcepts(prev => prev.filter(c => c.concept_name !== conceptName));
        if (selectedConcept?.concept_name === conceptName) {
          setSelectedConcept(concepts[0] || null);
        }
      }
    } catch (error) {
      console.error('删除概念失败:', error);
    }
  }, [chain?.id, concepts, selectedConcept]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1a1a2e)',
          borderRadius: 12,
          width: '95%',
          maxWidth: 1200,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 50px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #333)',
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary, #fff)',
            margin: 0,
          }}>
            {chain?.name || '产业链详情'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #888)',
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #888)',
            }}>
            加载中...
          </div>
          ) : (
            <>
              {/* 左侧：概念列表 */}
              <ConceptList
                concepts={concepts}
                selectedConcept={selectedConcept}
                onSelect={handleConceptSelect}
                onAdd={handleAddConcept}
                onRemove={handleRemoveConcept}
              />

              {/* 中间：产业链图 */}
              <ChainImageViewer
                chain={chain}
                images={images}
                selectedConcept={selectedConcept}
              />

              {/* 右侧：概念股票 */}
              <ConceptStocks
                concept={selectedConcept}
                chain={chain}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
