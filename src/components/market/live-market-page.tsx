'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart,
  Bar,
  BarChart,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Volume2,
  DollarSign,
  Building2,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  X,
  Layers,
  Gauge,
  Percent,
  Target,
  History,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  formatNumber,
  formatPrice,
  formatPercent,
  getChangeColor,
  type OHLCV,
} from '@/lib/stock-utils';
import { SectionHeader, LoadingSpinner } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const chartVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

// ─── Chart Colors ────────────────────────────────────────────────────
const CHART_COLORS = {
  bull: '#10b981',
  bear: '#ef4444',
  bullFill: 'rgba(16, 185, 129, 0.15)',
  bearFill: 'rgba(239, 68, 68, 0.15)',
  grid: 'rgba(148, 163, 184, 0.06)',
  axisText: '#64748b',
  sma20: '#f59e0b',
  ema20: '#06b6d4',
  sma50: '#8b5cf6',
  macdLine: '#6366f1',
  signalLine: '#f59e0b',
  bbUpper: 'rgba(239, 68, 68, 0.5)',
  bbMiddle: 'rgba(148, 163, 184, 0.6)',
  bbLower: 'rgba(16, 185, 129, 0.5)',
  bbFill: 'rgba(99, 102, 241, 0.06)',
  rsiOB: 'rgba(239, 68, 68, 0.2)',
  rsiOS: 'rgba(16, 185, 129, 0.2)',
};

// ─── Custom Candlestick Shape ────────────────────────────────────────
function CandlestickBar(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload || isNaN(payload.body[0]) || isNaN(payload.body[1])) return null;

  const open = payload.open;
  const close = payload.close;
  const low = payload.low;
  const high = payload.high;
  const isBull = close >= open;
  const color = isBull ? CHART_COLORS.bull : CHART_COLORS.bear;

  const barWidth = Math.max(width * 0.6, 3);
  const cx = x + width / 2;
  const bodyTop = y;
  const bodyBottom = y + height;
  const bodyHeight = Math.max(height, 1);

  // Calculate y-axis scale from the chart dimensions
  const priceRange = high - low;
  const totalHeight = props.backgroundHeight || 300;
  const yScale = totalHeight / ((props.yAxisMax || high) - (props.yAxisMin || low));

  const highY = bodyTop - (high - Math.max(open, close)) * yScale;
  const lowY = bodyBottom + (Math.min(open, close) - low) * yScale;

  return (
    <g>
      {/* Wick */}
      <line
        x1={cx}
        y1={lowY}
        x2={cx}
        y2={highY}
        stroke={color}
        strokeWidth={1}
        opacity={0.7}
      />
      {/* Body */}
      <rect
        x={cx - barWidth / 2}
        y={bodyTop}
        width={barWidth}
        height={bodyHeight}
        fill={isBull ? color : color}
        opacity={isBull ? 0.9 : 0.9}
        stroke={color}
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  );
}

// ─── OHLCV Tooltip ───────────────────────────────────────────────────
function OHLCVTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const d = payload[0].payload;
  if (!d) return null;

  return (
    <div className="market-tooltip px-4 py-3 text-xs min-w-[180px]">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-slate-500">Open</span>
        <span className="text-white font-mono text-right">{formatPrice(d.open)}</span>
        <span className="text-slate-500">High</span>
        <span className="text-emerald-400 font-mono text-right">{formatPrice(d.high)}</span>
        <span className="text-slate-500">Low</span>
        <span className="text-red-400 font-mono text-right">{formatPrice(d.low)}</span>
        <span className="text-slate-500">Close</span>
        <span className={cn('font-mono text-right', d.close >= d.open ? 'text-emerald-400' : 'text-red-400')}>
          {formatPrice(d.close)}
        </span>
        <span className="text-slate-500">Volume</span>
        <span className="text-slate-300 font-mono text-right">{formatNumber(d.volume)}</span>
      </div>
    </div>
  );
}

// ─── Volume Tooltip ──────────────────────────────────────────────────
function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="market-tooltip px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-mono">{formatNumber(d.volume)}</p>
    </div>
  );
}

