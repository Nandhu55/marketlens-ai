'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  formatNumber,
  formatPrice,
  formatPercent,
  getChangeColor,
  type OHLCV,
  type StockInfo,
} from '@/lib/stock-utils';
import { SectionHeader, LoadingSpinner, EmptyState } from '@/components/shared/animated-counter';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────
interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  hasRealPrice: boolean;
}

interface StockResponse {
  stock?: StockInfo;
  realQuote?: {
    price: number;
    change: number;
    changePercent: number;
    source: string;
    fetchedAt: string;
    dayHigh: number;
    dayLow: number;
    openPrice: number;
  };
  ohlcv?: OHLCV[];
  hasOHLCV?: boolean;
  indicators?: Record<string, number>;
  series?: Record<string, number[]>;
  error?: string;
  message?: string;
}

// ─── Animation Variants ──────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
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

// ─── Timeframe config ────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: '180D', days: 180 },
] as const;

// ─── Main LiveMarketPage ────────────────────────────────────────────
export function LiveMarketPage() {
  const { selectedStock, setSelectedStock } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('price');
  const [activeTimeframe, setActiveTimeframe] = useState(90);
  const [stockData, setStockData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stock data
  const fetchStockData = useCallback(async (symbol: string, days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${symbol}&days=${days}`);
      const data: StockResponse = await res.json();
      setStockData(data);
    } catch {
      setStockData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStockData(selectedStock.symbol, activeTimeframe);
  }, [selectedStock.symbol, activeTimeframe, fetchStockData]);

  // Search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Close search on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectStock = (result: SearchResult) => {
    setSelectedStock({
      symbol: result.symbol,
      name: result.name,
      price: result.price || 0,
      change: result.change || 0,
      changePercent: result.changePercent || 0,
      volume: 0,
      marketCap: 0,
    });
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Prepare chart data
  const ohlcv = stockData?.ohlcv || [];
  const hasOHLCV = stockData?.hasOHLCV && ohlcv.length > 0;

  const priceData = ohlcv.map((d) => ({
    date: d.date.slice(5),
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  }));

  // Volume chart data
  const volumeData = ohlcv.map((d) => ({
    date: d.date.slice(5),
    volume: d.volume,
    close: d.close,
    prevClose: d.open,
  }));

  // Indicator chart data from API series
  const series = stockData?.series || null;
  const indicatorData = series
    ? ohlcv.map((d, i) => {
        const point: Record<string, string | number> = { date: d.date.slice(5), close: d.close };
        if (series.sma20?.[i] !== undefined && !isNaN(series.sma20[i])) point.sma20 = series.sma20[i];
        if (series.sma50?.[i] !== undefined && !isNaN(series.sma50[i])) point.sma50 = series.sma50[i];
        if (series.ema12?.[i] !== undefined && !isNaN(series.ema12[i])) point.ema12 = series.ema12[i];
        if (series.rsi?.[i] !== undefined && !isNaN(series.rsi[i])) point.rsi = series.rsi[i];
        if (series.bbUpper?.[i] !== undefined && !isNaN(series.bbUpper[i])) point.bbUpper = series.bbUpper[i];
        if (series.bbMiddle?.[i] !== undefined && !isNaN(series.bbMiddle[i])) point.bbMiddle = series.bbMiddle[i];
        if (series.bbLower?.[i] !== undefined && !isNaN(series.bbLower[i])) point.bbLower = series.bbLower[i];
        // MACD series may be shorter — align from end
        const macdLen = series.macd?.length || 0;
        const macdIdx = i - (ohlcv.length - macdLen);
        if (macdIdx >= 0 && series.macd?.[macdIdx] !== undefined && !isNaN(series.macd[macdIdx])) {
          point.macd = series.macd[macdIdx];
        }
        const sigLen = series.macdSignal?.length || 0;
        const sigIdx = i - (ohlcv.length - sigLen);
        if (sigIdx >= 0 && series.macdSignal?.[sigIdx] !== undefined && !isNaN(series.macdSignal[sigIdx])) {
          point.macdSignal = series.macdSignal[sigIdx];
        }
        const histLen = series.macdHistogram?.length || 0;
        const histIdx = i - (ohlcv.length - histLen);
        if (histIdx >= 0 && series.macdHistogram?.[histIdx] !== undefined && !isNaN(series.macdHistogram[histIdx])) {
          point.macdHistogram = series.macdHistogram[histIdx];
        }
        return point;
      })
    : [];

  const indicators = stockData?.indicators || null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Search Bar ────────────────────────────────────────── */}
      <motion.div variants={itemVariants} ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search stocks by name or symbol..."
            className="glass-card pl-11 pr-10 py-3 h-12 text-sm bg-transparent border-white/10 focus:border-indigo-500/50 rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Dropdown */}
        <AnimatePresence>
          {showSearch && searchQuery.length >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 glass-card p-2 z-50 max-h-72 overflow-y-auto"
            >
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <LoadingSpinner size={24} label="Searching..." />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">No results found</div>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => handleSelectStock(r)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{r.symbol}</span>
                        <Badge variant="outline" className="text-[9px] border-white/10 text-slate-400 px-1.5 py-0">
                          {r.exchange}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{r.name}</p>
                    </div>
                    <div className="text-right">
                      {r.hasRealPrice ? (
                        <>
                          <p className="text-sm font-semibold text-white">${formatPrice(r.price)}</p>
                          <p className={cn('text-xs font-medium', getChangeColor(r.changePercent))}>
                            {formatPercent(r.changePercent)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">No price</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chart Area */}
        <motion.div variants={itemVariants} className="lg:col-span-3 space-y-4">
          {/* Header with timeframe selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{selectedStock.symbol}</h2>
                {stockData?.stock?.name && (
                  <span className="text-sm text-slate-400">{stockData.stock.name}</span>
                )}
                {stockData?.realQuote && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border-0">
                    LIVE
                  </Badge>
                )}
              </div>
              {stockData?.stock && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-bold text-white">${formatPrice(stockData.stock.price)}</span>
                  <span className={cn('text-sm font-semibold flex items-center gap-1', getChangeColor(stockData.stock.changePercent))}>
                    {stockData.stock.changePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {formatPrice(stockData.stock.change)} ({formatPercent(stockData.stock.changePercent)})
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-white/5 rounded-xl p-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.days}
                    onClick={() => setActiveTimeframe(tf.days)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      activeTimeframe === tf.days
                        ? 'gradient-button text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Indicator Tabs + Chart */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white/5 rounded-xl p-1 h-9">
              <TabsTrigger value="price" className="text-xs data-[state=active]:gradient-button rounded-lg h-7">Price</TabsTrigger>
              <TabsTrigger value="sma" className="text-xs data-[state=active]:gradient-button rounded-lg h-7">SMA/EMA</TabsTrigger>
              <TabsTrigger value="rsi" className="text-xs data-[state=active]:gradient-button rounded-lg h-7">RSI</TabsTrigger>
              <TabsTrigger value="macd" className="text-xs data-[state=active]:gradient-button rounded-lg h-7">MACD</TabsTrigger>
              <TabsTrigger value="bb" className="text-xs data-[state=active]:gradient-button rounded-lg h-7">Bollinger</TabsTrigger>
            </TabsList>

            <TabsContent value="price" className="mt-4">
              {loading ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  <LoadingSpinner label="Loading price data..." />
                </div>
              ) : !hasOHLCV ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  <EmptyState
                    icon={<Activity className="w-8 h-8" />}
                    title="No Live Data Available"
                    description={`No OHLCV data for ${selectedStock.symbol}. Try a different stock or refresh.`}
                    action={
                      <Button variant="outline" size="sm" onClick={() => fetchStockData(selectedStock.symbol, activeTimeframe)} className="gradient-button border-0">
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Retry
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="glass-card p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={priceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                        <Line type="monotone" dataKey="high" stroke="#10b981" strokeWidth={0.5} dot={false} strokeDasharray="2 2" />
                        <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={0.5} dot={false} strokeDasharray="2 2" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Volume bars */}
                  <div className="glass-card p-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Volume</span>
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={volumeData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
                        <YAxis axisLine={false} tickLine={false} tick={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                          {volumeData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.close >= entry.prevClose ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="sma" className="mt-4">
              {loading || !hasOHLCV || !series ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  {!hasOHLCV ? (
                    <EmptyState icon={<Layers className="w-8 h-8" />} title="No Live Data Available" description="No OHLCV data to compute indicators" />
                  ) : (
                    <LoadingSpinner label="Loading indicators..." />
                  )}
                </div>
              ) : (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-400" /><span className="text-[10px] text-slate-400">SMA 20</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-cyan-400" /><span className="text-[10px] text-slate-400">SMA 50</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-400" /><span className="text-[10px] text-slate-400">EMA 12</span></div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={indicatorData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="close" stroke="#ffffff" strokeWidth={1.5} dot={false} opacity={0.5} />
                      <Line type="monotone" dataKey="sma20" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="sma50" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="ema12" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rsi" className="mt-4">
              {loading || !hasOHLCV || !series ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  {!hasOHLCV ? (
                    <EmptyState icon={<Gauge className="w-8 h-8" />} title="No Live Data Available" description="No OHLCV data to compute RSI" />
                  ) : (
                    <LoadingSpinner label="Loading RSI..." />
                  )}
                </div>
              ) : (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-violet-400" /><span className="text-[10px] text-slate-400">RSI (14)</span></div>
                    </div>
                    {indicators?.rsi !== undefined && !isNaN(indicators.rsi) && (
                      <Badge variant="outline" className={cn('text-xs border-0', indicators.rsi > 70 ? 'bg-red-500/15 text-red-400' : indicators.rsi < 30 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
                        {indicators.rsi.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={indicatorData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceArea y1={30} y2={70} fill="rgba(148,163,184,0.03)" />
                      <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

            <TabsContent value="macd" className="mt-4">
              {loading || !hasOHLCV || !series ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  {!hasOHLCV ? (
                    <EmptyState icon={<Activity className="w-8 h-8" />} title="No Live Data Available" description="No OHLCV data to compute MACD" />
                  ) : (
                    <LoadingSpinner label="Loading MACD..." />
                  )}
                </div>
              ) : (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-400" /><span className="text-[10px] text-slate-400">MACD</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-orange-400" /><span className="text-[10px] text-slate-400">Signal</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-400/40 rounded-sm" /><span className="text-[10px] text-slate-400">Histogram</span></div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={indicatorData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                      <Bar dataKey="macdHistogram" radius={[2, 2, 0, 0]}>
                        {indicatorData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={typeof entry.macdHistogram === 'number' && entry.macdHistogram >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}
                          />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="macd" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="macdSignal" stroke="#fb923c" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bb" className="mt-4">
              {loading || !hasOHLCV || !series ? (
                <div className="glass-card p-4 h-96 flex items-center justify-center">
                  {!hasOHLCV ? (
                    <EmptyState icon={<Layers className="w-8 h-8" />} title="No Live Data Available" description="No OHLCV data to compute Bollinger Bands" />
                  ) : (
                    <LoadingSpinner label="Loading Bollinger Bands..." />
                  )}
                </div>
              ) : (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-400" /><span className="text-[10px] text-slate-400">Upper</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-cyan-400" /><span className="text-[10px] text-slate-400">Middle (SMA 20)</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-400" /><span className="text-[10px] text-slate-400">Lower</span></div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={indicatorData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="bbUpper" stroke="#818cf8" strokeWidth={1} fill="rgba(99,102,241,0.05)" dot={false} connectNulls />
                      <Line type="monotone" dataKey="bbMiddle" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />
                      <Area type="monotone" dataKey="bbLower" stroke="#818cf8" strokeWidth={1} fill="rgba(99,102,241,0.05)" dot={false} connectNulls />
                      <Line type="monotone" dataKey="close" stroke="#ffffff" strokeWidth={1.5} dot={false} opacity={0.8} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Stock Info Card */}
          <div className="glass-card p-5">
            <SectionHeader title="Stock Info" subtitle={selectedStock.symbol} />
            {loading ? (
              <div className="space-y-3 mt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full bg-white/5" />
                ))}
              </div>
            ) : stockData?.error ? (
              <EmptyState
                icon={<Activity className="w-6 h-6" />}
                title="No Live Data"
                description={stockData.message || 'Could not fetch stock data'}
                action={
                  <Button variant="outline" size="sm" onClick={() => fetchStockData(selectedStock.symbol, activeTimeframe)} className="gradient-button border-0 mt-2">
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Retry
                  </Button>
                }
              />
            ) : stockData?.stock ? (
              <ScrollArea className="max-h-96">
                <div className="space-y-3 mt-2">
                  {[
                    { label: 'Name', value: stockData.stock.name, icon: Building2 },
                    { label: 'Price', value: `$${formatPrice(stockData.stock.price)}`, icon: DollarSign },
                    { label: 'Change', value: `${formatPrice(stockData.stock.change)} (${formatPercent(stockData.stock.changePercent)})`, icon: stockData.stock.changePercent >= 0 ? ArrowUpRight : ArrowDownRight, color: getChangeColor(stockData.stock.changePercent) },
                    { label: 'Volume', value: formatNumber(stockData.stock.volume), icon: BarChart3 },
                    { label: 'Market Cap', value: stockData.stock.marketCap > 0 ? formatNumber(stockData.stock.marketCap) : 'N/A', icon: Building2 },
                    { label: 'Day Range', value: stockData.stock.dayRange || 'N/A', icon: Target },
                    { label: '52W High', value: stockData.stock.high52w > 0 ? `$${formatPrice(stockData.stock.high52w)}` : 'N/A', icon: TrendingUp },
                    { label: '52W Low', value: stockData.stock.low52w > 0 ? `$${formatPrice(stockData.stock.low52w)}` : 'N/A', icon: TrendingDown },
                    { label: 'P/E Ratio', value: stockData.stock.pe > 0 ? stockData.stock.pe.toFixed(2) : 'N/A', icon: Percent },
                    { label: 'Sector', value: stockData.stock.sector || 'N/A', icon: Layers },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 text-slate-400">
                        <item.icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <span className={cn('text-xs font-medium text-white', item.color)}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}
          </div>

          {/* Key Indicators Quick View */}
          {indicators && !stockData?.error && (
            <div className="glass-card p-5">
              <SectionHeader title="Key Indicators" subtitle="Latest values" />
              <div className="space-y-3 mt-2">
                {[
                  { label: 'RSI (14)', value: indicators.rsi, format: (v: number) => v.toFixed(1), signal: indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral' },
                  { label: 'MACD', value: indicators.macd, format: (v: number) => v.toFixed(3), signal: (indicators.macdSignal !== undefined && indicators.macd > indicators.macdSignal) ? 'Bullish' : 'Bearish' },
                  { label: 'SMA 20', value: indicators.sma20, format: (v: number) => `$${v.toFixed(2)}` },
                  { label: 'ATR (14)', value: indicators.atr, format: (v: number) => v.toFixed(3) },
                ].map((ind) => {
                  if (ind.value === undefined || isNaN(ind.value)) return null;
                  return (
                    <div key={ind.label} className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-slate-400">{ind.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{ind.format(ind.value)}</span>
                        {ind.signal && (
                          <Badge variant="outline" className={cn(
                            'text-[9px] border-0 px-1.5 py-0',
                            ind.signal === 'Bullish' || ind.signal === 'Oversold' ? 'bg-emerald-500/15 text-emerald-400' :
                            ind.signal === 'Bearish' || ind.signal === 'Overbought' ? 'bg-red-500/15 text-red-400' :
                            'bg-amber-500/15 text-amber-400'
                          )}>
                            {ind.signal}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data Source Info */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{stockData?.realQuote ? `Updated: ${new Date(stockData.realQuote.fetchedAt).toLocaleTimeString()}` : 'No recent data'}</span>
            </div>
            {stockData?.realQuote?.source && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <History className="w-3.5 h-3.5" />
                <span>Source: {stockData.realQuote.source}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}