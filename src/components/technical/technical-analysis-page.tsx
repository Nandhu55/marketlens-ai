'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  CartesianGrid,
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
  ChevronRight,
  Volume2,
  Layers,
  Cpu,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  formatNumber,
  formatPrice,
  getChangeColor,
  type OHLCV,
} from '@/lib/stock-utils';
import { CircularProgress } from '@/components/shared/gauge-chart';
import { AnimatedCounter, SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Stochastic Oscillator ────────────────────────────────────────────────
function calculateStochastic(data: OHLCV[], kPeriod: number = 14, dPeriod: number = 3): { k: number[]; d: number[] } {
  const kValues: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(NaN);
      continue;
    }
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map((d) => d.high));
    const lowest = Math.min(...slice.map((d) => d.low));
    const range = highest - lowest;
    const k = range === 0 ? 50 : ((data[i].close - lowest) / range) * 100;
    kValues.push(parseFloat(k.toFixed(2)));
  }

  const dValues = calculateSMA(kValues.filter((v) => !isNaN(v)), dPeriod);
  const dPadded: number[] = new Array(kValues.length - dValues.length).fill(NaN).concat(dValues);

  return { k: kValues, d: dPadded };
}

// ─── Time range config ────────────────────────────────────────────────────
type TimeRange = '1M' | '3M' | '6M' | '1Y';
const TIME_RANGES: { label: TimeRange; days: number }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

// ─── Animation variants ──────────────────────────────────────────────────
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

