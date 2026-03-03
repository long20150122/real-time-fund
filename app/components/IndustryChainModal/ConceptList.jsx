/**
 * 概念列表组件
 * 职责：展示产业链下的概念列表，支持选择、添加、删除
 */
'use client';

import { useState, useCallback } from 'react';

export default function ConceptList({
  concepts,
  selectedConcept,
  onSelect,
  onAdd,
  onRemove,
}) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newConceptName, setNewConceptName] = useState('');

  // 添加概念
  const handleAdd = useCallback(() => {
    if (newConceptName.trim()) {
      onAdd?.(newConceptName.trim());
      setNewConceptName('');
      setShowAddInput(false);
    }
  }, [newConceptName, onAdd]);

  // 键盘事件
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      setShowAddInput(false);
      setNewConceptName('');
    }
  }, [handleAdd]);

  return (
    <div style={{
      width: 200,
      borderRight: '1px solid var(--border-color, #333)',
      overflowY: 'auto',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary, #888)',
        }}>
          概念列表
        </span>
        <button
          onClick={() => setShowAddInput(true)}
          style={{
            background: 'var(--primary, #4f46e5)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: 16,
            cursor: 'pointer',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="添加概念"
        >
          +
        </button>
      </div>

      {/* 添加输入框 */}
      {showAddInput && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={newConceptName}
            onChange={(e) => setNewConceptName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入概念名称"
            autoFocus
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border-color, #333)',
              borderRadius: 4,
              background: 'var(--bg-tertiary, #16213e)',
              color: 'var(--text-primary, #fff)',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'flex',
            gap: 4,
            marginTop: 4,
          }}>
            <button
              onClick={handleAdd}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: 'var(--primary, #4f46e5)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              确认
            </button>
            <button
              onClick={() => {
                setShowAddInput(false);
                setNewConceptName('');
              }}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: 'var(--bg-secondary, #1a1a2e)',
                border: '1px solid var(--border-color, #333)',
                borderRadius: 4,
                color: 'var(--text-secondary, #888)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 概念列表 */}
      <div style={{ flex: 1 }}>
        {concepts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 20,
            color: 'var(--text-secondary, #888)',
            fontSize: 12,
          }}>
            暂无概念数据
          </div>
        ) : (
          concepts.map((concept) => (
            <div
              key={concept.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: 4,
                background: selectedConcept?.id === concept.id
                  ? 'var(--primary, #4f46e5)'
                  : 'transparent',
                color: selectedConcept?.id === concept.id
                  ? '#fff'
                  : 'var(--text-secondary, #aaa)',
                transition: 'all 0.2s',
              }}
              onClick={() => onSelect?.(concept)}
              onMouseEnter={(e) => {
                if (selectedConcept?.id !== concept.id) {
                  e.currentTarget.style.background = 'var(--bg-hover, #252545)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedConcept?.id !== concept.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ flex: 1, fontSize: 13 }}>
                {concept.concept_name}
              </span>
              {/* 手动添加的概念可删除 */}
              {concept.is_manual === '1' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(concept.concept_name);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    opacity: 0.6,
                    cursor: 'pointer',
                    padding: 2,
                    fontSize: 14,
                  }}
                  title="删除概念"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
