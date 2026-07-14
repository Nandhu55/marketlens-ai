'use client';

import { useMemo, useState, useEffect } from 'react';
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
  BrainCircuit,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Eye,
  Zap,
  AlertTriangle,
  TrendingDown,
  CandlestickChart,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
  formatNumber,
  formatPrice,
  formatPercent,
  getChangeColor,
  type OHLCV,
} from '@/lib/stock-utils';
import { KPICard } from '@/components/shared/kpi-card';
import { GaugeChart, CircularProgress } from '@/components/shared/gauge-chart';
import { SectionHeader } from '@/components/shared/animated-counter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ─── Stagger animation container ───────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ─── Custom tooltip for charts ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-semibold">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

// ─── Fear & Greed Semicircle Gauge ─────────────────────────────────────────
function FearGreedGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  const getZone = () => {
    if (clamped <= 25) return { label: 'Extreme Fear', color: '#ef4444' };
    if (clamped <= 45) return { label: 'Fear', color: '#f97316' };
    if (clamped <= 55) return { label: 'Neutral', color: '#eab308' };
    if (clamped <= 75) return { label: 'Greed', color: '#22c55e' };
    return { label: 'Extreme Greed', color: '#10b981' };
  };

  const zone = getZone();

  // Semicircle arc parameters
  const width = 260;
  const height = 145;
  const cx = width / 2;
  const cy = height - 10;
  const radius = 100;
  const strokeWidth = 18;

  // Convert value (0-100) to angle (PI to 0, left to right)
  const valueAngle = Math.PI - (clamped / 100) * Math.PI;
  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;
  const endY = cy;

  // Needle tip position
  const needleLen = radius - strokeWidth - 5;
  const needleTipX = cx - needleLen * Math.cos(valueAngle);
  const needleTipY = cy - needleLen * Math.sin(valueAngle);

  // Zone segments for background arc
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
        {/* Background segments */}
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

        {/* Active arc up to value */}
        <motion.path
          d={getArcPath(0, clamped)}
          fill="none"
          stroke={zone.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${zone.color}60)` }}
        />

        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={needleTipX}
          y2={needleTipY}
          stroke={zone.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x2: needleTipX, y2: needleTipY }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{ filter: `drop-shadow(0 0 4px ${zone.color}80)` }}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={5} fill={zone.color} />

        {/* Scale labels */}
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

// ─── Ticker item component ─────────────────────────────────────────────────
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

// ─── AI Insight item ───────────────────────────────────────────────────────
function InsightItem({ icon: Icon, text, type }: { icon: React.ElementType; text: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }) {
  const colorMap = {
    bullish: 'text-emerald-400 bg-emerald-500/10',
    bearish: 'text-red-400 bg-red-500/10',
    neutral: 'text-slate-300 bg-slate-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <motion.div
      variants={itemVariants}
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
    >
      <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', colorMap[type])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
    </motion.div>
  );
}

// ─── Watchlist sparkline row ───────────────────────────────────────────────
function WatchlistRow({ symbol }: { symbol: string }) {
  const stock = STOCKS[symbol];

  const miniData = useMemo(() => {
    const d = generateStockData(symbol, 20);
    return d.slice(-20).map((item) => ({ v: item.close }));
  }, [symbol]);

  if (!stock) return null;

  const isPositive = stock.changePercent >= 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group">
      <div className="w-16 shrink-0">
        <span className="text-sm font-bold text-white">{symbol}</span>
      </div>
      <div className="w-20 shrink-0">
        <span className="text-sm text-slate-300">${formatPrice(stock.price)}</span>
      </div>
      <div className="w-20 shrink-0">
        <span className={cn('text-xs font-semibold', getChangeColor(stock.changePercent))}>
          {formatPercent(stock.changePercent)}
        </span>
      </div>
      <div className="flex-1 h-8 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={miniData}>
            <defs>
              <linearGradient id={`spark-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={1.5}
              fill={`url(#spark-${symbol})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Top Gainer/Loser item ─────────────────────────────────────────────────
function MoverItem({ symbol, price, changePercent }: { symbol: string; price: number; changePercent: number }) {
  const isPositive = changePercent >= 0;
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'p-1.5 rounded-md',
          isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'
        )}>
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{symbol}</p>
          <p className="text-xs text-slate-500">${formatPrice(price)}</p>
        </div>
      </div>
      <Badge
        className={cn(
          'text-[11px] font-semibold border-0',
          isPositive
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-red-500/15 text-red-400'
        )}
      >
        {formatPercent(changePercent)}
      </Badge>
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Ticker skeleton */}
      <div className="skeleton-glass h-10 w-full rounded-xl" />
      {/* KPI skeleton grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-glass h-32 rounded-2xl" />
        ))}
      </div>
      {/* Chart + gauge skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 skeleton-glass h-72 rounded-2xl" />
        <div className="skeleton-glass h-72 rounded-2xl" />
      </div>
      {/* Bottom cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton-glass h-64 rounded-2xl" />
        <div className="skeleton-glass h-64 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────
export function DashboardPage() {
  const { selectedStock, watchlist } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Generate 30-day chart data for selected stock
  const chartData = useMemo(() => {
    const data = generateStockData(selectedStock.symbol, 30);
    return data.map((d: OHLCV) => ({
      date: d.date.slice(5), // "MM-DD"
      close: d.close,
    }));
  }, [selectedStock.symbol]);

  // Memoize ticker data for all stocks
  const tickerStocks = useMemo(() => Object.values(STOCKS), []);

  // Compute derived KPI values
  const kpiData = useMemo(() => {
    const stock = STOCKS[selectedStock.symbol] || STOCKS.AAPL;
    // Simulated scores
    const volatilityScore = Math.round(30 + Math.abs(stock.changePercent) * 8 + (stock.volume / stock.avgVolume) * 15);
    const sentimentScore = Math.round(55 + (stock.changePercent > 0 ? stock.changePercent * 4 : stock.changePercent * 3));
    const confidenceScore = Math.round(60 + (stock.pe < 35 ? 15 : stock.pe < 50 ? 5 : -10) + (stock.changePercent > 0 ? 8 : -5));
    const riskLevel = Math.round(20 + volatilityScore * 0.4 + (stock.pe > 50 ? 15 : 0));

    return {
      price: formatPrice(stock.price),
      change: formatPercent(stock.changePercent),
      changeType: stock.changePercent > 0 ? 'positive' as const : stock.changePercent < 0 ? 'negative' as const : 'neutral' as const,
      changeAmount: formatPrice(Math.abs(stock.change)),
      volume: formatNumber(stock.volume),
      marketCap: formatNumber(stock.marketCap),
      volatilityScore: Math.min(100, volatilityScore),
      sentimentScore: Math.max(0, Math.min(100, sentimentScore)),
      confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      riskLevel: Math.max(0, Math.min(100, riskLevel)),
    };
  }, [selectedStock.symbol]);

  // Top gainers / losers
  const { topGainers, topLosers } = useMemo(() => {
    const sorted = Object.values(STOCKS).sort((a, b) => b.changePercent - a.changePercent);
    return {
      topGainers: sorted.slice(0, 3),
      topLosers: sorted.slice(-3).reverse(),
    };
  }, []);

  // Simulated fear & greed value
  const fearGreedValue = useMemo(() => {
    const avgChange = Object.values(STOCKS).reduce((s, st) => s + st.changePercent, 0) / Object.keys(STOCKS).length;
    return Math.round(50 + avgChange * 8 + (Math.random() * 6 - 3));
  }, []);

  // AI Insights — realistic per selected stock
  const insights = useMemo(() => {
    const stock = STOCKS[selectedStock.symbol] || STOCKS.AAPL;
    const allInsights: Record<string, Array<{ icon: React.ElementType; text: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }>> = {
      AAPL: [
        { icon: TrendingUp, text: `${stock.symbol} showing steady accumulation with volume 12% above 20-day average, suggesting institutional buying interest.`, type: 'bullish' },
        { icon: Zap, text: `RSI at 58.4 — neutral zone with upward bias. MACD histogram turning positive for the first time in 2 weeks.`, type: 'bullish' },
        { icon: AlertTriangle, text: `Price approaching key resistance at $${formatPrice(stock.high52w)}. A break above could trigger a rally to new 52-week highs.`, type: 'warning' },
        { icon: BrainCircuit, text: `AI model detects a 73% probability of continued uptrend in the next 5 trading sessions based on pattern recognition.`, type: 'neutral' },
      ],
      TSLA: [
        { icon: TrendingDown, text: `${stock.symbol} experiencing profit-taking after recent run. RSI at 42.1 suggests weakening momentum.`, type: 'bearish' },
        { icon: Zap, text: `Volume surge of 45% above average indicates active institutional repositioning. Watch for support at $${formatPrice(stock.low52w * 1.15)}.`, type: 'warning' },
        { icon: BrainCircuit, text: `AI detects a potential double-bottom formation. 68% probability of reversal within 3 sessions.`, type: 'neutral' },
        { icon: AlertTriangle, text: `High short interest at 4.2% could fuel a short squeeze if positive catalyst emerges.`, type: 'warning' },
      ],
      NVDA: [
        { icon: TrendingUp, text: `${stock.symbol} showing strong momentum with RSI at 72.3, approaching overbought territory but still healthy for strong trends.`, type: 'bullish' },
        { icon: Zap, text: `Revenue growth acceleration detected — AI chip demand metrics show 34% QoQ increase in data center segment.`, type: 'bullish' },
        { icon: BrainCircuit, text: `AI confidence score at 82% for continued outperformance. Pattern matches historic post-earnings surges.`, type: 'bullish' },
        { icon: AlertTriangle, text: `P/E ratio at ${stock.pe}x is elevated. Monitor for any demand deceleration signals in upcoming guidance.`, type: 'warning' },
      ],
    };

    // Default insights for stocks without specific ones
    const defaultInsights = [
      { icon: TrendingUp, text: `${stock.symbol} trading ${stock.changePercent > 0 ? 'above' : 'below'} key moving averages. ${stock.changePercent > 0 ? 'Bullish' : 'Bearish'} trend intact with support at $${formatPrice(stock.price * 0.97)}.`, type: (stock.changePercent > 0 ? 'bullish' : 'bearish') as 'bullish' | 'bearish' },
      { icon: Zap, text: `Volume at ${Math.round((stock.volume / stock.avgVolume) * 100)}% of average. ${stock.volume > stock.avgVolume ? 'Elevated activity signals strong market interest.' : 'Below-average volume suggests consolidation phase.'}`, type: 'neutral' },
      { icon: BrainCircuit, text: `AI model assigns ${Math.round(55 + Math.random() * 25)}% confidence to ${stock.changePercent > 0 ? 'upside' : 'downside'} continuation based on multi-factor analysis.`, type: 'neutral' },
      { icon: AlertTriangle, text: `52-week range: $${formatPrice(stock.low52w)} — $${formatPrice(stock.high52w)}. Currently ${Math.round(((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100)}% within range.`, type: 'warning' },
    ];

    return allInsights[selectedStock.symbol] || defaultInsights;
  }, [selectedStock.symbol]);

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* ─── 1. Market Ticker Bar ──────────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card overflow-hidden py-1">
        <div className="relative overflow-hidden">
          <div className="flex ticker-scroll" style={{ width: 'fit-content' }}>
            {[...tickerStocks, ...tickerStocks].map((s, i) => (
              <TickerItem
                key={`${s.symbol}-${i}`}
                symbol={s.symbol}
                price={s.price}
                changePercent={s.changePercent}
              />
            ))}
          </div>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0a0e1a] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0a0e1a] to-transparent pointer-events-none z-10" />
        </div>
      </motion.div>

      {/* ─── 2. KPI Cards Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Stock Price"
          value={`$${kpiData.price}`}
          change={kpiData.changeAmount}
          changeType={kpiData.changeType}
          icon={DollarSign}
          iconColor="text-cyan-400"
          glowColor="glow-cyan"
          index={0}
          subtitle={selectedStock.symbol}
        />
        <KPICard
          title="Today's Change"
          value={kpiData.change}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          glowColor="glow-green"
          changeType={kpiData.changeType}
          index={1}
          subtitle="Daily performance"
        />
        <KPICard
          title="Volume"
          value={kpiData.volume}
          change="vs avg"
          changeType="neutral"
          icon={BarChart3}
          iconColor="text-purple-400"
          glowColor="glow-purple"
          index={2}
          subtitle={`Avg: ${formatNumber((STOCKS[selectedStock.symbol] || STOCKS.AAPL).avgVolume)}`}
        />
        <KPICard
          title="Market Cap"
          value={`$${kpiData.marketCap}`}
          icon={Building2}
          iconColor="text-blue-400"
          glowColor="glow-blue"
          index={3}
          subtitle={selectedStock.name}
        />

        {/* Second row — Gauge / Circular progress cards */}
        <motion.div variants={itemVariants} className="glass-card p-5 glow-purple">
          <GaugeChart
            value={kpiData.volatilityScore}
            label="Volatility"
            size={140}
            strokeWidth={10}
            segments={[
              { from: 0, to: 30, color: '#10b981', label: 'Low' },
              { from: 30, to: 60, color: '#f59e0b', label: 'Medium' },
              { from: 60, to: 100, color: '#ef4444', label: 'High' },
            ]}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-5 glow-cyan">
          <CircularProgress
            value={kpiData.sentimentScore}
            label="Sentiment Score"
            size={120}
            strokeWidth={8}
            color="#06b6d4"
          />
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-5 glow-green">
          <CircularProgress
            value={kpiData.confidenceScore}
            label="Confidence Score"
            size={120}
            strokeWidth={8}
            color="#10b981"
          />
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-5 glow-red">
          <GaugeChart
            value={kpiData.riskLevel}
            label="Risk Level"
            size={140}
            strokeWidth={10}
            segments={[
              { from: 0, to: 35, color: '#10b981', label: 'Low Risk' },
              { from: 35, to: 65, color: '#f59e0b', label: 'Moderate' },
              { from: 65, to: 100, color: '#ef4444', label: 'High Risk' },
            ]}
          />
        </motion.div>
      </div>

      {/* ─── 3. Two-Column: Chart + Side Panel ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Price Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-card p-5 glow-blue">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CandlestickChart className="w-4 h-4 text-indigo-400" />
                {selectedStock.symbol} Price Action
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 30 trading days</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/15 text-indigo-400 border-0 text-[11px]">
                30D
              </Badge>
              <Badge className="bg-white/5 text-slate-400 border-0 text-[11px]">
                Daily
              </Badge>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={50}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#6366f1',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right: Fear & Greed + Movers */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Fear & Greed Gauge */}
          <div className="glass-card p-5 glow-purple">
            <FearGreedGauge value={fearGreedValue} />
          </div>

          {/* Top Gainers */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-emerald-500/10">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Top Gainers</h4>
            </div>
            <div className="space-y-1">
              {topGainers.map((s) => (
                <MoverItem
                  key={s.symbol}
                  symbol={s.symbol}
                  price={s.price}
                  changePercent={s.changePercent}
                />
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              </div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Top Losers</h4>
            </div>
            <div className="space-y-1">
              {topLosers.map((s) => (
                <MoverItem
                  key={s.symbol}
                  symbol={s.symbol}
                  price={s.price}
                  changePercent={s.changePercent}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── 4. Bottom Section: AI Insights + Watchlist ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Insights */}
        <motion.div variants={itemVariants} className="glass-card p-5 glow-purple">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">AI Insights</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Powered by MarketLens AI — {selectedStock.symbol}
              </p>
            </div>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-1 max-h-72 overflow-y-auto pr-1"
          >
            {insights.map((insight, i) => (
              <InsightItem key={i} {...insight} />
            ))}
          </motion.div>
        </motion.div>

        {/* Watchlist */}
        <motion.div variants={itemVariants} className="glass-card p-5 glow-cyan">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-cyan-500/10">
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Watchlist</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {watchlist.length} symbols tracked
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-3 py-2 mb-1 border-b border-white/5">
              <div className="w-16">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</span>
              </div>
              <div className="w-20">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Price</span>
              </div>
              <div className="w-20">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Change</span>
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Trend</span>
              </div>
            </div>

            <div className="space-y-0.5">
              {watchlist.map((symbol) => (
                <WatchlistRow key={symbol} symbol={symbol} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}