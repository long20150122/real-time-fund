/**
 * 产业链图展示组件
 * 职责：展示全产业链图或概念链图
 */
'use client';

import { useMemo } from 'react';

export default function ChainImageViewer({
  chain,
  images,
  selectedConcept,
}) {
  // 获取当前要显示的图片
  const currentImage = useMemo(() => {
    if (!selectedConcept) {
      // 显示全产业链图
      return images.find(img => img.image_type === 'full');
    }
    // 显示概念链图
    return images.find(img => 
      img.image_type === 'concept' && 
      img.concept_name === selectedConcept.concept_name
    );
  }, [images, selectedConcept]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        marginBottom: 12,
        fontSize: 13,
        color: 'var(--text-secondary, #888)',
      }}>
        {selectedConcept 
          ? `${selectedConcept.concept_name} - 概念链图` 
          : `${chain?.name || ''} - 全产业链图`}
      </div>
      
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-tertiary, #16213e)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {currentImage?.image_path ? (
          <img
            src={currentImage.image_path}
            alt={selectedConcept?.concept_name || chain?.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        
        {/* 无图片提示 */}
        <div style={{
          display: currentImage?.image_path ? 'none' : 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #888)',
          fontSize: 14,
          textAlign: 'center',
          padding: 20,
        }}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
            style={{ marginBottom: 12, opacity: 0.5 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div>暂无产业链图</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>
            请将图片放置到 app/assets/chain 目录
          </div>
        </div>
      </div>
    </div>
  );
}
