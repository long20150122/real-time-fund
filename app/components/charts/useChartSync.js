'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 图表同步 Hook
 * 用于同步多个图表的时间轴和十字光标
 * 
 * @returns {Object} { timeScale, crosshairTime, setTimeScale, setCrosshairTime, syncCharts }
 */
export function useChartSync() {
  const timeScaleRef = useRef(null);
  const chartsRef = useRef([]);
  const [crosshairTime, setCrosshairTime] = useState(null);
  const isSyncingRef = useRef(false);

  // 设置主时间轴
  const setTimeScale = useCallback((timeScale) => {
    timeScaleRef.current = timeScale;
  }, []);

  // 注册图表
  const registerChart = useCallback((chart) => {
    if (!chartsRef.current.includes(chart)) {
      chartsRef.current.push(chart);
    }
  }, []);

  // 注销图表
  const unregisterChart = useCallback((chart) => {
    chartsRef.current = chartsRef.current.filter(c => c !== chart);
  }, []);

  // 同步所有图表的时间轴
  const syncTimeScale = useCallback((sourceChart, range) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    chartsRef.current.forEach(chart => {
      if (chart !== sourceChart) {
        try {
          chart.timeScale().setVisibleLogicalRange(range);
        } catch (e) {
          // 忽略错误
        }
      }
    });

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 10);
  }, []);

  // 同步十字光标位置
  const syncCrosshair = useCallback((sourceChart, param) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    chartsRef.current.forEach(chart => {
      if (chart !== sourceChart) {
        try {
          if (param.time) {
            chart.setCrosshairPosition(param.point?.x || 0, param.point?.y || 0, param.seriesData);
          } else {
            chart.clearCrosshairPosition();
          }
        } catch (e) {
          // 忽略错误
        }
      }
    });

    setCrosshairTime(param.time || null);

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 10);
  }, []);

  // 初始化图表同步
  const initChartSync = useCallback((chart) => {
    registerChart(chart);

    // 监听时间轴变化
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        syncTimeScale(chart, range);
      }
    });

    // 监听十字光标移动
    chart.subscribeCrosshairMove((param) => {
      syncCrosshair(chart, param);
    });

    return () => {
      unregisterChart(chart);
    };
  }, [registerChart, unregisterChart, syncTimeScale, syncCrosshair]);

  return {
    timeScale: timeScaleRef.current,
    crosshairTime,
    setTimeScale,
    registerChart,
    unregisterChart,
    syncTimeScale,
    syncCrosshair,
    initChartSync,
  };
}

/**
 * 图表加载 Hook
 * 动态加载 lightweight-charts 库
 * 
 * @returns {Object} { chartApi, loading, error }
 */
export function useChartLibrary() {
  const [chartApi, setChartApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检查是否已加载
    if (window.LightweightCharts) {
      setChartApi(window.LightweightCharts);
      setLoading(false);
      return;
    }

    // 动态加载脚本
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';
    script.async = true;
    script.onload = () => {
      setChartApi(window.LightweightCharts);
      setLoading(false);
    };
    script.onerror = () => {
      setError('图表库加载失败');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return { chartApi, loading, error };
}
