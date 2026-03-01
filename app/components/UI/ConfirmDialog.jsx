'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

// Confirm Dialog 上下文
const ConfirmDialogContext = createContext(null);

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
};

/**
 * Confirm Dialog Provider 组件
 */
export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  // 显示确认对话框
  const confirm = useCallback(({ 
    title = '确认操作', 
    message, 
    confirmText = '确定', 
    cancelText = '取消',
    danger = false,
  }) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmText,
        cancelText,
        danger,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      
      {/* 确认对话框 */}
      <AnimatePresence>
        {dialog && (
          <ConfirmDialogOverlay dialog={dialog} />
        )}
      </AnimatePresence>
    </ConfirmDialogContext.Provider>
  );
}

/**
 * 确认对话框遮罩层组件
 */
function ConfirmDialogOverlay({ dialog }) {
  // 锁定背景滚动
  useLockBodyScroll(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99998,
      }}
      onClick={dialog.onCancel}
    >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass card"
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: 20,
                width: 340,
                maxWidth: '90vw',
              }}
            >
              <h3 style={{ 
                marginBottom: 10, 
                fontSize: 15,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {dialog.danger && <span style={{ color: 'var(--danger)' }}>⚠</span>}
                {dialog.title}
              </h3>
              
              <p style={{ 
                color: 'var(--muted)', 
                marginBottom: 16, 
                fontSize: 13,
                lineHeight: 1.6,
              }}>
                {dialog.message}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  className="icon-button"
                  onClick={dialog.onCancel}
                  style={{ width: 'auto', padding: '0 16px', height: 34 }}
                >
                  {dialog.cancelText}
                </button>
                <button
                  className={dialog.danger ? 'icon-button danger' : 'button'}
                  onClick={dialog.onConfirm}
                  style={{ width: 'auto', padding: '0 16px', height: 34 }}
                >
                  {dialog.confirmText}
                </button>
              </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * 导出 context
 */
export { ConfirmDialogContext };
