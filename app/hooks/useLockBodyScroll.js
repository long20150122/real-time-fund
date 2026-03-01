'use client';

import { useEffect, useRef } from 'react';

// 全局计数器，用于处理多个弹框叠加的情况
let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

/**
 * 锁定/解锁 body 滚动的 Hook
 * 当弹框打开时禁止背景滚动，关闭时恢复
 * 
 * @param {boolean} isLocked - 是否锁定滚动
 * 
 * @example
 * useLockBodyScroll(isOpen); // 弹框打开时锁定，关闭时解锁
 */
export function useLockBodyScroll(isLocked) {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (isLocked === isLockedRef.current) return;
    
    if (isLocked && lockCount === 0) {
      // 首次锁定时保存原始样式
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;
      
      // 计算滚动条宽度
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // 锁定滚动并补偿滚动条宽度
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    if (isLocked) {
      lockCount++;
    } else if (lockCount > 0) {
      lockCount--;
    }

    if (lockCount === 0) {
      // 最后一个弹框关闭时恢复原始样式
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    }

    isLockedRef.current = isLocked;

    // 清理函数：组件卸载时确保解锁
    return () => {
      if (isLockedRef.current && lockCount > 0) {
        lockCount--;
        if (lockCount === 0) {
          document.body.style.overflow = originalOverflow;
          document.body.style.paddingRight = originalPaddingRight;
        }
        isLockedRef.current = false;
      }
    };
  }, [isLocked]);
}

export default useLockBodyScroll;
