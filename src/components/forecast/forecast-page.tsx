'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
  formatPrice,
  formatPercent,
  getChangeColor,
} from '@/lib/stock-utils';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// ─── Types ────────────────────────────────────────────────────────────────────
type Timeframe = 'tomorrow' | '3days' | '7days' | '30days';

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  confidence: number;
}

// ─── Deterministic forecast generator ─────────────────────────────────────────
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateForecast(symbol: string, timeframe: Timeframe): {
  historical: { date: string; price: number }[];
  forecast: ForecastPoint[];
  summary: {
    predictedPrice: number;
    expectedChange: number;
    upperBound: number;
    lowerBound: number;
    volatility: number;
    confidence: number;
  };
} {
  const stock = STOCKS[symbol] || STOCKS.AAPL;
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // Historical data (last 30 trading days)
  const rawData = generateStockData(symbol, 45);
  const historical = rawData.slice(-30).map((d) => ({
    date: d.date,
    price: d.close,
  }));

  const lastPrice = historical[historical.length - 1].price;
  const lastDate = new Date(historical[historical.length - 1].date);

  // Determine number of forecast days
  const daysMap: Record<Timeframe, number> = {
    tomorrow: 1,
    '3days': 3,
    '7days': 7,
    '30days': 30,
  };
  const numDays = daysMap[timeframe];

  // Generate forecast with widening confidence interval
  const volatility = stock.pe > 50 ? 0.025 : 0.015;
  const trend = seededRandom(hash + 42) > 0.4 ? 1 : -1;
  const trendStrength = (seededRandom(hash + 77) * 0.01 + 0.002) * trend;

  const forecast: ForecastPoint[] = [];
  let prevPrice = lastPrice;

  for (let i = 1; i <= numDays; i++) {
    const fDate = new Date(lastDate);
    fDate.setDate(fDate.getDate() + i);
    // Skip weekends
    if (fDate.getDay() === 0) fDate.setDate(fDate.getDate() + 1);
    if (fDate.getDay() === 6) fDate.setDate(fDate.getDate() + 2);

    const dayVol = volatility * (0.5 + seededRandom(hash + i * 31) * 0.5);
    const predicted = prevPrice * (1 + trendStrength + dayVol * (seededRandom(hash + i * 47) * 2 - 1));

    // Confidence interval widens over time
    const dayMultiplier = 1 + (i * 0.15);
    const lower = predicted * (1 - dayVol * dayMultiplier);
    const upper = predicted * (1 + dayVol * dayMultiplier);
    const confidence = Math.max(55, 95 - (i * (timeframe === '30days' ? 1.2 : 4)));

    forecast.push({
      date: fDate.toISOString().split('T')[0],
      predicted: parseFloat(predicted.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
      upper: parseFloat(upper.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(1)),
    });

    prevPrice = predicted;
  }

  const finalForecast = forecast[forecast.length - 1];
  const expectedChange = ((finalForecast.predicted - lastPrice) / lastPrice) * 100;

  return {
    historical,
    forecast,
    summary: {
      predictedPrice: finalForecast.predicted,
      expectedChange: parseFloat(expectedChange.toFixed(2)),
      upperBound: finalForecast.upper,
      lowerBound: finalForecast.lower,
      volatility: parseFloat((volatility * 100).toFixed(2)),
      confidence: finalForecast.confidence,
    },
  };
}

// ─── Animation variants ───────────────────────────────────────────────────────
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────
export function ForecastPage() {
  const { selectedStock } = useAppStore();
  const [stockSymbol, setStockSymbol] = useState(selectedStock.symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>('7days');

  const { historical, forecast, summary } = useMemo(
    () => generateForecast(stockSymbol, timeframe),
    [stockSymbol, timeframe]
  );

  const stock = STOCKS[stockSymbol] || STOCKS.AAPL;

  // Merge for chart
  const chartData = useMemo(() => {
    const hist = historical.map((h) => ({ date: h.date, price: h.price }));
    const lastHist = historical[historical.length - 1];
    const fc = forecast.map((f) => ({
      date: f.date,
      predicted: f.predicted,
      lower: f.lower,
      upper: f.upper,
    }));
    // Bridge point
    return [
      ...hist,
      { date: lastHist.date, price: lastHist.price, predicted: lastHist.price, lower: lastHist.price, upper: lastHist.price },
      ...fc,
    ];
  }, [historical, forecast]);

  const summaryCards = useMemo(
    () => [
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
        value: `$${formatPrice(summary.upperBound)}`,
        icon: ArrowUpRight,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        glow: 'glow-green',
      },
      {
        title: 'Lower Bound',
        value: `$${formatPrice(summary.lowerBound)}`,
        icon: ArrowDownRight,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        glow: 'glow-red',
      },
      {
        title: 'Volatility Forecast',
        value: `${summary.volatility}%`,
        icon: Activity,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        glow: 'glow-purple',
      },
      {
        title: 'Confidence',
        value: `${summary.confidence}%`,
        icon: Shield,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        glow: 'glow-blue',
      },
    ],
    [summary]
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Price Forecast"
        subtitle={`AI-powered price prediction for ${stock.name} (${stockSymbol})`}
        action={
          <Select value={stockSymbol} onValueChange={setStockSymbol}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(STOCKS).map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* ── Forecast Chart ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Price Forecast
              </CardTitle>
              <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                <TabsList className="bg-white/5 h-9">
                  <TabsTrigger value="tomorrow" className="text-xs px-3 h-7 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
                    Tomorrow
                  </TabsTrigger>
                  <TabsTrigger value="3days" className="text-xs px-3 h-7 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
                    3 Days
                  </TabsTrigger>
                  <TabsTrigger value="7days" className="text-xs px-3 h-7 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
                    7 Days
                  </TabsTrigger>
                  <TabsTrigger value="30days" className="text-xs px-3 h-7 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
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
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#confidenceGradient)"
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
                  {/* Historical line */}
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

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
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

      {/* ── Detailed Forecast Table ────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Clock className="w-5 h-5 text-purple-400" />
              Detailed Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium text-xs">Date</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right">Predicted</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right">Lower Bound</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right">Upper Bound</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecast.map((row, i) => {
                    const prev = i === 0 ? historical[historical.length - 1].price : forecast[i - 1].predicted;
                    const change = ((row.predicted - prev) / prev) * 100;
                    return (
                      <TableRow key={row.date} className="border-white/5 hover:bg-white/[0.03]">
                        <TableCell className="text-sm text-slate-300 font-mono">
                          {row.date}
                        </TableCell>
                        <TableCell className="text-sm text-white font-semibold text-right">
                          ${formatPrice(row.predicted)}
                          <span className={`ml-2 text-xs ${getChangeColor(change)}`}>
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
                            {row.confidence}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}