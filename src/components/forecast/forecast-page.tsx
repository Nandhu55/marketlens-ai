'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Shield,
  Clock,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  KNOWN_SYMBOLS,
  formatPrice,
  formatPercent,
  getChangeColor,
} from '@/lib/stock-utils';
import { SectionHeader, LoadingSpinner, EmptyState } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────────
type Timeframe = 'tomorrow' | '3days' | '7days' | '30days';

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  confidence: number;
}

interface ForecastSummary {
  predictedPrice: number;
  expectedChange: number;
  volatility: number;
  confidence: number;
  analysis?: string;
}

interface ForecastResponse {
  symbol: string;
  stockName: string;
  currentPrice: number;
  timeframe: string;
  dataSource: string;
  historical: { date: string; price: number }[];
  forecast: ForecastPoint[];
  summary: ForecastSummary;
  error?: string;
  message?: string;
}

// ─── Animation variants ─────────────────────────────────────────────────────
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

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-3 py-2 text-xs space-y-1">
      <p className="text-slate-300 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.dataKey === 'price'
            ? 'Price'
            : p.dataKey === 'predicted'
            ? 'Predicted'
            : p.dataKey === 'lower'
            ? 'Lower'
            : p.dataKey === 'upper'
            ? 'Upper'
            : p.dataKey}: ${p.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────
export function ForecastPage() {
  const { selectedStock } = useAppStore();
  const [stockSymbol, setStockSymbol] = useState(selectedStock.symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>('7days');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?symbol=${stockSymbol}&timeframe=${timeframe}`);
      const json: ForecastResponse = await res.json();
      setData(json);
      if (json.dataSource === 'none' || json.error) {
        setError(json.error || 'No Live Data Available');
      }
    } catch {
      setError('No Live Data Available');
    } finally {
      setLoading(false);
    }
  }, [stockSymbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stock = KNOWN_SYMBOLS.find((s) => s.symbol === stockSymbol) || KNOWN_SYMBOLS[0];
  const historical = data?.historical || [];
  const forecast = data?.forecast || [];
  const summary = data?.summary;
  const isReal = data?.dataSource === 'real';

  // Merge chart data
  const chartData = useMemo(() => {
    if (historical.length === 0 && forecast.length === 0) return [];
    const hist = historical.map((h) => ({ date: h.date, price: h.price }));
    const lastHist = historical.length > 0 ? historical[historical.length - 1] : null;
    const bridgePoint = lastHist
      ? { date: lastHist.date, price: lastHist.price, predicted: lastHist.price, lower: lastHist.price, upper: lastHist.price }
      : null;
    const fc = forecast.map((f) => ({
      date: f.date,
      predicted: f.predicted,
      lower: f.lower,
      upper: f.upper,
    }));
    if (bridgePoint) return [...hist, bridgePoint, ...fc];
    return [...hist, ...fc];
  }, [historical, forecast]);

  const summaryCards = summary
    ? [
        {
          title: 'Predicted Price',
          value: `$${formatPrice(summary.predictedPrice)}`,
          icon: Target,
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/10',
          glow: 'glow-cyan',
        },
        {
          title: 'Expected Change',
          value: formatPercent(summary.expectedChange),
          icon: summary.expectedChange >= 0 ? ArrowUpRight : ArrowDownRight,
          color: getChangeColor(summary.expectedChange),
          bg: summary.expectedChange >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
          glow: summary.expectedChange >= 0 ? 'glow-green' : 'glow-red',
        },
        {
          title: 'Upper Bound',
          value: `$${formatPrice(forecast.length > 0 ? forecast[forecast.length - 1].upper : 0)}`,
          icon: ArrowUpRight,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          glow: 'glow-green',
        },
        {
          title: 'Lower Bound',
          value: `$${formatPrice(forecast.length > 0 ? forecast[forecast.length - 1].lower : 0)}`,
          icon: ArrowDownRight,
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          glow: 'glow-red',
        },
        {
          title: 'Volatility Forecast',
          value: `${summary.volatility.toFixed(2)}%`,
          icon: Activity,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10',
          glow: 'glow-purple',
        },
        {
          title: 'Confidence',
          value: `${summary.confidence.toFixed(1)}%`,
          icon: Shield,
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/10',
          glow: 'glow-cyan',
        },
      ]
    : [];

  // ─── Loading State ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Price Forecast"
          subtitle={`Loading forecast for ${stock.name}...`}
          action={<Skeleton className="h-9 w-[160px] bg-white/5" />}
        />
        <Card className="glass-card">
          <CardContent className="p-6">
            <Skeleton className="h-5 w-48 bg-white/5 mb-4" />
            <Skeleton className="h-[350px] w-full bg-white/5" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-4">
              <Skeleton className="h-4 w-20 bg-white/5 mb-2" />
              <Skeleton className="h-6 w-28 bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error / No Data State ─────────────────────────────────────────────
  if (error || !data || data.dataSource === 'none' || !summary) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Price Forecast"
          subtitle={`AI-powered price prediction for ${stock.name} (${stockSymbol})`}
          action={
            <Select value={stockSymbol} onValueChange={setStockSymbol}>
              <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_SYMBOLS.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol}>
                    {s.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <EmptyState
          icon={<TrendingUp className="w-12 h-12" />}
          title="No Live Data Available"
          description={error || `Could not generate a forecast for ${stockSymbol}. The service may be temporarily unavailable.`}
          action={
            <Button onClick={fetchData} variant="outline" className="gap-2 border-white/10 hover:bg-white/5 text-slate-300">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // ─── Loaded State ──────────────────────────────────────────────────────
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Price Forecast"
        subtitle={
          isReal
            ? `${data.stockName || stock.name} (${stockSymbol}) — Current: $${formatPrice(data.currentPrice)}`
            : `AI-powered price prediction for ${stock.name} (${stockSymbol})`
        }
        badge={isReal ? { label: 'AI POWERED', color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' } : undefined}
        action={
          <Select value={stockSymbol} onValueChange={setStockSymbol}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_SYMBOLS.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* ── Forecast Chart ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Price Forecast
                {isReal && (
                  <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 ml-2" variant="outline">
                    <Sparkles className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                <TabsList className="bg-white/5 h-9">
                  <TabsTrigger value="tomorrow" className="text-xs px-3 h-7 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                    Tomorrow
                  </TabsTrigger>
                  <TabsTrigger value="3days" className="text-xs px-3 h-7 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                    3 Days
                  </TabsTrigger>
                  <TabsTrigger value="7days" className="text-xs px-3 h-7 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                    7 Days
                  </TabsTrigger>
                  <TabsTrigger value="30days" className="text-xs px-3 h-7 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                    30 Days
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastConfidenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    width={60}
                  />
                  <Tooltip content={<ForecastTooltip />} />
                  {/* Confidence interval area */}
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    fill="url(#forecastConfidenceGrad)"
                    fillOpacity={1}
                    name="upper"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="none"
                    fill="rgba(15,23,42,1)"
                    fillOpacity={1}
                    name="lower"
                    isAnimationActive={false}
                  />
                  {/* Historical line (solid) */}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={false}
                    name="price"
                    connectNulls={false}
                  />
                  {/* Forecast line (dashed) */}
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    strokeDasharray="8 4"
                    dot={false}
                    name="predicted"
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-0.5 bg-indigo-500 rounded" />
                <span className="text-slate-400">Historical</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-0.5 bg-cyan-500 rounded" style={{ borderTop: '2px dashed #06b6d4' }} />
                <span className="text-slate-400">Forecast</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-3 bg-purple-500/20 rounded" />
                <span className="text-slate-400">Confidence Interval</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className={`glass-card p-4 ${card.glow}`}
          >
            <div className={`p-2 rounded-lg ${card.bg} w-fit mb-2`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
              {card.title}
            </p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Analysis (if available) ─────────────────────────────────────── */}
      {summary.analysis && (
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Zap className="w-5 h-5 text-purple-400" />
                Forecast Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{summary.analysis}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Detailed Forecast Table ─────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Clock className="w-5 h-5 text-purple-400" />
              Detailed Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecast.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No forecast data available for this timeframe.</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-slate-400 font-medium text-xs">Date</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right">Predicted</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right">Change %</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right">Lower Bound</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right">Upper Bound</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecast.map((row, i) => {
                      const prev = i === 0 ? data.currentPrice : forecast[i - 1].predicted;
                      const change = prev > 0 ? ((row.predicted - prev) / prev) * 100 : 0;
                      return (
                        <TableRow key={row.date} className="border-white/5 hover:bg-white/[0.03]">
                          <TableCell className="text-sm text-slate-300 font-mono">
                            {row.date}
                          </TableCell>
                          <TableCell className="text-sm text-white font-semibold text-right">
                            ${formatPrice(row.predicted)}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            <span className={getChangeColor(change)}>
                              {formatPercent(change)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-red-400 text-right">
                            ${formatPrice(row.lower)}
                          </TableCell>
                          <TableCell className="text-sm text-emerald-400 text-right">
                            ${formatPrice(row.upper)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                row.confidence >= 80
                                  ? 'border-emerald-500/30 text-emerald-400'
                                  : row.confidence >= 65
                                  ? 'border-yellow-500/30 text-yellow-400'
                                  : 'border-red-500/30 text-red-400'
                              }`}
                            >
                              {row.confidence.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}