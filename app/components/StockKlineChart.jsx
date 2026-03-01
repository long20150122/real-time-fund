'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CloseIcon } from './Icons';
import { CandlestickChart, RSIChart, useChartLibrary, useChartSync } from './charts';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

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
 * 数据提示栏组件
 */
function DataTipBar({ displayData, changeInfo }) {
  if (!displayData) return null;

  return (
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
      <DataItem label="日期" value={displayData.time} />
      <DataItem label="开" value={displayData.open.toFixed(2)} />
      <DataItem label="高" value={displayData.high.toFixed(2)} color="var(--danger)" />
      <DataItem label="低" value={displayData.low.toFixed(2)} color="var(--success)" />
      <DataItem label="收" value={displayData.close.toFixed(2)} bold />
      {changeInfo && (
        <DataItem 
          label="涨跌" 
          value={`${changeInfo.change > 0 ? '+' : ''}${changeInfo.change.toFixed(2)} (${changeInfo.changePercent}%)`}
          color={getChangeColor(changeInfo.change)}
          bold
        />
      )}
      <DataItem label="量" value={formatNumber(displayData.volume)} />
      <DataItem label="额" value={formatNumber(displayData.amount)} />
      {displayData.turnover_rate > 0 && (
        <DataItem label="换手" value={`${displayData.turnover_rate.toFixed(2)}%`} />
      )}
      {displayData.rsi6 && (
        <DataItem 
          label="RSI6" 
          value={displayData.rsi6.toFixed(1)}
          color={displayData.rsi6 > 70 ? 'var(--danger)' : displayData.rsi6 < 30 ? 'var(--success)' : 'inherit'}
        />
      )}
      {displayData.rsi12 && (
        <DataItem 
          label="RSI12" 
          value={displayData.rsi12.toFixed(1)}
          color={displayData.rsi12 > 70 ? 'var(--danger)' : displayData.rsi12 < 30 ? 'var(--success)' : 'inherit'}
        />
      )}
      {displayData.rsi24 && (
        <DataItem 
          label="RSI24" 
          value={displayData.rsi24.toFixed(1)}
          color={displayData.rsi24 > 70 ? 'var(--danger)' : displayData.rsi24 < 30 ? 'var(--success)' : 'inherit'}
        />
      )}
    </div>
  );
}

/**
 * 数据项组件
 */
function DataItem({ label, value, color, bold }) {
  return (
    <div>
      <span className="muted">{label}: </span>
      <span style={{ fontWeight: bold ? 600 : 500, color }}>{value}</span>
    </div>
  );
}

/**
 * 加载状态组件
 */
function LoadingState() {
  return (
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
  );
}

/**
 * 错误状态组件
 */
function ErrorState({ error, stockCode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
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
        node crawler/dailyStockSpider.js --codes={stockCode}
      </code>
    </div>
  );
}

/**
 * 底部信息组件
 */
function FooterInfo({ stockData }) {
  if (!stockData) return null;

  return (
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
  );
}

/**
 * 股票K线图弹框组件
 */
export default function StockKlineModal({ stock, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockData, setStockData] = useState(null);
  const [displayData, setDisplayData] = useState(null);
  const [mainTimeScale, setMainTimeScale] = useState(null);
  
  // 锁定背景滚动
  useLockBodyScroll(true);
  
  // 使用图表相关 hooks
  const { chartApi, loading: chartLoading, error: chartError } = useChartLibrary();
  const { setTimeScale, syncTimeScale } = useChartSync();
  
  const klineChartRef = useRef(null);
  const rsiChartRef = useRef(null);

  // 获取股票数据
  useEffect(() => {
    if (!stock?.code) return;

    setLoading(true);
    setError('');
    setStockData(null);
    setDisplayData(null);

    fetch(`/api/dailystock?code=${stock.code}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setStockData(data);
          if (data.data?.length > 0) {
            setDisplayData(data.data[data.data.length - 1]);
          }
        }
      })
      .catch(() => {
        setError('获取数据失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stock?.code]);

  // K线图十字光标移动处理
  const handleKlineCrosshair = useCallback((data) => {
    if (data) {
      setDisplayData(data);
    } else {
      // 鼠标移出，恢复显示最新一天数据
      if (stockData?.data?.length > 0) {
        setDisplayData(stockData.data[stockData.data.length - 1]);
      }
    }
  }, [stockData]);

  // 时间轴准备就绪
  const handleTimeScaleReady = useCallback((timeScale) => {
    setMainTimeScale(timeScale);
    setTimeScale(timeScale);
  }, [setTimeScale]);

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
      style={{ zIndex: 10005 }}
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
        <Header stock={stock} stockData={stockData} onClose={onClose} />

        {/* 数据提示栏 */}
        <DataTipBar displayData={displayData} changeInfo={changeInfo} />

        {/* 图表区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* K线图 */}
          {!loading && !error && stockData?.data && chartApi && (
            <div ref={klineChartRef}>
              <CandlestickChart
                data={stockData.data}
                chartApi={chartApi}
                onCrosshairMove={handleKlineCrosshair}
                onTimeScaleReady={handleTimeScaleReady}
                height={350}
              />
            </div>
          )}

          {/* RSI 指标图 */}
          {!loading && !error && stockData?.data && chartApi && (
            <div ref={rsiChartRef}>
              <RSIChart
                data={stockData.data}
                chartApi={chartApi}
                timeScale={mainTimeScale}
                height={100}
              />
            </div>
          )}
        </div>

        {/* 加载状态 */}
        {(loading || chartLoading) && <LoadingState />}

        {/* 错误状态 */}
        {(error || chartError) && <ErrorState error={error || chartError} stockCode={stock?.code} />}

        {/* 底部信息 */}
        {stockData && !loading && !error && <FooterInfo stockData={stockData} />}

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

/**
 * 标题栏组件
 */
function Header({ stock, stockData, onClose }) {
  return (
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
  );
}
