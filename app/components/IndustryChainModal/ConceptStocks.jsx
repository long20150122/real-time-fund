/**
 * 概念股票列表组件
 * 职责：展示概念成分股，标注基金重仓，支持查看历史走势
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ConceptStocks({ concept, chain }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState('');

  // 获取概念成分股
  const fetchStocks = useCallback(async () => {
    if (!concept?.concept_name) {
      setStocks([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/concept-stocks?concept=${encodeURIComponent(concept.concept_name)}&top=10`);
      const data = await res.json();
      setStocks(data.stocks || []);
      setReportDate(data.reportDate || '');
    } catch (error) {
      console.error('获取成分股失败:', error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [concept?.concept_name]);

  // 监听概念变化
  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // 查看股票历史走势
  const handleViewHistory = useCallback((stock) => {
    // 触发股票详情查看（可以集成到现有的股票详情功能）
    console.log('查看股票历史:', stock);
    // TODO: 集成现有的股票K线图功能
  }, []);

  if (!concept) {
    return (
      <div style={{
        width: 350,
        borderLeft: '1px solid var(--border-color, #333)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary, #888)',
        fontSize: 13,
      }}>
        请选择一个概念查看成分股
      </div>
    );
  }

  return (
    <div style={{
      width: 350,
      borderLeft: '1px solid var(--border-color, #333)',
      overflowY: 'auto',
      padding: 16,
    }}>
      {/* 头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary, #fff)',
        }}>
          {concept.concept_name}
        </span>
        <span style={{
          background: 'var(--primary, #4f46e5)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: 11,
        }}>
          Top {stocks.length}
        </span>
      </div>

      {/* 报告期提示 */}
      {reportDate && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted, #666)',
          marginBottom: 12,
        }}>
          基金持仓数据: {reportDate}
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: 'var(--text-secondary, #888)',
        }}>
          加载中...
        </div>
      ) : stocks.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: 'var(--text-secondary, #888)',
          fontSize: 13,
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>暂无成分股数据</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            请运行爬虫获取数据:
          </div>
          <code style={{
            display: 'block',
            marginTop: 8,
            padding: '8px 12px',
            background: 'var(--bg-tertiary, #16213e)',
            borderRadius: 4,
            fontSize: 10,
          }}>
            node crawler/conceptStockSpider.js
          </code>
        </div>
      ) : (
        /* 股票列表 */
        <div>
          {stocks.map((stock, index) => (
            <div
              key={stock.stock_code}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--bg-tertiary, #16213e)',
                borderRadius: 6,
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => handleViewHistory(stock)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover, #1a2744)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary, #16213e)';
              }}
            >
              {/* 排名 */}
              <div style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: index < 3 ? 'var(--primary, #4f46e5)' : 'var(--bg-secondary, #1a1a2e)',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                marginRight: 12,
              }}>
                {index + 1}
              </div>

              {/* 股票信息 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 2,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary, #fff)',
                  }}>
                    {stock.stock_name}
                  </span>
                  {/* 基金重仓标签 */}
                  {stock.isHeavyHeld && (
                    <span style={{
                      marginLeft: 8,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 500,
                      background: '#dc2626',
                      color: '#fff',
                    }}>
                      基金重仓
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-secondary, #888)',
                }}>
                  {stock.stock_code}
                  {stock.fundHoldCount > 0 && (
                    <span style={{ marginLeft: 8 }}>
                      {stock.fundHoldCount}只基金持有
                    </span>
                  )}
                </div>
              </div>

              {/* 右侧信息 */}
              {stock.price && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary, #fff)',
                  }}>
                    {stock.price}
                  </div>
                  {stock.change_pct && (
                    <div style={{
                      fontSize: 11,
                      color: stock.change_pct > 0 ? '#ef4444' : '#22c55e',
                    }}>
                      {stock.change_pct > 0 ? '+' : ''}{stock.change_pct}%
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 图例 */}
      {stocks.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: '12px',
          background: 'var(--bg-tertiary, #16213e)',
          borderRadius: 6,
          fontSize: 11,
          color: 'var(--text-secondary, #888)',
        }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>图例说明</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              background: '#dc2626',
              color: '#fff',
            }}>
              基金重仓
            </span>
            <span>表示该股票被您关注的基金持有</span>
          </div>
        </div>
      )}
    </div>
  );
}
