'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Waves,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Volume2,
  Layers,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  formatNumber,
  formatPrice,
  getChangeColor,
  type OHLCV,
} from '@/lib/stock-utils';
import { CircularProgress } from '@/components/shared/gauge-chart';
import { AnimatedCounter, SectionHeader, EmptyState, LoadingSpinner } from '@/components/shared/animated-counter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────
interface StockResponse {
  stock?: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
  };
  ohlcv?: OHLCV[];
  hasOHLCV?: boolean;
  indicators?: Record<string, number>;
  series?: Record<string, number[]>;
  error?: string;
  message?: string;
}

interface IndicatorCardData {
  label: string;
  value: string;
  raw: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
  icon: typeof Activity;
}

// ─── Animation Variants ──────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Chart Tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || '#fff' }} className="font-semibold">
          {entry.dataKey}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Derive indicator cards from API data ────────────────────────────
function deriveIndicatorCards(ind: Record<string, number> | undefined, price: number): IndicatorCardData[] {
  if (!ind) return [];
  const cards: IndicatorCardData[] = [];

  const rsi = ind.rsi;
  if (rsi !== undefined && !isNaN(rsi)) {
    cards.push({
      label: 'RSI (14)',
      value: rsi.toFixed(1),
      raw: rsi,
      signal: rsi > 70 ? 'bearish' : rsi < 30 ? 'bullish' : 'neutral',
      description: rsi > 70 ? 'Overbought territory' : rsi < 30 ? 'Oversold territory' : 'Neutral zone',
      icon: Activity,
    });
  }

  const macd = ind.macd;
  const macdSignal = ind.macdSignal;
  const macdHist = ind.macdHistogram;
  if (macd !== undefined && !isNaN(macd)) {
    const signal = macdHist !== undefined && !isNaN(macdHist)
      ? (macdHist > 0 ? 'bullish' : macdHist < 0 ? 'bearish' : 'neutral')
      : 'neutral';
    cards.push({
      label: 'MACD',
      value: macd.toFixed(3),
      raw: macd,
      signal,
      description: macdSignal !== undefined ? `Signal: ${macdSignal.toFixed(3)}` : 'No signal line',
      icon: Waves,
    });
  }

  const sma20 = ind.sma20;
  if (sma20 !== undefined && !isNaN(sma20)) {
    cards.push({
      label: 'SMA 20',
      value: `$${sma20.toFixed(2)}`,
      raw: price > 0 ? ((price - sma20) / sma20) * 100 : 0,
      signal: price > sma20 ? 'bullish' : price < sma20 ? 'bearish' : 'neutral',
      description: price > sma20 ? 'Price above SMA' : 'Price below SMA',
      icon: TrendingUp,
    });
  }

  const ema12 = ind.ema12;
  if (ema12 !== undefined && !isNaN(ema12)) {
    cards.push({
      label: 'EMA 12',
      value: `$${ema12.toFixed(2)}`,
      raw: price > 0 ? ((price - ema12) / ema12) * 100 : 0,
      signal: price > ema12 ? 'bullish' : price < ema12 ? 'bearish' : 'neutral',
      description: 'Short-term exponential MA',
      icon: Zap,
    });
  }

  const bbUpper = ind.bbUpper;
  const bbLower = ind.bbLower;
  const bbMiddle = ind.bbMiddle;
  if (bbUpper !== undefined && !isNaN(bbUpper) && bbLower !== undefined && !isNaN(bbLower)) {
    const bbWidth = ((bbUpper - bbLower) / bbMiddle) * 100;
    cards.push({
      label: 'Bollinger Bands',
      value: `${bbWidth.toFixed(1)}% width`,
      raw: bbWidth,
      signal: price >= bbUpper ? 'bearish' : price <= bbLower ? 'bullish' : 'neutral',
      description: price >= bbUpper ? 'At upper band' : price <= bbLower ? 'At lower band' : 'Within bands',
      icon: Layers,
    });
  }

  const atr = ind.atr;
  if (atr !== undefined && !isNaN(atr)) {
    cards.push({
      label: 'ATR (14)',
      value: atr.toFixed(3),
      raw: atr,
      signal: 'neutral',
      description: 'Average True Range',
      icon: Target,
    });
  }

  const vwap = ind.vwap;
  if (vwap !== undefined && !isNaN(vwap)) {
    cards.push({
      label: 'VWAP',
      value: `$${vwap.toFixed(2)}`,
      raw: price > 0 ? ((price - vwap) / vwap) * 100 : 0,
      signal: price > vwap ? 'bullish' : price < vwap ? 'bearish' : 'neutral',
      description: price > vwap ? 'Above VWAP (bullish)' : 'Below VWAP (bearish)',
      icon: BarChart3,
    });
  }

  const stochK = ind.stochK;
  const stochD = ind.stochD;
  if (stochK !== undefined && !isNaN(stochK)) {
    cards.push({
      label: 'Stochastic RSI',
      value: `K:${stochK.toFixed(1)} D:${stochD !== undefined && !isNaN(stochD) ? stochD.toFixed(1) : 'N/A'}`,
      raw: stochK,
      signal: stochK > 80 ? 'bearish' : stochK < 20 ? 'bullish' : 'neutral',
      description: stochK > 80 ? 'Overbought' : stochK < 20 ? 'Oversold' : 'Neutral',
      icon: Cpu,
    });
  }

  const adx = ind.adx;
  if (adx !== undefined && !isNaN(adx)) {
    cards.push({
      label: 'ADX (14)',
      value: adx.toFixed(1),
      raw: adx,
      signal: adx > 25 ? 'bullish' : adx < 20 ? 'neutral' : 'neutral',
      description: adx > 50 ? 'Strong trend' : adx > 25 ? 'Trending' : 'Weak trend / ranging',
      icon: TrendingUp,
    });
  }

  const cci = ind.cci;
  if (cci !== undefined && !isNaN(cci)) {
    cards.push({
      label: 'CCI (20)',
      value: cci.toFixed(1),
      raw: cci,
      signal: cci > 100 ? 'bearish' : cci < -100 ? 'bullish' : 'neutral',
      description: cci > 100 ? 'Overbought' : cci < -100 ? 'Oversold' : 'Normal',
      icon: Activity,
    });
  }

  const obv = ind.obv;
  if (obv !== undefined && !isNaN(obv)) {
    cards.push({
      label: 'OBV',
      value: formatNumber(obv),
      raw: 0,
      signal: 'neutral',
      description: 'On-Balance Volume',
      icon: Volume2,
    });
  }

  return cards;
}

