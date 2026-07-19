'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Building2,
  Activity,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Zap,
  TrendingDown,
  CandlestickChart,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  formatNumber,
  formatPrice,
  formatPercent,
  getChangeColor,
  type OHLCV,
} from '@/lib/stock-utils';
import { KPICard } from '@/components/shared/kpi-card';
import { SectionHeader, EmptyState, LoadingSpinner } from '@/components/shared/animated-counter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ───────────────────────────────────────────────────────────
interface MarketOverviewResponse {
  success: boolean;
  hasRealData: boolean;
  overview: {
    fearGreedIndex: number;
    marketTrend: string;
    topGainers: Array<{ symbol: string; change: number; price?: number; name?: string }>;
    topLosers: Array<{ symbol: string; change: number; price?: number; name?: string }>;
    mostActive: Array<{ symbol: string; volume: number; price?: number; name?: string }>;
    marketStatus: string;
    totalMarketCap?: number;
    totalVolume?: number;
    advancingStocks?: number;
    decliningStocks?: number;
  };
  quotes: Record<string, {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    name: string;
    source: string;
    fetchedAt: string;
  }>;
  symbolsWithRealData: string[];
}

interface StockDataResponse {
  stock?: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap: number;
  };
  ohlcv?: OHLCV[];
  hasOHLCV?: boolean;
  error?: string;
}

// ─── Animation Variants ──────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Chart Tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-semibold">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

// ─── Fear & Greed Semicircle Gauge ───────────────────────────────────
function FearGreedGauge({ value }: { value: number }) {
  if (value <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-slate-500 text-sm">No Data</p>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));

  const getZone = () => {
    if (clamped <= 25) return { label: 'Extreme Fear', color: '#ef4444' };
    if (clamped <= 45) return { label: 'Fear', color: '#f97316' };
    if (clamped <= 55) return { label: 'Neutral', color: '#eab308' };
    if (clamped <= 75) return { label: 'Greed', color: '#22c55e' };
    return { label: 'Extreme Greed', color: '#10b981' };
  };

  const zone = getZone();
  const width = 260;
  const height = 145;
  const cx = width / 2;
  const cy = height - 10;
  const radius = 100;
  const strokeWidth = 18;
  const valueAngle = Math.PI - (clamped / 100) * Math.PI;
  const needleLen = radius - strokeWidth - 5;
  const needleTipX = cx - needleLen * Math.cos(valueAngle);
  const needleTipY = cy - needleLen * Math.sin(valueAngle);
  const startX = cx - radius;
  const endX = cx + radius;

  const segments = [
    { from: 0, to: 25, color: '#ef4444' },
    { from: 25, to: 45, color: '#f97316' },
    { from: 45, to: 55, color: '#eab308' },
    { from: 55, to: 75, color: '#22c55e' },
    { from: 75, to: 100, color: '#10b981' },
  ];

  const getArcPath = (fromPct: number, toPct: number) => {
    const startAngle = Math.PI - (fromPct / 100) * Math.PI;
    const endAngle = Math.PI - (toPct / 100) * Math.PI;
    const sx = cx + radius * Math.cos(startAngle);
    const sy = cy - radius * Math.sin(startAngle);
    const ex = cx + radius * Math.cos(endAngle);
    const ey = cy - radius * Math.sin(endAngle);
    const largeArc = (fromPct - toPct) > 50 ? 1 : 0;
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${ey}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {segments.map((seg) => (
          <path
            key={`${seg.from}-${seg.to}`}
            d={getArcPath(seg.from, seg.to)}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            opacity={0.2}
          />
        ))}
        <motion.path
          d={getArcPath(0, clamped)}
          fill="none"
          stroke={zone.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' as const }}
          style={{ filter: `drop-shadow(0 0 8px ${zone.color}60)` }}
        />
        <motion.line
          x1={cx} y1={cy} x2={needleTipX} y2={needleTipY}
          stroke={zone.color} strokeWidth={2.5} strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x2: needleTipX, y2: needleTipY }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{ filter: `drop-shadow(0 0 4px ${zone.color}80)` }}
        />
        <circle cx={cx} cy={cy} r={5} fill={zone.color} />
        <text x={startX - 5} y={cy + 14} textAnchor="middle" className="fill-slate-500" fontSize="9">0</text>
        <text x={endX + 5} y={cy + 14} textAnchor="middle" className="fill-slate-500" fontSize="9">100</text>
      </svg>
      <div className="text-center -mt-1">
        <div className="text-3xl font-bold" style={{ color: zone.color }}>
          {Math.round(clamped)}
        </div>
        <div className="text-xs font-medium mt-0.5" style={{ color: zone.color }}>
          {zone.label}
        </div>
        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Fear &amp; Greed Index</div>
      </div>
    </div>
  );
}

