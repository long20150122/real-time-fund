'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * K线图组件（含成交量）
 * 
 * @param {Object} props
 * @param {Array} props.data - K线数据数组
 * @param {Object} props.chartApi - lightweight-charts 库引用
 * @param {Function} props.onCrosshairMove - 十字光标移动回调
 * @param {Function} props.onTimeScaleReady - 时间轴准备就绪回调
 * @param {number} props.height - 图表高度
 */
export default function CandlestickChart({ 
  data, 
  chartApi,
  onCrosshairMove,
  onTimeScaleReady,
  height = 400 
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [ready, setReady] = useState(false);

  // 创建 K 线图
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
        mode: 1, // Magnet mode
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
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: false,
      },
    });

    // K线系列
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });

    // 成交量系列
    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(34, 211, 238, 0.3)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    // 设置成交量价格比例
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 设置数据
    candlestickSeries.setData(data);

    // 成交量数据（根据涨跌设置颜色）
    const volumeData = data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(248, 113, 113, 0.3)' : 'rgba(34, 197, 94, 0.3)',
    }));
    volumeSeries.setData(volumeData);

    // 保存引用
    seriesRef.current = {
      candlestick: candlestickSeries,
      volume: volumeSeries,
    };

    chartRef.current = chart;
    setReady(true);

    // 自适应大小
    chart.timeScale().fitContent();

    // 通知时间轴准备就绪
    if (onTimeScaleReady) {
      onTimeScaleReady(chart.timeScale());
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
  }, [data, chartApi, height, onTimeScaleReady]);

  // 十字光标移动事件
  useEffect(() => {
    if (!ready || !onCrosshairMove || !chartRef.current) return;

    const handler = (param) => {
      if (!param.time) {
        onCrosshairMove(null);
        return;
      }

      const candleData = param.seriesData.get(seriesRef.current.candlestick);
      const volumeVal = param.seriesData.get(seriesRef.current.volume);

      if (candleData) {
        // 从原始数据中获取完整的当条数据
        const dayData = data.find(d => d.time === param.time);

        onCrosshairMove({
          time: param.time,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeVal?.value || dayData?.volume || 0,
          amount: dayData?.amount || 0,
          turnover_rate: dayData?.turnover_rate || 0,
          rsi6: dayData?.rsi6 || null,
          rsi12: dayData?.rsi12 || null,
          rsi24: dayData?.rsi24 || null,
        });
      }
    };

    chartRef.current.subscribeCrosshairMove(handler);
  }, [ready, onCrosshairMove, data]);

  // 暴露同步时间轴的方法
  const syncTimeScale = useCallback((range) => {
    if (chartRef.current && range) {
      chartRef.current.timeScale().setVisibleLogicalRange(range);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: height,
        borderRadius: 10,
        background: 'rgba(0, 0, 0, 0.2)',
      }}
    />
  );
}

// 导出类型定义供其他组件使用
export const CandlestickChartProps = {
  data: Array,
  chartApi: Object,
  onCrosshairMove: Function,
  onTimeScaleReady: Function,
  height: Number,
};