// ─── Signal Summary Logic ────────────────────────────────────────────
function getSignalSummary(cards: IndicatorCardData[]) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  cards.forEach((c) => {
    if (c.signal === 'bullish') bullish++;
    else if (c.signal === 'bearish') bearish++;
    else neutral++;
  });
  const total = bullish + bearish + neutral;
  if (total === 0) return { label: 'No Data', bullish: 0, bearish: 0, neutral: 0, score: 0, color: '#64748b' };
  const score = ((bullish - bearish) / total) * 100;
  let label: string;
  let color: string;
  if (score > 25) { label = 'Strongly Bullish'; color = '#10b981'; }
  else if (score > 10) { label = 'Bullish'; color = '#22c55e'; }
  else if (score < -25) { label = 'Strongly Bearish'; color = '#ef4444'; }
  else if (score < -10) { label = 'Bearish'; color = '#f97316'; }
  else { label = 'Neutral'; color = '#eab308'; }
  return { label, bullish, bearish, neutral, score, color };
}

// ─── Signal Badge Component ──────────────────────────────────────────
function SignalBadge({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) {
  if (signal === 'bullish') return <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] border-0">BULLISH</Badge>;
  if (signal === 'bearish') return <Badge className="bg-red-500/15 text-red-400 text-[10px] border-0">BEARISH</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-400 text-[10px] border-0">NEUTRAL</Badge>;
}