// ─── Ticker item component ───────────────────────────────────────────
function TickerItem({ symbol, price, changePercent }: { symbol: string; price: number; changePercent: number }) {
  const isPositive = changePercent >= 0;
  return (
    <div className="flex items-center gap-2.5 px-5 py-2 whitespace-nowrap">
      <span className="text-xs font-bold text-white tracking-wider">{symbol}</span>
      <span className="text-xs text-slate-300">${formatPrice(price)}</span>
      <span
        className={cn(
          'text-xs font-semibold flex items-center gap-0.5',
          isPositive ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {formatPercent(changePercent)}
      </span>
    </div>
  );
}

// ─── KPI Skeleton Loader ─────────────────────────────────────────────
function KPISkeleton() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-xl bg-white/5" />
        <Skeleton className="h-6 w-16 rounded-lg bg-white/5" />
      </div>
      <Skeleton className="h-3 w-20 mb-2 bg-white/5" />
      <Skeleton className="h-7 w-28 bg-white/5" />
    </div>
  );
}

// ─── Main Dashboard Page ────────────────────────────────────────────
export function DashboardPage() {
  const { realQuotes, selectedStock, watchlist, isLive } = useAppStore();
  const [overviewData, setOverviewData] = useState<MarketOverviewResponse | null>(null);
  const [stockData, setStockData] = useState<StockDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMarketOverview = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/market-overview');
      const data: MarketOverviewResponse = await res.json();
      setOverviewData(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStockData = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${selectedStock.symbol}&days=30`);
      const data: StockDataResponse = await res.json();
      setStockData(data);
    } catch {
      setStockData(null);
    } finally {
      setStockLoading(false);
    }
  }, [selectedStock.symbol]);

  useEffect(() => {
    fetchMarketOverview();
  }, [fetchMarketOverview]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Ticker data from realQuotes
  const tickerItems = Object.entries(realQuotes).map(([symbol, q]) => ({
    symbol,
    price: q.price,
    changePercent: q.changePercent,
  }));

  // Chart data from stock OHLCV
  const chartData = stockData?.ohlcv?.map((d) => ({
    date: d.date.slice(5),
    price: d.close,
  })) || [];

  // Aggregated values from overview
  const totalVolume = overviewData?.quotes
    ? Object.values(overviewData.quotes).reduce((sum, q) => sum + (q.volume || 0), 0)
    : 0;

  const avgChange = overviewData?.quotes
    ? (() => {
        const vals = Object.values(overviewData.quotes).map((q) => q.changePercent);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      })()
    : 0;

  const topGainer = overviewData?.overview?.topGainers?.[0];
  const topLoser = overviewData?.overview?.topLosers?.[0];

  const hasRealQuotes = tickerItems.length > 0;
  const hasOverview = !!overviewData?.hasRealData;
  const fearGreedValue = overviewData?.overview?.fearGreedIndex || 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Market Ticker Bar ─────────────────────────────────── */}
      {hasRealQuotes ? (
        <motion.div variants={itemVariants} className="glass-card overflow-hidden">
          <div className="flex items-center">
            <div className="flex-shrink-0 px-4 py-2 border-r border-white/5 flex items-center gap-2">
              {isLive && (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  <Zap className="w-3 h-3" />
                  Live
                </span>
              )}
              <CandlestickChart className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="overflow-hidden flex-1">
              <div className="ticker-scroll flex">
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <TickerItem key={`${item.symbol}-${i}`} {...item} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="glass-card overflow-hidden">
          <div className="flex items-center justify-center px-4 py-3">
            <p className="text-sm text-slate-500">Waiting for live market data...</p>
          </div>
        </motion.div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <EmptyState
              icon={<Activity className="w-10 h-10" />}
              title="No Live Data Available"
              description="Could not fetch market overview. Please try again."
              action={
                <Button variant="outline" size="sm" onClick={fetchMarketOverview} className="gradient-button border-0">
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Refresh
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Total Volume"
              value={totalVolume > 0 ? formatNumber(totalVolume) : 'No Data'}
              icon={BarChart3}
              iconColor="text-cyan-400"
              glowColor="glow-cyan"
              index={0}
            />
            <KPICard
              title="Avg Change"
              value={overviewData && totalVolume > 0 ? formatPercent(avgChange) : 'No Data'}
              change={overviewData && totalVolume > 0 ? formatPercent(avgChange) : undefined}
              changeType={avgChange >= 0 ? 'positive' : 'negative'}
              icon={TrendingUp}
              iconColor="text-emerald-400"
              glowColor="glow-green"
              index={1}
            />
            <KPICard
              title="Top Gainer"
              value={topGainer ? `${topGainer.symbol}` : 'No Data'}
              change={topGainer ? `+${topGainer.change.toFixed(2)}%` : undefined}
              changeType="positive"
              icon={ArrowUpRight}
              iconColor="text-emerald-400"
              glowColor="glow-green"
              index={2}
            />
            <KPICard
              title="Top Loser"
              value={topLoser ? `${topLoser.symbol}` : 'No Data'}
              change={topLoser ? `${topLoser.change.toFixed(2)}%` : undefined}
              changeType="negative"
              icon={ArrowDownRight}
              iconColor="text-red-400"
              glowColor="glow-red"
              index={3}
            />
            <KPICard
              title="Stocks Tracked"
              value={String(tickerItems.length || '0')}
              icon={Target}
              iconColor="text-violet-400"
              glowColor="glow-purple"
              index={4}
            />
            <KPICard
              title="Market Trend"
              value={overviewData?.overview?.marketTrend || 'No Data'}
              icon={TrendingUp}
              iconColor={avgChange >= 0 ? 'text-emerald-400' : 'text-red-400'}
              glowColor={avgChange >= 0 ? 'glow-green' : 'glow-red'}
              index={5}
            />
            <KPICard
              title="Market Status"
              value={overviewData?.overview?.marketStatus || 'No Data'}
              icon={Activity}
              iconColor="text-cyan-400"
              glowColor="glow-cyan"
              index={6}
            />
            <KPICard
              title="Live Sources"
              value={String(overviewData?.symbolsWithRealData?.length || 0)}
              icon={Zap}
              iconColor="text-amber-400"
              glowColor="glow-blue"
              index={7}
            />
          </div>
        )}
      </motion.div>

      {/* ── Main Content Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-card p-5">
          <SectionHeader
            title={`${selectedStock.symbol} — 30 Day Price`}
            subtitle={hasOverview ? 'Real OHLCV data' : 'No Live Data Available'}
            badge={hasOverview ? { label: 'LIVE', color: 'bg-emerald-500/15 text-emerald-400' } : undefined}
          />
          {stockLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner label="Loading chart data..." />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <EmptyState
                icon={<CandlestickChart className="w-8 h-8" />}
                title="No Live Data Available"
                description={`No OHLCV data returned for ${selectedStock.symbol}. The data source may be temporarily unavailable.`}
                action={
                  <Button variant="outline" size="sm" onClick={fetchStockData} className="gradient-button border-0">
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Retry
                  </Button>
                }
              />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#priceGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Fear & Greed Gauge */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <SectionHeader title="Market Sentiment" subtitle="Fear & Greed Index" />
          <div className="flex items-center justify-center h-64">
            {loading ? (
              <Skeleton className="w-[260px] h-[145px] rounded-xl bg-white/5" />
            ) : (
              <FearGreedGauge value={fearGreedValue} />
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Section: Gainers / Losers / Watchlist ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top Gainers */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <SectionHeader title="Top Gainers" subtitle="Best performers" />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 bg-white/5" />
                  <Skeleton className="h-4 w-20 bg-white/5" />
                </div>
              ))}
            </div>
          ) : !overviewData?.overview?.topGainers?.length ? (
            <div className="flex flex-col items-center py-8">
              <EmptyState
                icon={<TrendingUp className="w-8 h-8" />}
                title="No Data"
                description="No gainer data available"
              />
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {overviewData.overview.topGainers.slice(0, 8).map((item, i) => (
                  <motion.div
                    key={item.symbol}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-white">{item.symbol}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{item.change.toFixed(2)}%
                    </span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.div>

        {/* Top Losers */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <SectionHeader title="Top Losers" subtitle="Worst performers" />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 bg-white/5" />
                  <Skeleton className="h-4 w-20 bg-white/5" />
                </div>
              ))}
            </div>
          ) : !overviewData?.overview?.topLosers?.length ? (
            <div className="flex flex-col items-center py-8">
              <EmptyState
                icon={<TrendingDown className="w-8 h-8" />}
                title="No Data"
                description="No loser data available"
              />
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {overviewData.overview.topLosers.slice(0, 8).map((item, i) => (
                  <motion.div
                    key={item.symbol}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-white">{item.symbol}</span>
                    </div>
                    <span className="text-sm font-semibold text-red-400 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {item.change.toFixed(2)}%
                    </span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.div>

        {/* Watchlist */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <SectionHeader
            title="Watchlist"
            subtitle={`${watchlist.length} stocks`}
            action={
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">
                <Eye className="w-3 h-3 mr-1" />
                Watching
              </Badge>
            }
          />
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <EmptyState
                icon={<Eye className="w-8 h-8" />}
                title="No Watchlist"
                description="Add stocks to your watchlist"
              />
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {watchlist.map((symbol, i) => {
                  const quote = realQuotes[symbol];
                  return (
                    <motion.div
                      key={symbol}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{symbol}</span>
                      </div>
                      {quote ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-300">${formatPrice(quote.price)}</span>
                          <span className={cn('text-xs font-semibold', getChangeColor(quote.changePercent))}>
                            {formatPercent(quote.changePercent)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No Data</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}