// ─── Chart Tooltip ────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 rounded-lg border border-indigo-500/20 min-w-[140px]">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm mb-0.5 last:mb-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400 capitalize text-xs">{entry.dataKey}:</span>
          <span className="font-semibold text-white text-xs">{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mini MACD Chart ──────────────────────────────────────────────────────
function MiniMACDChart({ data }: { data: Array<{ date: string; histogram: number }> }) {
  const last10 = data.slice(-10);
  return (
    <div className="h-12 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={last10} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar
            dataKey="histogram"
            radius={[2, 2, 0, 0]}
            fill="#6366f1"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Indicator Signal Badge ───────────────────────────────────────────────
function SignalBadge({ signal, type }: { signal: string; type: 'bullish' | 'bearish' | 'neutral' }) {
  const colors = {
    bullish: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    bearish: 'bg-red-500/15 text-red-400 border-red-500/20',
    neutral: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] border', colors[type])}>
      {signal}
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export function TechnicalAnalysisPage() {
  const { selectedStock, setSelectedStock } = useAppStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  const symbol = selectedStock.symbol;
  const days = TIME_RANGES.find((r) => r.label === timeRange)?.days ?? 90;

  // Generate raw OHLCV data
  const rawData = useMemo(() => generateStockData(symbol, days), [symbol, days]);
  const closes = useMemo(() => rawData.map((d) => d.close), [rawData]);

  // ── Calculate all indicators ──
  const rsiValues = useMemo(() => calculateRSI(closes, 14), [closes]);
  const macdResult = useMemo(() => calculateMACD(closes), [closes]);
  const sma20 = useMemo(() => calculateSMA(closes, 20), [closes]);
  const sma50 = useMemo(() => calculateSMA(closes, 50), [closes]);
  const ema12 = useMemo(() => calculateEMA(closes, 12), [closes]);
  const ema26 = useMemo(() => calculateEMA(closes, 26), [closes]);
  const bbResult = useMemo(() => calculateBollingerBands(closes, 20, 2), [closes]);
  const atrValues = useMemo(() => calculateATR(rawData, 14), [rawData]);
  const stochasticResult = useMemo(() => calculateStochastic(rawData), [rawData]);

  // Current (last valid) values
  const currentRSI = useMemo(() => rsiValues.filter((v) => !isNaN(v)).pop() ?? 50, [rsiValues]);

  const currentMACD = useMemo(() => {
    const valid = macdResult.macd.filter((v) => !isNaN(v));
    return valid[valid.length - 1] ?? 0;
  }, [macdResult.macd]);

  const currentSignal = useMemo(() => {
    const valid = macdResult.signal.filter((v) => !isNaN(v));
    return valid[valid.length - 1] ?? 0;
  }, [macdResult.signal]);

  const currentHistogram = useMemo(() => {
    const valid = macdResult.histogram.filter((v) => !isNaN(v));
    return valid[valid.length - 1] ?? 0;
  }, [macdResult.histogram]);

  const currentSMA20 = useMemo(() => sma20.filter((v) => !isNaN(v)).pop() ?? 0, [sma20]);
  const currentSMA50 = useMemo(() => sma50.filter((v) => !isNaN(v)).pop() ?? 0, [sma50]);
  const currentEMA12 = useMemo(() => ema12.filter((v) => !isNaN(v)).pop() ?? 0, [ema12]);
  const currentEMA26 = useMemo(() => ema26.filter((v) => !isNaN(v)).pop() ?? 0, [ema26]);

  const currentBBUpper = useMemo(() => bbResult.upper.filter((v) => !isNaN(v)).pop() ?? 0, [bbResult.upper]);
  const currentBBMiddle = useMemo(() => bbResult.middle.filter((v) => !isNaN(v)).pop() ?? 0, [bbResult.middle]);
  const currentBBLower = useMemo(() => bbResult.lower.filter((v) => !isNaN(v)).pop() ?? 0, [bbResult.lower]);
  const bbWidth = useMemo(() => {
    if (currentBBMiddle === 0) return 0;
    return ((currentBBUpper - currentBBLower) / currentBBMiddle) * 100;
  }, [currentBBUpper, currentBBLower, currentBBMiddle]);

  const currentATR = useMemo(() => atrValues.filter((v) => !isNaN(v)).pop() ?? 0, [atrValues]);

  const currentStochK = useMemo(() => stochasticResult.k.filter((v) => !isNaN(v)).pop() ?? 50, [stochasticResult.k]);
  const currentStochD = useMemo(() => stochasticResult.d.filter((v) => !isNaN(v)).pop() ?? 50, [stochasticResult.d]);

  const currentVolume = useMemo(() => rawData[rawData.length - 1]?.volume ?? 0, [rawData]);
  const avgVolume = useMemo(() => {
    const recent = rawData.slice(-20);
    return recent.reduce((sum, d) => sum + d.volume, 0) / recent.length;
  }, [rawData]);

  const currentPrice = selectedStock.price;

  // ── Determine signals ──
  const rsiSignal = useMemo(() => {
    if (currentRSI > 70) return { text: 'Overbought', type: 'bearish' as const };
    if (currentRSI < 30) return { text: 'Oversold', type: 'bullish' as const };
    if (currentRSI > 55) return { text: 'Bullish', type: 'bullish' as const };
    if (currentRSI < 45) return { text: 'Bearish', type: 'bearish' as const };
    return { text: 'Neutral', type: 'neutral' as const };
  }, [currentRSI]);

  const macdSignal = useMemo(() => {
    if (currentMACD > 0 && currentHistogram > 0) return { text: 'Bullish', type: 'bullish' as const };
    if (currentMACD < 0 && currentHistogram < 0) return { text: 'Bearish', type: 'bearish' as const };
    if (currentMACD > 0 && currentHistogram < 0) return { text: 'Weakening', type: 'neutral' as const };
    return { text: 'Strengthening', type: 'neutral' as const };
  }, [currentMACD, currentHistogram]);

  const smaSignal = useMemo(() => {
    if (currentSMA20 > currentSMA50) return { text: 'Golden Cross', type: 'bullish' as const };
    if (currentSMA20 < currentSMA50) return { text: 'Death Cross', type: 'bearish' as const };
    return { text: 'None', type: 'neutral' as const };
  }, [currentSMA20, currentSMA50]);

  const emaTrend = useMemo(() => {
    if (currentEMA12 > currentEMA26) return { text: 'Bullish Trend', type: 'bullish' as const };
    if (currentEMA12 < currentEMA26) return { text: 'Bearish Trend', type: 'bearish' as const };
    return { text: 'Sideways', type: 'neutral' as const };
  }, [currentEMA12, currentEMA26]);

  const stochSignal = useMemo(() => {
    if (currentStochK > 80) return { text: 'Overbought', type: 'bearish' as const };
    if (currentStochK < 20) return { text: 'Oversold', type: 'bullish' as const };
    if (currentStochK > currentStochD) return { text: 'Bullish', type: 'bullish' as const };
    return { text: 'Bearish', type: 'bearish' as const };
  }, [currentStochK, currentStochD]);

  const atrInterpretation = useMemo(() => {
    const atrPercent = (currentATR / currentPrice) * 100;
    if (atrPercent > 3) return 'Very High Volatility';
    if (atrPercent > 2) return 'High Volatility';
    if (atrPercent > 1) return 'Moderate Volatility';
    return 'Low Volatility';
  }, [currentATR, currentPrice]);

  const volumeSignal = useMemo(() => {
    const ratio = currentVolume / avgVolume;
    if (ratio > 1.5) return { text: 'High Volume Spike', type: 'bullish' as const };
    if (ratio > 1.2) return { text: 'Above Average', type: 'neutral' as const };
    if (ratio < 0.7) return { text: 'Below Average', type: 'neutral' as const };
    return { text: 'Normal', type: 'neutral' as const };
  }, [currentVolume, avgVolume]);

  // ── Signal Summary ──
  const allSignals = useMemo(() => [
    rsiSignal,
    macdSignal,
    smaSignal,
    emaTrend,
    stochSignal,
  ], [rsiSignal, macdSignal, smaSignal, emaTrend, stochSignal]);

  const bullCount = useMemo(() => allSignals.filter((s) => s.type === 'bullish').length, [allSignals]);
  const bearCount = useMemo(() => allSignals.filter((s) => s.type === 'bearish').length, [allSignals]);
  const neutralCount = useMemo(() => allSignals.filter((s) => s.type === 'neutral').length, [allSignals]);

  const overallSignal = useMemo(() => {
    if (bullCount > bearCount + 1) return { text: 'Bullish', type: 'bullish' as const };
    if (bearCount > bullCount + 1) return { text: 'Bearish', type: 'bearish' as const };
    return { text: 'Neutral', type: 'neutral' as const };
  }, [bullCount, bearCount]);

  // ── Chart data ──
  const rsiChartData = useMemo(() => {
    return rawData.map((d, i) => ({
      date: d.date,
      rsi: rsiValues[i],
    }));
  }, [rawData, rsiValues]);

  const macdChartData = useMemo(() => {
    return rawData.map((d, i) => ({
      date: d.date,
      macd: macdResult.macd[i],
      signal: macdResult.signal[i],
      histogram: macdResult.histogram[i],
    })).filter((d) => !isNaN(d.macd) && !isNaN(d.signal));
  }, [rawData, macdResult]);

  const miniMacdData = useMemo(() => {
    return macdChartData.map((d) => ({
      date: d.date,
      histogram: d.histogram ?? 0,
    }));
  }, [macdChartData]);

  const bbChartData = useMemo(() => {
    return rawData.map((d, i) => ({
      date: d.date,
      price: d.close,
      upper: bbResult.upper[i],
      middle: bbResult.middle[i],
      lower: bbResult.lower[i],
    })).filter((d) => !isNaN(d.upper));
  }, [rawData, bbResult]);

  const volumeChartData = useMemo(() => {
    return rawData.map((d) => ({
      date: d.date,
      volume: d.volume,
      price: d.close,
    }));
  }, [rawData]);

  const handleStockChange = useCallback((value: string) => {
    const stock = STOCKS[value];
    if (stock) {
      setSelectedStock({
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
        marketCap: stock.marketCap,
      });
    }
  }, [setSelectedStock]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10">
            <Activity className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Technical Analysis</h1>
            <p className="text-sm text-slate-400">Comprehensive indicator breakdown and charts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={symbol} onValueChange={handleStockChange}>
            <SelectTrigger className="w-[200px] bg-white/5 border-slate-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(STOCKS).map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.label}
                variant="ghost"
                size="sm"
                onClick={() => setTimeRange(range.label)}
                className={cn(
                  'h-7 px-3 text-xs font-medium rounded-md',
                  timeRange === range.label
                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Signal Summary ── */}
      <motion.div variants={itemVariants} className="glass-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Overall Signal</p>
              <div className="flex items-center gap-2">
                {overallSignal.type === 'bullish' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                {overallSignal.type === 'bearish' && <TrendingDown className="w-5 h-5 text-red-400" />}
                {overallSignal.type === 'neutral' && <Minus className="w-5 h-5 text-amber-400" />}
                <span className={cn(
                  'text-lg font-bold',
                  overallSignal.type === 'bullish' && 'text-emerald-400',
                  overallSignal.type === 'bearish' && 'text-red-400',
                  overallSignal.type === 'neutral' && 'text-amber-400',
                )}>
                  {overallSignal.text}
                </span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-700/50 hidden sm:block" />
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400 font-medium">{bullCount} Bullish</span>
              <span className="text-amber-400 font-medium">{neutralCount} Neutral</span>
              <span className="text-red-400 font-medium">{bearCount} Bearish</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allSignals.map((s, i) => (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 rounded-full transition-colors',
                  s.type === 'bullish' && 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
                  s.type === 'bearish' && 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
                  s.type === 'neutral' && 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
                )}
                title={s.text}
              />
            ))}
            <span className="text-xs text-slate-500 ml-1">
              {['RSI', 'MACD', 'SMA', 'EMA', 'Stoch'].map((name, i) => (
                <span key={name} className="mr-2">
                  {name}
                </span>
              ))}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Technical Indicators Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RSI Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">RSI (14)</h3>
            <SignalBadge signal={rsiSignal.text} type={rsiSignal.type} />
          </div>
          <div className="flex items-center gap-4">
            <CircularProgress
              value={currentRSI}
              label=""
              size={90}
              strokeWidth={7}
              color={currentRSI > 70 ? '#ef4444' : currentRSI < 30 ? '#10b981' : '#6366f1'}
            />
            <div>
              <p className={cn(
                'text-2xl font-bold',
                currentRSI > 70 ? 'text-red-400' : currentRSI < 30 ? 'text-emerald-400' : 'text-white'
              )}>
                {currentRSI.toFixed(1)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {currentRSI > 70 ? 'Overbought territory' : currentRSI < 30 ? 'Oversold territory' : 'Normal range'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* MACD Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">MACD</h3>
            <SignalBadge signal={macdSignal.text} type={macdSignal.type} />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">MACD</p>
              <p className={cn('text-sm font-bold', currentMACD >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {currentMACD >= 0 ? '+' : ''}{currentMACD.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Signal</p>
              <p className="text-sm font-bold text-cyan-400">{currentSignal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Hist</p>
              <p className={cn('text-sm font-bold', currentHistogram >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {currentHistogram >= 0 ? '+' : ''}{currentHistogram.toFixed(2)}
              </p>
            </div>
          </div>
          <MiniMACDChart data={miniMacdData} />
        </motion.div>

        {/* SMA Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">SMA (20/50)</h3>
            <SignalBadge signal={smaSignal.text} type={smaSignal.type} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-xs text-slate-400">SMA 20</span>
              </div>
              <span className="text-sm font-bold text-white">${formatPrice(currentSMA20)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-xs text-slate-400">SMA 50</span>
              </div>
              <span className="text-sm font-bold text-white">${formatPrice(currentSMA50)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {smaSignal.type === 'bullish' ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : smaSignal.type === 'bearish' ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={cn(
                'font-medium',
                smaSignal.type === 'bullish' && 'text-emerald-400',
                smaSignal.type === 'bearish' && 'text-red-400',
                smaSignal.type === 'neutral' && 'text-amber-400',
              )}>
                {smaSignal.type === 'bullish' ? 'SMA 20 above SMA 50' : smaSignal.type === 'bearish' ? 'SMA 20 below SMA 50' : 'Crossovers pending'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* EMA Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">EMA (12/26)</h3>
            <SignalBadge signal={emaTrend.text} type={emaTrend.type} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span className="text-xs text-slate-400">EMA 12</span>
              </div>
              <span className="text-sm font-bold text-white">${formatPrice(currentEMA12)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-xs text-slate-400">EMA 26</span>
              </div>
              <span className="text-sm font-bold text-white">${formatPrice(currentEMA26)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {emaTrend.type === 'bullish' ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : emaTrend.type === 'bearish' ? (
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={cn(
                'font-medium',
                emaTrend.type === 'bullish' && 'text-emerald-400',
                emaTrend.type === 'bearish' && 'text-red-400',
                emaTrend.type === 'neutral' && 'text-amber-400',
              )}>
                {emaTrend.text}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Bollinger Bands Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Bollinger Bands</h3>
            <Badge variant="outline" className="text-[10px] border-slate-600/50 text-slate-400">
              {bbWidth.toFixed(1)}% Width
            </Badge>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Upper</span>
              <span className="text-sm font-bold text-cyan-400">${formatPrice(currentBBUpper)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Middle</span>
              <span className="text-sm font-bold text-white">${formatPrice(currentBBMiddle)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Lower</span>
              <span className="text-sm font-bold text-cyan-400">${formatPrice(currentBBLower)}</span>
            </div>
            <div className="relative h-2 bg-slate-800/50 rounded-full overflow-hidden mt-1">
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-cyan-500/20 rounded-full"
                style={{
                  left: `${Math.max(0, ((currentBBLower - currentPrice * 0.97) / (currentPrice * 0.08)) * 100)}%`,
                  right: `${Math.max(0, ((currentPrice * 1.03 - currentBBUpper) / (currentPrice * 0.08)) * 100)}%`,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-white rounded-full shadow-lg shadow-white/30"
                style={{
                  left: `${Math.max(0, Math.min(100, ((currentPrice - currentBBLower) / (currentBBUpper - currentBBLower)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* ATR Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">ATR (14)</h3>
            <Waves className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Waves className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{currentATR.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{atrInterpretation}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {((currentATR / currentPrice) * 100).toFixed(2)}% of price
              </p>
            </div>
          </div>
        </motion.div>

        {/* Volume Analysis Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Volume Analysis</h3>
            <SignalBadge signal={volumeSignal.text} type={volumeSignal.type} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Current Volume</span>
              <span className="text-sm font-bold text-white">{formatNumber(currentVolume)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Avg Volume (20d)</span>
              <span className="text-sm font-bold text-slate-300">{formatNumber(avgVolume)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Ratio:</span>
              <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (currentVolume / avgVolume) * 50)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' as const }}
                />
              </div>
              <span className={cn(
                'text-xs font-bold',
                currentVolume > avgVolume ? 'text-emerald-400' : 'text-red-400'
              )}>
                {(currentVolume / avgVolume).toFixed(2)}x
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stochastic Oscillator Card */}
        <motion.div variants={itemVariants} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Stochastic (14,3)</h3>
            <SignalBadge signal={stochSignal.text} type={stochSignal.type} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">%K</p>
              <p className={cn(
                'text-xl font-bold',
                currentStochK > 80 ? 'text-red-400' : currentStochK < 20 ? 'text-emerald-400' : 'text-white'
              )}>
                {currentStochK.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">%D</p>
              <p className={cn(
                'text-xl font-bold',
                currentStochD > 80 ? 'text-red-400' : currentStochD < 20 ? 'text-emerald-400' : 'text-slate-300'
              )}>
                {currentStochD.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="mt-3 relative h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <div className="absolute left-[20%] top-0 bottom-0 w-px bg-emerald-500/30" />
            <div className="absolute left-[80%] top-0 bottom-0 w-px bg-red-500/30" />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-3 bg-indigo-400 rounded-full shadow-lg"
              animate={{ left: `${Math.max(0, Math.min(100, currentStochK))}%` }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-3 bg-cyan-400 rounded-full shadow-lg"
              animate={{ left: `${Math.max(0, Math.min(100, currentStochD))}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-1">
            <span>0</span>
            <span className="text-emerald-500/50">20</span>
            <span>50</span>
            <span className="text-red-500/50">80</span>
            <span>100</span>
          </div>
        </motion.div>
      </div>

      {/* ── Full Technical Charts ── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <Tabs defaultValue="rsi">
          <TabsList className="bg-white/5 mb-4">
            <TabsTrigger value="rsi" className="text-xs">
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              RSI
            </TabsTrigger>
            <TabsTrigger value="macd" className="text-xs">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              MACD
            </TabsTrigger>
            <TabsTrigger value="bollinger" className="text-xs">
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Bollinger Bands
            </TabsTrigger>
            <TabsTrigger value="volume" className="text-xs">
              <Volume2 className="w-3.5 h-3.5 mr-1.5" />
              Volume & Price
            </TabsTrigger>
          </TabsList>

          {/* RSI Chart */}
          <TabsContent value="rsi">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rsiChartData.filter((d) => !isNaN(d.rsi))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="5 5" strokeOpacity={0.5} />
                  <ReferenceLine y={50} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="rsi"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: '#6366f1' }}
                    name="RSI"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1">
              <span className="text-[10px] text-red-400/60">Overbought (70)</span>
              <span className="text-[10px] text-slate-500">Neutral (50)</span>
              <span className="text-[10px] text-emerald-400/60">Oversold (30)</span>
            </div>
          </TabsContent>

          {/* MACD Chart */}
          <TabsContent value="macd">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={macdChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                  <Bar
                    dataKey="histogram"
                    fill="#6366f1"
                    opacity={0.3}
                    name="Histogram"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="macd"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: '#06b6d4' }}
                    name="MACD"
                  />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 3, fill: '#f97316' }}
                    name="Signal"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                <div className="w-3 h-0.5 bg-cyan-500 rounded" /> MACD Line
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-orange-400">
                <div className="w-3 h-0.5 bg-orange-500 rounded" style={{ borderTop: '2px dashed #f97316' }} /> Signal Line
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400">
                <div className="w-3 h-1.5 bg-indigo-500/30 rounded-sm" /> Histogram
              </div>
            </div>
          </TabsContent>

          {/* Bollinger Bands Chart */}
          <TabsContent value="bollinger">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bbChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="transparent"
                    fill="url(#bbFill)"
                    name="Band"
                  />
                  <Line
                    type="monotone"
                    dataKey="upper"
                    stroke="#06b6d4"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Upper Band"
                  />
                  <Line
                    type="monotone"
                    dataKey="middle"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    dot={false}
                    name="Middle Band"
                  />
                  <Line
                    type="monotone"
                    dataKey="lower"
                    stroke="#06b6d4"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Lower Band"
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: '#10b981' }}
                    name="Price"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" /> Price
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400">
                <div className="w-3 h-0.5 bg-indigo-500 rounded" /> Middle Band (SMA 20)
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                <div className="w-3 h-0.5 bg-cyan-500 rounded" style={{ borderTop: '2px dashed #06b6d4' }} /> Upper/Lower Band
              </div>
            </div>
          </TabsContent>

          {/* Volume & Price Chart */}
          <TabsContent value="volume">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="volume"
                    orientation="left"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatNumber(v)}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar
                    yAxisId="volume"
                    dataKey="volume"
                    fill="#6366f1"
                    opacity={0.25}
                    name="Volume"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: '#10b981' }}
                    name="Price"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" /> Price (Right Axis)
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400">
                <div className="w-3 h-1.5 bg-indigo-500/30 rounded-sm" /> Volume (Left Axis)
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}