// ─── Simple Tooltip ──────────────────────────────────────────────────
function SimpleTooltip({ active, payload, label, lines }: { active?: boolean; payload?: any[]; label?: string; lines?: { key: string; color: string; label: string }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-4 py-3 text-xs min-w-[160px]">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {lines?.[i]?.label || entry.dataKey}
          </span>
          <span className="text-white font-mono">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── MACD Tooltip ────────────────────────────────────────────────────
function MACDTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const hist = payload.find((p: any) => p.dataKey === 'histogram');
  const macd = payload.find((p: any) => p.dataKey === 'macd');
  const sig = payload.find((p: any) => p.dataKey === 'signal');

  return (
    <div className="market-tooltip px-4 py-3 text-xs min-w-[180px]">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {macd && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS.macdLine }} />
            MACD
          </span>
          <span className="text-white font-mono">{macd.value?.toFixed(2)}</span>
        </div>
      )}
      {sig && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS.signalLine }} />
            Signal
          </span>
          <span className="text-white font-mono">{sig.value?.toFixed(2)}</span>
        </div>
      )}
      {hist && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: hist.value >= 0 ? CHART_COLORS.bull : CHART_COLORS.bear }} />
            Histogram
          </span>
          <span className={cn('font-mono', hist.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {hist.value?.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Common Axis Props ───────────────────────────────────────────────
const commonAxisProps = {
  tick: { fill: CHART_COLORS.axisText, fontSize: 10 },
  axisLine: { stroke: 'rgba(148, 163, 184, 0.1)' },
  tickLine: false,
};

const commonGridProps = {
  stroke: CHART_COLORS.grid,
  strokeDasharray: '3 3',
};

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export function LiveMarketPage() {
  const { selectedStock, setSelectedStock, searchHistory, addSearchHistory } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ma');
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Simulated loading ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => {
      clearTimeout(timer);
      setIsLoading(true);
    };
  }, [selectedStock.symbol]);

  // ─── Click outside to close dropdown ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Generate stock data ───────────────────────────────────────────
  const stockData = useMemo(() => generateStockData(selectedStock.symbol, 90), [selectedStock.symbol]);
  const closes = useMemo(() => stockData.map((d) => d.close), [stockData]);

  // ─── Candlestick data transform ────────────────────────────────────
  const candleData = useMemo(
    () =>
      stockData.map((d) => ({
        ...d,
        bullish: d.close >= d.open,
        body: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
        wick: [d.low, d.high],
      })),
    [stockData]
  );

  // ─── Volume data ───────────────────────────────────────────────────
  const volumeData = useMemo(
    () =>
      stockData.map((d) => ({
        date: d.date,
        volume: d.volume,
        bullish: d.close >= d.open,
      })),
    [stockData]
  );

  // ─── Moving Averages data ──────────────────────────────────────────
  const maData = useMemo(() => {
    const sma20 = calculateSMA(closes, 20);
    const ema20 = calculateEMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    return stockData.map((d, i) => ({
      date: d.date,
      price: d.close,
      sma20: sma20[i],
      ema20: ema20[i],
      sma50: sma50[i],
    }));
  }, [stockData, closes]);

  // ─── RSI data ──────────────────────────────────────────────────────
  const rsiData = useMemo(() => {
    const rsi = calculateRSI(closes, 14);
    return stockData.map((d, i) => ({
      date: d.date,
      rsi: rsi[i],
    }));
  }, [stockData, closes]);

  // ─── MACD data ─────────────────────────────────────────────────────
  const macdData = useMemo(() => {
    const { macd, signal, histogram } = calculateMACD(closes, 12, 26, 9);
    return stockData.map((d, i) => ({
      date: d.date,
      macd: macd[i],
      signal: signal[i - (macd.length - signal.length)] ?? NaN,
      histogram: histogram[i],
    }));
  }, [stockData, closes]);

  // ─── Bollinger Bands data ──────────────────────────────────────────
  const bbData = useMemo(() => {
    const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);
    return stockData.map((d, i) => ({
      date: d.date,
      price: d.close,
      upper: upper[i],
      middle: middle[i],
      lower: lower[i],
    }));
  }, [stockData, closes]);

  // ─── Sidebar sparkline data (last 30 days) ─────────────────────────
  const sparkData = useMemo(() => {
    const last30 = stockData.slice(-30);
    return last30.map((d) => ({ date: d.date, close: d.close }));
  }, [stockData]);

  // ─── Stock info ────────────────────────────────────────────────────
  const stockInfo = useMemo(() => STOCKS[selectedStock.symbol], [selectedStock.symbol]);

  // ─── Search filtering ──────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return Object.values(STOCKS).filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // ─── Handle stock selection ────────────────────────────────────────
  const handleSelectStock = useCallback(
    (symbol: string) => {
      const stock = STOCKS[symbol];
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
        addSearchHistory(symbol);
        setSearchQuery('');
        setShowDropdown(false);
      }
    },
    [setSelectedStock, addSearchHistory]
  );

  // ─── Handle recent search click ────────────────────────────────────
  const handleRecentClick = useCallback(
    (symbol: string) => {
      handleSelectStock(symbol);
    },
    [handleSelectStock]
  );

  // ─── Chart price range ─────────────────────────────────────────────
  const priceRange = useMemo(() => {
    if (!stockData.length) return { min: 0, max: 100 };
    const highs = stockData.map((d) => d.high);
    const lows = stockData.map((d) => d.low);
    return {
      min: Math.min(...lows) * 0.998,
      max: Math.max(...highs) * 1.002,
    };
  }, [stockData]);

  const volumeMax = useMemo(
    () => Math.max(...stockData.map((d) => d.volume)) * 1.1,
    [stockData]
  );

  // ─── Format date for X axis ────────────────────────────────────────
  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // ─── Loading state ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={48} label="Loading market data..." />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 md:p-6"
    >
      {/* ─── 1. Search Bar ─────────────────────────────────────────── */}
      <motion.div variants={itemVariants} ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search stocks by symbol, name, or sector..."
            className="pl-12 pr-4 py-4 h-14 text-base bg-slate-900/50 border-slate-700/50 rounded-xl
                       focus:border-indigo-500/50 focus:ring-indigo-500/20 placeholder:text-slate-500
                       glass-card hover:bg-slate-900/70 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        <AnimatePresence>
          {showDropdown && (searchResults.length > 0 || searchHistory.length > 0) && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 top-full mt-2 w-full glass-card p-2 shadow-2xl"
              style={{ maxHeight: '380px' }}
            >
              <ScrollArea className="max-h-[380px]">
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Search Results
                    </p>
                    {searchResults.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleSelectStock(stock.symbol)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{stock.symbol}</span>
                            <span className="text-xs text-slate-500 truncate">{stock.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-600">{stock.sector}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-white">{formatPrice(stock.price)}</div>
                          <span className={cn('text-xs font-mono', getChangeColor(stock.change))}>
                            {formatPercent(stock.changePercent)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent Searches (only when no search query) */}
                {searchResults.length === 0 && searchHistory.length > 0 && (
                  <div className="space-y-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Recent Searches
                    </p>
                    {searchHistory.slice(0, 8).map((symbol) => {
                      const stock = STOCKS[symbol];
                      if (!stock) return null;
                      return (
                        <button
                          key={symbol}
                          onClick={() => handleRecentClick(symbol)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                        >
                          <History className="w-3.5 h-3.5 text-slate-600" />
                          <span className="font-bold text-white text-sm">{stock.symbol}</span>
                          <span className="text-xs text-slate-500 truncate">{stock.name}</span>
                          <span className={cn('ml-auto text-xs font-mono', getChangeColor(stock.change))}>
                            {formatPrice(stock.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── 2. Stock Header ────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Left: Symbol + Name + Price */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                {selectedStock.symbol}
              </h1>
              <Badge
                variant="outline"
                className="border-slate-700 text-slate-400 text-xs font-normal"
              >
                {stockInfo?.sector}
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mb-4">{selectedStock.name}</p>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                ${formatPrice(selectedStock.price)}
              </span>
              <div className="flex items-center gap-2">
                {selectedStock.change >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                )}
                <span className={cn('text-lg font-semibold font-mono', getChangeColor(selectedStock.change))}>
                  {selectedStock.change >= 0 ? '+' : ''}{formatPrice(selectedStock.change)}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium px-2 py-0.5 rounded-md font-mono',
                    selectedStock.changePercent >= 0
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  )}
                >
                  {formatPercent(selectedStock.changePercent)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Stats Badges */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-700/30">
          <StatBadge icon={BarChart3} label="Volume" value={formatNumber(stockInfo?.volume ?? 0)} />
          <StatBadge icon={Building2} label="Mkt Cap" value={formatNumber(stockInfo?.marketCap ?? 0)} />
          <StatBadge icon={Target} label="P/E" value={(stockInfo?.pe ?? 0).toFixed(1)} />
          <StatBadge icon={DollarSign} label="EPS" value={formatPrice(stockInfo?.eps ?? 0)} />
          <StatBadge icon={TrendingUp} label="52W High" value={`$${formatPrice(stockInfo?.high52w ?? 0)}`} />
          <StatBadge icon={TrendingDown} label="52W Low" value={`$${formatPrice(stockInfo?.low52w ?? 0)}`} />
        </div>
      </motion.div>

      {/* ─── Main Content: Chart + Sidebar ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── Left: Chart Area ──────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* ─── 3. Candlestick Chart ────────────────────────────────── */}
          <div className="glass-card p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Candlestick Chart" subtitle={`${stockData.length} trading days`} />
              <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                <Activity className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>

            <motion.div variants={chartVariants}>
              {/* Candlestick Chart */}
              <div className="bg-slate-900/40 rounded-xl p-2" style={{ height: '380px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candleData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid {...commonGridProps} vertical={false} />
                    <XAxis
                      {...commonAxisProps}
                      dataKey="date"
                      tickFormatter={formatDate}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      {...commonAxisProps}
                      domain={[priceRange.min, priceRange.max]}
                      tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                      width={60}
                    />
                    <Tooltip content={<OHLCVTooltip />} />
                    <Bar
                      dataKey="body"
                      shape={<CandlestickBar backgroundHeight={380} yAxisMax={priceRange.max} yAxisMin={priceRange.min} />}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Chart */}
              <div className="bg-slate-900/40 rounded-xl p-2 mt-2" style={{ height: '120px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      {...commonAxisProps}
                      dataKey="date"
                      tickFormatter={formatDate}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      {...commonAxisProps}
                      domain={[0, volumeMax]}
                      tickFormatter={(v: number) => formatNumber(v)}
                      width={55}
                      hide
                    />
                    <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} />
                    <Bar dataKey="volume" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                      {volumeData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.bullish ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* ─── 4. Technical Indicators ─────────────────────────────── */}
          <motion.div variants={itemVariants} className="glass-card p-4 md:p-6">
            <SectionHeader title="Technical Indicators" subtitle="Advanced charting tools" />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-1 w-full sm:w-auto">
                <TabsTrigger
                  value="ma"
                  className="rounded-lg text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 px-3"
                >
                  Moving Averages
                </TabsTrigger>
                <TabsTrigger
                  value="rsi"
                  className="rounded-lg text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 px-3"
                >
                  RSI
                </TabsTrigger>
                <TabsTrigger
                  value="macd"
                  className="rounded-lg text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 px-3"
                >
                  MACD
                </TabsTrigger>
                <TabsTrigger
                  value="bb"
                  className="rounded-lg text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 px-3"
                >
                  Bollinger Bands
                </TabsTrigger>
              </TabsList>

              {/* ── Moving Averages Tab ─────────────────────────────── */}
              <TabsContent value="ma">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-900/40 rounded-xl p-3"
                  style={{ height: '320px' }}
                >
                  <div className="flex items-center gap-4 mb-2 px-2">
                    <LegendDot color={CHART_COLORS.sma20} label="SMA(20)" />
                    <LegendDot color={CHART_COLORS.ema20} label="EMA(20)" />
                    <LegendDot color={CHART_COLORS.sma50} label="SMA(50)" />
                  </div>
                  <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <LineChart data={maData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...commonGridProps} vertical={false} />
                      <XAxis
                        {...commonAxisProps}
                        dataKey="date"
                        tickFormatter={formatDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        {...commonAxisProps}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                        width={60}
                      />
                      <Tooltip content={<SimpleTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#e2e8f0"
                        strokeWidth={1.5}
                        dot={false}
                        name="Price"
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="sma20"
                        stroke={CHART_COLORS.sma20}
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 2"
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="ema20"
                        stroke={CHART_COLORS.ema20}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        stroke={CHART_COLORS.sma50}
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="6 3"
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              </TabsContent>

              {/* ── RSI Tab ──────────────────────────────────────────── */}
              <TabsContent value="rsi">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-900/40 rounded-xl p-3"
                  style={{ height: '320px' }}
                >
                  <div className="flex items-center gap-4 mb-2 px-2">
                    <LegendDot color="#8b5cf6" label="RSI(14)" />
                    <span className="text-[10px] text-red-400/70">Overbought: 70</span>
                    <span className="text-[10px] text-emerald-400/70">Oversold: 30</span>
                  </div>
                  <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <AreaChart data={rsiData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rsiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...commonGridProps} vertical={false} />
                      <XAxis
                        {...commonAxisProps}
                        dataKey="date"
                        tickFormatter={formatDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        {...commonAxisProps}
                        domain={[0, 100]}
                        width={35}
                      />
                      <Tooltip content={<SimpleTooltip />} />
                      {/* Overbought Zone */}
                      <ReferenceLine y={70} stroke={CHART_COLORS.bear} strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
                      <ReferenceArea y1={70} y2={100} fill={CHART_COLORS.rsiOB} />
                      {/* Oversold Zone */}
                      <ReferenceLine y={30} stroke={CHART_COLORS.bull} strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
                      <ReferenceArea y1={0} y2={30} fill={CHART_COLORS.rsiOS} />
                      {/* Middle line */}
                      <ReferenceLine y={50} stroke={CHART_COLORS.axisText} strokeDasharray="2 4" strokeWidth={0.5} opacity={0.3} />
                      <Area
                        type="monotone"
                        dataKey="rsi"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#rsiGradient)"
                        dot={false}
                        connectNulls
                        name="RSI"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              </TabsContent>

              {/* ── MACD Tab ─────────────────────────────────────────── */}
              <TabsContent value="macd">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-900/40 rounded-xl p-3"
                  style={{ height: '320px' }}
                >
                  <div className="flex items-center gap-4 mb-2 px-2">
                    <LegendDot color={CHART_COLORS.macdLine} label="MACD" />
                    <LegendDot color={CHART_COLORS.signalLine} label="Signal" />
                    <LegendDot color="#94a3b8" label="Histogram" />
                  </div>
                  <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <ComposedChart data={macdData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...commonGridProps} vertical={false} />
                      <XAxis
                        {...commonAxisProps}
                        dataKey="date"
                        tickFormatter={formatDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        {...commonAxisProps}
                        domain={['auto', 'auto']}
                        width={60}
                        tickFormatter={(v: number) => v.toFixed(2)}
                      />
                      <Tooltip content={<MACDTooltip />} />
                      <ReferenceLine y={0} stroke={CHART_COLORS.axisText} strokeDasharray="2 4" strokeWidth={0.5} opacity={0.3} />
                      {/* Histogram */}
                      <Bar dataKey="histogram" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                        {macdData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
                          />
                        ))}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="macd"
                        stroke={CHART_COLORS.macdLine}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="signal"
                        stroke={CHART_COLORS.signalLine}
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 2"
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </motion.div>
              </TabsContent>

              {/* ── Bollinger Bands Tab ──────────────────────────────── */}
              <TabsContent value="bb">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-900/40 rounded-xl p-3"
                  style={{ height: '320px' }}
                >
                  <div className="flex items-center gap-4 mb-2 px-2">
                    <LegendDot color={CHART_COLORS.bbUpper} label="Upper Band" />
                    <LegendDot color={CHART_COLORS.bbMiddle} label="SMA(20)" />
                    <LegendDot color={CHART_COLORS.bbLower} label="Lower Band" />
                  </div>
                  <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <AreaChart data={bbData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bbGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.08} />
                          <stop offset="50%" stopColor="#6366f1" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.08} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...commonGridProps} vertical={false} />
                      <XAxis
                        {...commonAxisProps}
                        dataKey="date"
                        tickFormatter={formatDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        {...commonAxisProps}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                        width={60}
                      />
                      <Tooltip content={<SimpleTooltip />} />
                      {/* Band fill area */}
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="none"
                        fill="url(#bbGradient)"
                        connectNulls
                        name="Upper"
                      />
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stroke="none"
                        fill="transparent"
                        connectNulls
                        name="Lower"
                      />
                      {/* Band lines */}
                      <Line
                        type="monotone"
                        dataKey="upper"
                        stroke={CHART_COLORS.bbUpper}
                        strokeWidth={1.2}
                        dot={false}
                        strokeDasharray="3 3"
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="middle"
                        stroke={CHART_COLORS.bbMiddle}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="lower"
                        stroke={CHART_COLORS.bbLower}
                        strokeWidth={1.2}
                        dot={false}
                        strokeDasharray="3 3"
                        connectNulls
                      />
                      {/* Price line */}
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#e2e8f0"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>

        {/* ─── 5. Market Overview Sidebar ────────────────────────────── */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Quick Stats Card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Quick Stats</h3>
            </div>

            <div className="space-y-3">
              <SidebarStat
                label="Today's Open"
                value={`$${formatPrice(candleData[candleData.length - 1]?.open ?? 0)}`}
              />
              <SidebarStat
                label="Day High"
                value={`$${formatPrice(candleData[candleData.length - 1]?.high ?? 0)}`}
                color="text-emerald-400"
              />
              <SidebarStat
                label="Day Low"
                value={`$${formatPrice(candleData[candleData.length - 1]?.low ?? 0)}`}
                color="text-red-400"
              />
              <SidebarStat
                label="Prev Close"
                value={`$${formatPrice(candleData[candleData.length - 2]?.close ?? 0)}`}
              />
              <div className="border-t border-slate-700/30 pt-3 mt-3">
                <SidebarStat
                  label="Avg Volume"
                  value={formatNumber(stockInfo?.avgVolume ?? 0)}
                />
                <SidebarStat
                  label="Dividend"
                  value={stockInfo?.dividend ? `$${stockInfo.dividend.toFixed(2)}` : 'N/A'}
                />
              </div>
            </div>
          </div>

          {/* Sparkline Card */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">30-Day Trend</h3>
              </div>
              <span
                className={cn(
                  'text-xs font-mono px-2 py-0.5 rounded-md',
                  selectedStock.changePercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}
              >
                {formatPercent(selectedStock.changePercent)}
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-slate-900/40 rounded-xl p-2"
              style={{ height: '120px' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={selectedStock.changePercent >= 0 ? CHART_COLORS.bull : CHART_COLORS.bear}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor={selectedStock.changePercent >= 0 ? CHART_COLORS.bull : CHART_COLORS.bear}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['dataMin * 0.998', 'dataMax * 1.002']} />
                  <Tooltip content={<SimpleTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={selectedStock.changePercent >= 0 ? CHART_COLORS.bull : CHART_COLORS.bear}
                    strokeWidth={2}
                    fill="url(#sparkGradient)"
                    dot={false}
                    name="Price"
                    style={{
                      filter: `drop-shadow(0 0 4px ${
                        selectedStock.changePercent >= 0
                          ? 'rgba(16, 185, 129, 0.4)'
                          : 'rgba(239, 68, 68, 0.4)'
                      })`,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Day Range Card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">52-Week Range</h3>
            </div>

            {stockInfo && (
              <div className="space-y-3">
                <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #ef4444, #f59e0b, #10b981)',
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((stockInfo.price - stockInfo.low52w) / (stockInfo.high52w - stockInfo.low52w)) * 100}%`,
                    }}
                    transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-indigo-500"
                    initial={{ left: 0 }}
                    animate={{
                      left: `${((stockInfo.price - stockInfo.low52w) / (stockInfo.high52w - stockInfo.low52w)) * 100}%`,
                    }}
                    transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.6))',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-400 font-mono">${formatPrice(stockInfo.low52w)}</span>
                  <span className="text-white font-mono font-semibold">${formatPrice(stockInfo.price)}</span>
                  <span className="text-emerald-400 font-mono">${formatPrice(stockInfo.high52w)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Market Sector Card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Sector Info</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sector</span>
                <span className="text-xs text-slate-300">{stockInfo?.sector}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Exchange</span>
                <span className="text-xs text-slate-300">
                  {['INFY', 'TCS', 'RELIANCE'].includes(selectedStock.symbol) ? 'NSE' : 'NASDAQ'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Avg Vol</span>
                <span className="text-xs text-slate-300 font-mono">{formatNumber(stockInfo?.avgVolume ?? 0)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Stat Badge ──────────────────────────────────────────────────────
function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-slate-700/20">
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-xs text-white font-mono font-medium">{value}</span>
    </div>
  );
}

// ─── Sidebar Stat Row ────────────────────────────────────────────────
function SidebarStat({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('text-xs font-mono font-medium', color)}>{value}</span>
    </div>
  );
}

// ─── Legend Dot ──────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-0.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}