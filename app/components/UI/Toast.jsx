'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Toast 上下文
const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context.toast;
};

/**
 * Toast 类型配置
 */
const toastTypes = {
  info: {
    icon: 'ℹ️',
    background: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  success: {
    icon: '✓',
    background: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'var(--success)',
    color: 'var(--success)',
  },
  warning: {
    icon: '⚠',
    background: 'rgba(251, 191, 36, 0.15)',
    borderColor: '#fbbf24',
    color: '#fbbf24',
  },
  error: {
    icon: '✕',
    background: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'var(--danger)',
    color: 'var(--danger)',
  },
};

/**
 * 单个 Toast 组件
 */
function ToastItem({ toast, onRemove }) {
  const config = toastTypes[toast.type] || toastTypes.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: config.background,
        border: `1px solid ${config.borderColor}`,
        borderRadius: 8,
        minWidth: 280,
        maxWidth: 400,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{config.icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          padding: '2px',
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

/**
 * Toast Provider 组件
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // 添加 toast
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type };

    setToasts(prev => [...prev, newToast]);

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  // 移除 toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 便捷方法
  const toast = {
    info: (message, duration) => addToast(message, 'info', duration),
    success: (message, duration) => addToast(message, 'success', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    error: (message, duration) => addToast(message, 'error', duration),
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toast }}>
      {children}
      
      {/* Toast 容器 */}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <AnimatePresence>
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * 导出一个简单的 toast hook wrapper
 * 用于不需要 Provider 的场景（如果已经有 Provider）
 */
export { ToastContext };
