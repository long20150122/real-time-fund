'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * RSI 指标图表组件
 * 显示 RSI6, RSI12, RSI24 三条指标线
 * 
 * @param {Object} props
 * @param {Array} props.data - 股票数据数组，包含 rsi6, rsi12, rsi24 字段
 * @param {Object} props.chartApi - lightweight-charts 库引用
 * @param {Object} props.timeScale - 外部时间轴引用（用于同步）
 * @param {Function} props.onCrosshairMove - 十字光标移动回调
 * @param {number} props.height - 图表高度
 */
export default function RSIChart({ 
  data, 
  chartApi, 
  timeScale,
  onCrosshairMove,
  height = 120 
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [ready, setReady] = useState(false);

  // 创建 RSI 图表
  useEffect(() => {
    if (!containerRef.current || !chartApi || !data?.length) return;

    // 清理旧图表
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const { createChart } = chartApi;

    // 创建图表
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8a8a8a',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(34, 211, 238, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: 'rgba(34, 211, 238, 0.8)',
        },
        horzLine: {
          color: 'rgba(34, 211, 238, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: 'rgba(34, 211, 238, 0.8)',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        visible: false, // 使用外部时间轴时隐藏
      },
    });

    // RSI 超买超卖区域（70/30 线）
    const overboughtLine = chart.addLineSeries({
      color: 'rgba(239, 68, 68, 0.3)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    
    const oversoldLine = chart.addLineSeries({
      color: 'rgba(34, 197, 94, 0.3)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const middleLine = chart.addLineSeries({
      color: 'rgba(255, 255, 255, 0.1)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // RSI6 - 黄色
    const rsi6Series = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // RSI12 - 蓝色
    const rsi12Series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // RSI24 - 紫色
    const rsi24Series = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // 设置参考线数据
    const referenceData = data.map(d => ({ time: d.time, value: 70 }));
    const oversoldData = data.map(d => ({ time: d.time, value: 30 }));
    const middleData = data.map(d => ({ time: d.time, value: 50 }));
    
    overboughtLine.setData(referenceData);
    oversoldLine.setData(oversoldData);
    middleLine.setData(middleData);

    // 设置 RSI 数据
    const rsi6Data = data.filter(d => d.rsi6 != null).map(d => ({ time: d.time, value: d.rsi6 }));
    const rsi12Data = data.filter(d => d.rsi12 != null).map(d => ({ time: d.time, value: d.rsi12 }));
    const rsi24Data = data.filter(d => d.rsi24 != null).map(d => ({ time: d.time, value: d.rsi24 }));

    rsi6Series.setData(rsi6Data);
    rsi12Series.setData(rsi12Data);
    rsi24Series.setData(rsi24Data);

    // 保存引用
    seriesRef.current = {
      rsi6: rsi6Series,
      rsi12: rsi12Series,
      rsi24: rsi24Series,
    };

    chartRef.current = chart;
    setReady(true);

    // 同步时间轴
    if (timeScale) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        // 时间轴变化时通知外部
      });
    }

    // 窗口大小变化时自适应
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, chartApi, height]);

  // 同步时间轴
  useEffect(() => {
    if (!ready || !timeScale || !chartRef.current) return;
    
    // 初始同步：获取当前可见范围并应用
    const currentRange = timeScale.getVisibleLogicalRange();
    if (currentRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(currentRange);
    }
    
    // 监听外部时间轴变化
    const unsubscribe = timeScale.subscribeVisibleLogicalRangeChange(range => {
      if (range && chartRef.current) {
        chartRef.current.timeScale().setVisibleLogicalRange(range);
      }
    });

    return unsubscribe;
  }, [ready, timeScale]);

  // 十字光标移动事件
  useEffect(() => {
    if (!ready || !onCrosshairMove || !chartRef.current) return;

    const handler = (param) => {
      if (!param.time) {
        onCrosshairMove(null);
        return;
      }
      
      onCrosshairMove({
        time: param.time,
        rsi6: param.seriesData.get(seriesRef.current.rsi6)?.value,
        rsi12: param.seriesData.get(seriesRef.current.rsi12)?.value,
        rsi24: param.seriesData.get(seriesRef.current.rsi24)?.value,
      });
    };

    chartRef.current.subscribeCrosshairMove(handler);
  }, [ready, onCrosshairMove]);

  return (
    <div style={{ position: 'relative' }}>
      {/* 标签 */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 12,
        fontSize: '11px',
        zIndex: 10,
        display: 'flex',
        gap: 12,
      }}>
        <span style={{ color: '#fbbf24' }}>RSI6</span>
        <span style={{ color: '#3b82f6' }}>RSI12</span>
        <span style={{ color: '#a855f7' }}>RSI24</span>
      </div>
      
      {/* 图表容器 */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: height,
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.15)',
        }}
      />
    </div>
  );
}
