'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, UpdateIcon } from './Icons';

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(2) + '万';
  return num?.toLocaleString() || '0';
}

/**
 * 获取涨跌幅颜色
 */
function getChangeColor(change) {
  if (change > 0) return 'var(--danger)';
  if (change < 0) return 'var(--success)';
  return 'var(--text-secondary)';
}

/**
 * 股票K线图弹框组件
 */
export default function StockKlineModal({ stock, onClose }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockData, setStockData] = useState(null);
  const [crosshairData, setCrosshairData] = useState(null);
  const [displayData, setDisplayData] = useState(null); // 当前显示的数据（鼠标悬停或最新一天）
  const [chartReady, setChartReady] = useState(false);

  // 动态加载 lightweight-charts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 检查是否已加载
    if (window.LightweightCharts) {
      setChartReady(true);
      return;
    }
    
    // 动态加载脚本
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';
    script.async = true;
    script.onload = () => setChartReady(true);
    script.onerror = () => setError('图表库加载失败');
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // 获取股票数据
  useEffect(() => {
    if (!stock?.code) return;
    
    setLoading(true);
    setError('');
    setStockData(null);
    setCrosshairData(null);
    
    // 销毁旧图表
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    
    fetch(`/api/dailystock?code=${stock.code}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setStockData(data);
          // 设置默认显示最新一天数据
          if (data.data?.length > 0) {
            setDisplayData(data.data[data.data.length - 1]);
          }
        }
      })
      .catch(err => {
        setError('获取数据失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stock?.code]);

  // 创建图表
  useEffect(() => {
    if (!chartReady || !chartContainerRef.current || !stockData?.data?.length) return;
    
    // 如果已有图表，先销毁
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    
    const { createChart } = window.LightweightCharts;
    
    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
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
    
    // K线系列 - 使用 addCandlestickSeries 方法
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    
    // 成交量系列 - 使用 addHistogramSeries 方法
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
    candlestickSeries.setData(stockData.data);
    
    // 成交量数据（根据涨跌设置颜色）
    const volumeData = stockData.data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(248, 113, 113, 0.3)' : 'rgba(34, 197, 94, 0.3)',
    }));
    volumeSeries.setData(volumeData);
    
    // 十字光标移动事件
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        // 鼠标移出，恢复显示最新一天数据
        if (stockData?.data?.length > 0) {
          setDisplayData(stockData.data[stockData.data.length - 1]);
          setCrosshairData(null);
        }
        return;
      }
      
      const candleData = param.seriesData.get(candlestickSeries);
      const volumeVal = param.seriesData.get(volumeSeries);
      
      if (candleData) {
        // 从原始数据中获取完整的当条数据
        const dayData = stockData.data.find(d => d.time === param.time);
        
        const newCrosshairData = {
          time: param.time,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeVal?.value || dayData?.volume || 0,
          amount: dayData?.amount || 0,
          turnover_rate: dayData?.turnover_rate || 0,
        };
        setCrosshairData(newCrosshairData);
        setDisplayData(newCrosshairData);
      }
    });
    
    // 自适应大小
    chart.timeScale().fitContent();
    
    chartRef.current = chart;
    
    // 窗口大小变化时自适应
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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
  }, [chartReady, stockData]);

  // 计算涨跌幅
  const getChangeInfo = useCallback(() => {
    if (!displayData || !stockData?.data) return null;
    
    const idx = stockData.data.findIndex(d => d.time === displayData.time);
    if (idx <= 0) return null;
    
    const prev = stockData.data[idx - 1];
    const change = displayData.close - prev.close;
    const changePercent = (change / prev.close * 100).toFixed(2);
    
    return { change, changePercent };
  }, [displayData, stockData]);

  const changeInfo = getChangeInfo();

  return (
    <motion.div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="股票K线图"
      onClick={onClose}
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
          maxWidth: '700px', 
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'visible'
        }}
      >
        {/* 标题栏 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              📈
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>
                {stock?.name || stockData?.name || '加载中...'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                #{stock?.code}
              </div>
            </div>
          </div>
          <button 
            className="icon-button" 
            onClick={onClose} 
            style={{ border: 'none', background: 'transparent' }}
          >
            <CloseIcon width="20" height="20" />
          </button>
        </div>

        {/* 数据提示栏 */}
        {displayData && (
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            marginBottom: 12,
            fontSize: '13px',
            flexWrap: 'wrap',
          }}>
            <div>
              <span className="muted">日期: </span>
              <span style={{ fontWeight: 500 }}>{displayData.time}</span>
            </div>
            <div>
              <span className="muted">开: </span>
              <span style={{ fontWeight: 500 }}>{displayData.open.toFixed(2)}</span>
            </div>
            <div>
              <span className="muted">高: </span>
              <span style={{ fontWeight: 500, color: 'var(--danger)' }}>{displayData.high.toFixed(2)}</span>
            </div>
            <div>
              <span className="muted">低: </span>
              <span style={{ fontWeight: 500, color: 'var(--success)' }}>{displayData.low.toFixed(2)}</span>
            </div>
            <div>
              <span className="muted">收: </span>
              <span style={{ fontWeight: 600 }}>{displayData.close.toFixed(2)}</span>
            </div>
            {changeInfo && (
              <div>
                <span className="muted">涨跌: </span>
                <span style={{ 
                  fontWeight: 600, 
                  color: getChangeColor(changeInfo.change) 
                }}>
                  {changeInfo.change > 0 ? '+' : ''}{changeInfo.change.toFixed(2)} ({changeInfo.changePercent}%)
                </span>
              </div>
            )}
            <div>
              <span className="muted">量: </span>
              <span style={{ fontWeight: 500 }}>{formatNumber(displayData.volume)}</span>
            </div>
            <div>
              <span className="muted">额: </span>
              <span style={{ fontWeight: 500 }}>{formatNumber(displayData.amount)}</span>
            </div>
            {displayData.turnover_rate > 0 && (
              <div>
                <span className="muted">换手: </span>
                <span style={{ fontWeight: 500 }}>{displayData.turnover_rate.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}

        {/* 图表区域 */}
        <div 
          ref={chartContainerRef} 
          style={{ 
            width: '100%', 
            height: 400,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.2)',
          }}
        />

        {/* 加载状态 */}
        {loading && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div className="loading-spinner" style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(255,255,255,0.1)', 
              borderTop: '3px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }} />
            <p className="muted" style={{ fontSize: '14px' }}>加载K线数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: 16 }}>📊</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{error}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              请运行爬虫脚本获取数据:
            </p>
            <code style={{ 
              display: 'inline-block',
              marginTop: 12, 
              padding: '8px 16px', 
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 6,
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              node crawler/dailyStockSpider.js --codes={stock?.code}
            </code>
          </div>
        )}

        {/* 底部信息 */}
        {stockData && !loading && !error && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            fontSize: '12px',
          }}>
            <div className="muted">
              数据范围: {stockData.stats?.minDate} ~ {stockData.stats?.maxDate} ({stockData.count}个交易日)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="muted">最新收盘:</span>
              <span style={{ fontWeight: 600 }}>¥{stockData.stats?.latestClose?.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 使用提示 */}
        <div style={{ 
          marginTop: 12, 
          fontSize: '11px', 
          color: 'var(--text-secondary)',
          textAlign: 'center',
          opacity: 0.7,
        }}>
          💡 鼠标滑动查看详情 | 滚轮缩放 | 拖拽平移
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