// ─── Main TechnicalAnalysisPage ─────────────────────────────────────
export function TechnicalAnalysisPage() {
  const { selectedStock } = useAppStore();
  const [stockData, setStockData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('rsi');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${selectedStock.symbol}&days=90`);
      const data: StockResponse = await res.json();
      setStockData(data);
    } catch {
      setStockData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStock.symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ohlcv = stockData?.ohlcv || [];
  const hasOHLCV = stockData?.hasOHLCV && ohlcv.length > 0;
  const indicators = stockData?.indicators;
  const series = stockData?.series;
  const price = stockData?.stock?.price || 0;

  const indicatorCards = deriveIndicatorCards(indicators, price);
  const signalSummary = getSignalSummary(indicatorCards);

  // Build chart data arrays aligned with OHLCV dates
  const buildChartData = (keys: string[]) => {
    if (!series || !hasOHLCV) return [];
    return ohlcv.map((d, i) => {
      const point: Record<string, string | number> = { date: d.date.slice(5) };
      for (const key of keys) {
        const arr = series[key];
        if (!arr) continue;
        // Series may be shorter (e.g. MACD) — align from end
        const offset = ohlcv.length - arr.length;
        const idx = i - offset;
        if (idx >= 0 && idx < arr.length && !isNaN(arr[idx])) {
          point[key] = arr[idx];
        }
      }
      return point;
    });
  };

  const rsiData = buildChartData(['rsi']);
  const macdData = buildChartData(['macd', 'macdSignal', 'macdHistogram']);
  const smaData = buildChartData(['sma20', 'sma50', 'ema12', 'close']);
  const bbData = buildChartData(['bbUpper', 'bbMiddle', 'bbLower', 'close']);
  const atrData = buildChartData(['atr']);
  const vwapData = buildChartData(['vwap', 'close']);
  const stochData = buildChartData(['stochK', 'stochD']);
  const adxData = buildChartData(['adx', 'adxPlusDI', 'adxMinusDI']);
  const cciData = buildChartData(['cci']);
  const obvData = buildChartData(['obv']);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="Technical Analysis"
          subtitle={`${selectedStock.symbol} — 90 Day Indicators`}
          badge={hasOHLCV ? { label: 'LIVE DATA', color: 'bg-emerald-500/15 text-emerald-400' } : undefined}
          action={
            <Button variant="outline" size="sm" onClick={fetchData} className="gradient-button border-0">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          }
        />
      </motion.div>

      {/* ── Signal Summary Bar ───────────────────────────────────── */}
      {loading ? (
        <motion.div variants={itemVariants} className="glass-card p-5">
          <Skeleton className="h-16 w-full bg-white/5 rounded-xl" />
        </motion.div>
      ) : !hasOHLCV || indicatorCards.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card p-8">
          <EmptyState
            icon={<Activity className="w-10 h-10" />}
            title="No Live Data Available"
            description={`No OHLCV data for ${selectedStock.symbol} to compute technical indicators. The data source may be temporarily unavailable.`}
            action={
              <Button variant="outline" size="sm" onClick={fetchData} className="gradient-button border-0">
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Retry
              </Button>
            }
          />
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="glass-card p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CircularProgress
                  value={Math.max(0, Math.min(100, 50 + signalSummary.score / 2))}
                  label="Signal Score"
                  size={80}
                  strokeWidth={6}
                  color={signalSummary.color}
                />
                <div>
                  <div className="text-lg font-bold" style={{ color: signalSummary.color }}>
                    {signalSummary.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {indicatorCards.length} indicators analyzed
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    <span className="text-lg font-bold text-emerald-400">{signalSummary.bullish}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Bullish</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Minus className="w-4 h-4 text-amber-400" />
                    <span className="text-lg font-bold text-amber-400">{signalSummary.neutral}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Neutral</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span className="text-lg font-bold text-red-400">{signalSummary.bearish}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Bearish</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Indicator Summary Cards ───────────────────────────── */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {indicatorCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35 }}
                className={cn(
                  'glass-card p-4 cursor-default',
                  card.signal === 'bullish' ? 'glow-green' : card.signal === 'bearish' ? 'glow-red' : 'glow-blue'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <card.icon className={cn(
                    'w-4 h-4',
                    card.signal === 'bullish' ? 'text-emerald-400' : card.signal === 'bearish' ? 'text-red-400' : 'text-cyan-400'
                  )} />
                  <SignalBadge signal={card.signal} />
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                <p className="text-sm font-bold text-white">{card.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{card.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Full-Size Indicator Charts ────────────────────────── */}
          <motion.div variants={itemVariants} className="glass-card p-5">
            <Tabs value={activeChart} onValueChange={setActiveChart} className="w-full">
              <TabsList className="bg-white/5 rounded-xl p-1 h-9 flex-wrap">
                {['rsi', 'macd', 'sma', 'bb', 'atr', 'vwap', 'stoch', 'adx', 'cci', 'obv'].map((key) => (
                  <TabsTrigger key={key} value={key} className="text-[10px] data-[state=active]:gradient-button rounded-lg h-7 px-2.5">
                    {key === 'stoch' ? 'StochRSI' : key.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* RSI Chart */}
              <TabsContent value="rsi" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rsiData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '70', fill: '#ef4444', fontSize: 9 }} />
                      <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '30', fill: '#10b981', fontSize: 9 }} />
                      <ReferenceArea y1={30} y2={70} fill="rgba(148,163,184,0.03)" />
                      <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* MACD Chart */}
              <TabsContent value="macd" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={macdData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                      <Bar dataKey="macdHistogram" radius={[2, 2, 0, 0]}>
                        {macdData.map((entry, i) => (
                          <Cell key={i} fill={typeof entry.macdHistogram === 'number' && entry.macdHistogram >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={macdData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                      <Line type="monotone" dataKey="macd" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls name="MACD" />
                      <Line type="monotone" dataKey="macdSignal" stroke="#fb923c" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="Signal" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* SMA/EMA Chart */}
              <TabsContent value="sma" className="mt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={smaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="close" stroke="#ffffff" strokeWidth={1.5} dot={false} opacity={0.4} name="Price" />
                      <Line type="monotone" dataKey="sma20" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls name="SMA 20" />
                      <Line type="monotone" dataKey="sma50" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls name="SMA 50" />
                      <Line type="monotone" dataKey="ema12" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="EMA 12" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Bollinger Bands Chart */}
              <TabsContent value="bb" className="mt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bbData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="bbUpper" stroke="#818cf8" strokeWidth={1} fill="rgba(99,102,241,0.08)" dot={false} connectNulls name="Upper" />
                      <Line type="monotone" dataKey="bbMiddle" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls name="Middle" />
                      <Area type="monotone" dataKey="bbLower" stroke="#818cf8" strokeWidth={1} fill="rgba(99,102,241,0.08)" dot={false} connectNulls name="Lower" />
                      <Line type="monotone" dataKey="close" stroke="#ffffff" strokeWidth={1.5} dot={false} opacity={0.8} name="Price" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* ATR Chart */}
              <TabsContent value="atr" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={atrData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <defs>
                        <linearGradient id="atrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="atr" stroke="#f97316" strokeWidth={2} fill="url(#atrGrad)" dot={false} connectNulls name="ATR" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* VWAP Chart */}
              <TabsContent value="vwap" className="mt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vwapData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="close" stroke="#ffffff" strokeWidth={1.5} dot={false} opacity={0.5} name="Price" />
                      <Line type="monotone" dataKey="vwap" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls name="VWAP" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Stochastic RSI Chart */}
              <TabsContent value="stoch" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stochData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceArea y1={20} y2={80} fill="rgba(148,163,184,0.03)" />
                      <Line type="monotone" dataKey="stochK" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls name="%K" />
                      <Line type="monotone" dataKey="stochD" stroke="#fb923c" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="%D" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* ADX Chart */}
              <TabsContent value="adx" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={adxData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '25', fill: '#f59e0b', fontSize: 9 }} />
                      <Line type="monotone" dataKey="adx" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls name="ADX" />
                      <Line type="monotone" dataKey="adxPlusDI" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="+DI" />
                      <Line type="monotone" dataKey="adxMinusDI" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="-DI" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* CCI Chart */}
              <TabsContent value="cci" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cciData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={-100} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                      <ReferenceArea y1={-100} y2={100} fill="rgba(148,163,184,0.03)" />
                      <Line type="monotone" dataKey="cci" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls name="CCI" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* OBV Chart */}
              <TabsContent value="obv" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={obvData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => formatNumber(v)} />
                      <Tooltip content={<ChartTooltip />} />
                      <defs>
                        <linearGradient id="obvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="obv" stroke="#818cf8" strokeWidth={2} fill="url(#obvGrad)" dot={false} connectNulls name="OBV" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}