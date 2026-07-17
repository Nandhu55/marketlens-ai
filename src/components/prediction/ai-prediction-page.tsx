'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  Activity,
  BarChart3,
  ChevronRight,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
  formatPrice,
  formatPercent,
  type OHLCV,
} from '@/lib/stock-utils';
import { GaugeChart, CircularProgress } from '@/components/shared/gauge-chart';
import { AnimatedCounter, SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Seeded PRNG based on symbol ──────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 42;
}

// ─── Generate prediction data deterministically ───────────────────────────
interface PredictionData {
  bullishProb: number;
  bearishProb: number;
  volatilityScore: number;
  confidenceScore: number;
  upperBound: number;
  lowerBound: number;
  recommendation: 'BUY' | 'HOLD' | 'SELL';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rmse: number;
  mae: number;
}

function generatePrediction(symbol: string, currentPrice: number): PredictionData {
  const rng = seededRandom(symbolSeed(symbol));

  const bullishBase = 35 + rng() * 40;
  const bullishProb = parseFloat(bullishBase.toFixed(1));
  const bearishProb = parseFloat((100 - bullishProb).toFixed(1));

  const volatilityScore = parseFloat((20 + rng() * 60).toFixed(1));
  const confidenceScore = parseFloat((65 + rng() * 30).toFixed(1));

  const spread = currentPrice * (0.02 + rng() * 0.06);
  const upperBound = parseFloat((currentPrice + spread * (0.4 + rng() * 0.6)).toFixed(2));
  const lowerBound = parseFloat((currentPrice - spread * (0.4 + rng() * 0.6)).toFixed(2));

  let recommendation: 'BUY' | 'HOLD' | 'SELL';
  if (bullishProb > 62) recommendation = 'BUY';
  else if (bullishProb < 38) recommendation = 'SELL';
  else recommendation = 'HOLD';

  let riskLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
  if (volatilityScore < 35) riskLevel = 'Low';
  else if (volatilityScore < 55) riskLevel = 'Medium';
  else if (volatilityScore < 75) riskLevel = 'High';
  else riskLevel = 'Extreme';

  return {
    bullishProb,
    bearishProb,
    volatilityScore,
    confidenceScore,
    upperBound,
    lowerBound,
    recommendation,
    riskLevel,
    accuracy: parseFloat((82 + rng() * 12).toFixed(1)),
    precision: parseFloat((80 + rng() * 12).toFixed(1)),
    recall: parseFloat((83 + rng() * 12).toFixed(1)),
    f1Score: parseFloat((81 + rng() * 12).toFixed(1)),
    rmse: parseFloat((1.5 + rng() * 2.5).toFixed(2)),
    mae: parseFloat((1.0 + rng() * 2.0).toFixed(2)),
  };
}

// ─── Historical accuracy chart data ──────────────────────────────────────
interface AccuracyPoint {
  date: string;
  predicted: number;
  actual: number;
}

function generateAccuracyData(symbol: string, currentPrice: number): AccuracyPoint[] {
  const rng = seededRandom(symbolSeed(symbol) + 999);
  const data: AccuracyPoint[] = [];
  let price = currentPrice * 0.92;
  const now = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (rng() - 0.47) * 0.03;
    const actual = parseFloat((price * (1 + change)).toFixed(2));
    const noise = (rng() - 0.5) * currentPrice * 0.015;
    const predicted = parseFloat((actual + noise).toFixed(2));

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      predicted,
      actual,
    });
    price = actual;
  }
  return data;
}

// ─── AI Analysis text generator ──────────────────────────────────────────
function generateAnalysis(symbol: string, prediction: PredictionData): string[] {
  const stock = STOCKS[symbol];
  if (!stock) return ['Analysis unavailable for this symbol.'];

  const name = stock.name;
  const sector = stock.sector;
  const price = stock.price;
  const pe = stock.pe;

  const paragraphs: string[] = [];

  // Paragraph 1: Overview and trend
  if (prediction.recommendation === 'BUY') {
    paragraphs.push(
      `${name} (${symbol}) is currently exhibiting strong bullish momentum within the ${sector} sector. The stock is trading at $${price.toFixed(2)} with a P/E ratio of ${pe.toFixed(1)}, and our AI model detects accumulating institutional interest supported by positive volume dynamics. The price action over the past several sessions suggests a constructive pattern with higher lows forming, indicating sustained buying pressure at key support levels. Multiple timeframe analysis confirms the bullish thesis, with the daily, weekly, and monthly charts all aligned in an upward trajectory.`
    );
  } else if (prediction.recommendation === 'SELL') {
    paragraphs.push(
      `${name} (${symbol}) is showing signs of distribution and weakening momentum within the ${sector} sector. Currently trading at $${price.toFixed(2)} with a P/E ratio of ${pe.toFixed(1)}, the stock faces headwinds from deteriorating technical structure and declining volume support. Our AI model has detected a shift from accumulation to distribution phases, with institutional selling pressure increasing over the past several sessions. The risk-reward profile at current levels does not favor long positions, and the probability of further downside is elevated.`
    );
  } else {
    paragraphs.push(
      `${name} (${symbol}) is in a consolidation phase within the ${sector} sector, trading at $${price.toFixed(2)} with a P/E ratio of ${pe.toFixed(1)}. The stock is caught between competing forces, with neither buyers nor sellers able to establish clear control. Our AI model indicates a period of price discovery where the stock is building a base ahead of the next directional move. Volume patterns suggest reduced participation, typical of a coiling formation that often precedes a significant breakout or breakdown.`
    );
  }

  // Paragraph 2: Technical details
  paragraphs.push(
    `From a technical perspective, key moving averages are providing important context. The 20-day simple moving average and the 50-day SMA are currently positioned to offer dynamic support at critical price levels. The Relative Strength Index (RSI) reads at moderate levels, suggesting the stock is neither overbought nor oversold at this juncture. Bollinger Band analysis reveals that ${name} is trading within its normal volatility envelope, with the bands indicating a ${prediction.riskLevel.toLowerCase()} volatility regime. The Average True Range (ATR) confirms this assessment, with current readings ${prediction.volatilityScore > 50 ? 'above' : 'below'} historical averages.`
  );

  // Paragraph 3: Pattern and support/resistance
  if (prediction.bullishProb > 55) {
    paragraphs.push(
      `Pattern recognition algorithms have identified a potential continuation setup, with the price holding above the $${prediction.lowerBound.toFixed(2)} support zone. Resistance is anticipated near the $${prediction.upperBound.toFixed(2)} level, a convergence of previous swing highs and the upper Bollinger Band. A decisive close above this resistance could trigger a rapid move higher, targeting the next major resistance cluster. The MACD histogram is showing ${prediction.bullishProb > 65 ? 'accelerating' : 'moderate'} bullish momentum, while the signal line crossover suggests the trend is intact. Our model assigns a ${prediction.confidenceScore.toFixed(0)}% confidence level to this assessment.`
    );
  } else if (prediction.bearishProb > 55) {
    paragraphs.push(
      `Pattern recognition indicates a potential breakdown scenario, with critical support at $${prediction.lowerBound.toFixed(2)} under pressure. If this level fails to hold, the next significant support zone lies approximately 3-5% lower. Resistance at $${prediction.upperBound.toFixed(2)} remains firm, and the inability to reclaim this level reinforces the bearish thesis. The MACD histogram is ${prediction.bearishProb > 65 ? 'strongly' : 'moderately'} negative, confirming downward momentum. Volume analysis shows distribution patterns consistent with institutional unwinding. Our model maintains a ${prediction.confidenceScore.toFixed(0)}% confidence level for this bearish outlook.`
    );
  } else {
    paragraphs.push(
      `Price is currently consolidating between the $${prediction.lowerBound.toFixed(2)} support and $${prediction.upperBound.toFixed(2)} resistance levels. This range-bound behavior suggests market participants are awaiting a catalyst for directional conviction. The MACD is near the zero line, indicating a balance between buying and selling pressure. A breakout above the upper range or breakdown below the lower range would provide the next clear signal. The current squeeze in Bollinger Bands often precedes an explosive move in either direction. Our model maintains ${prediction.confidenceScore.toFixed(0)}% confidence in the neutral assessment.`
    );
  }

  // Paragraph 4: Risk assessment and outlook
  paragraphs.push(
    `Risk management considerations suggest that position sizing should account for the ${prediction.riskLevel.toLowerCase()} volatility environment currently exhibited by ${name}. The predicted price range of $${prediction.lowerBound.toFixed(2)} to $${prediction.upperBound.toFixed(2)} represents a potential ${((prediction.upperBound - prediction.lowerBound) / price * 100).toFixed(1)}% swing over the forecast horizon. Traders should maintain appropriate stop-loss levels and consider the stock's beta within the broader market context. The AI model's historical accuracy of ${prediction.accuracy.toFixed(1)}% for ${symbol} predictions provides a statistical edge, though no model guarantees future performance. Monitor volume patterns and sector rotation dynamics for early warning signs of trend changes.`
  );

  return paragraphs;
}

// ─── Animation variants ──────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Chart tooltip ───────────────────────────────────────────────────────
function AccuracyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 rounded-lg border border-indigo-500/20">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-300 capitalize">{entry.dataKey}:</span>
          <span className="font-semibold text-white">${entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recommendation color config ─────────────────────────────────────────
function getRecommendationStyle(rec: string) {
  switch (rec) {
    case 'BUY':
      return {
        gradient: 'from-emerald-500/30 via-emerald-500/10 to-cyan-500/30',
        border: 'border-emerald-500/40',
        badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        glow: 'shadow-[0_0_40px_rgba(16,185,129,0.15)]',
        icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
      };
    case 'SELL':
      return {
        gradient: 'from-red-500/30 via-red-500/10 to-orange-500/30',
        border: 'border-red-500/40',
        badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30',
        glow: 'shadow-[0_0_40px_rgba(239,68,68,0.15)]',
        icon: <TrendingDown className="w-6 h-6 text-red-400" />,
      };
    default:
      return {
        gradient: 'from-amber-500/30 via-amber-500/10 to-yellow-500/30',
        border: 'border-amber-500/40',
        badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        glow: 'shadow-[0_0_40px_rgba(245,158,11,0.15)]',
        icon: <Activity className="w-6 h-6 text-amber-400" />,
      };
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case 'Low': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'Medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'High': return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
    case 'Extreme': return 'bg-red-500/15 text-red-400 border-red-500/20';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  }
}

// ─── Main Component ──────────────────────────────────────────────────────
export function AIPredictionPage() {
  const { selectedStock, setSelectedStock } = useAppStore();

  const symbol = selectedStock.symbol;
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'real' | 'fallback' | 'local'>('local');
  const [realAnalysis, setRealAnalysis] = useState<string | null>(null);

  // Fetch real AI prediction from API
  const [apiData, setApiData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/prediction?symbol=${symbol}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setDataSource(data.dataSource || 'local');
        setApiData(data);
        if (data.analysis) setRealAnalysis(data.analysis);
      })
      .catch(() => setDataSource('local'))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [symbol]);

  const prediction = useMemo(() => {
    if (apiData?.prediction) {
      const p = apiData.prediction as Record<string, unknown>;
      return {
        bullishProb: (p.bullishProbability as number) || 50,
        bearishProb: (p.bearishProbability as number) || 50,
        volatilityScore: (p.volatility as number) || 30,
        confidenceScore: (p.confidence as number) || 75,
        upperBound: (p.upperBound as number) || 0,
        lowerBound: (p.lowerBound as number) || 0,
        recommendation: (p.recommendation as 'BUY' | 'HOLD' | 'SELL') || 'HOLD',
        riskLevel: (p.riskLevel as 'Low' | 'Medium' | 'High' | 'Extreme') || 'Medium',
        accuracy: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.accuracy || 85)),
        precision: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.precision || 83)),
        recall: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.recall || 86)),
        f1Score: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.f1Score || 84)),
        rmse: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.rmse || 2.0)),
        mae: parseFloat(String((apiData.modelPerformance as Record<string, string>)?.mae || 1.5)),
      };
    }
    return generatePrediction(symbol, selectedStock.price);
  }, [symbol, selectedStock.price, apiData]);

  const accuracyData = useMemo(() => {
    if (apiData?.actualHistory && apiData?.predictedHistory) {
      const actual = apiData.actualHistory as number[];
      const predicted = apiData.predictedHistory as number[];
      const len = Math.min(actual.length, predicted.length);
      return Array.from({ length: len }, (_, i) => ({
        date: `Day ${i + 1}`,
        actual: actual[i],
        predicted: predicted[i],
      }));
    }
    return generateAccuracyData(symbol, selectedStock.price);
  }, [symbol, selectedStock.price, apiData]);

  const analysisTexts = useMemo(() => {
    if (realAnalysis && dataSource !== 'local') {
      return realAnalysis.split(/\n\n|\.(?=\s)/).filter((t) => t.trim().length > 10).map((t) => t.trim());
    }
    return generateAnalysis(symbol, prediction);
  }, [symbol, prediction, realAnalysis, dataSource]);

  const recStyle = useMemo(() => getRecommendationStyle(prediction.recommendation), [prediction.recommendation]);

  const handleStockChange = (value: string) => {
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
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header with Stock Selector ── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10">
            <BrainCircuit className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Prediction</h1>
            <p className="text-sm text-slate-400">Machine learning-powered price forecasts</p>
            {dataSource === 'real' && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0 mt-1">AI POWERED</Badge>
            )}
          </div>
        </div>
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
      </motion.div>

      {/* ── Main Prediction Display ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bullish/Bearish Gauge */}
        <motion.div variants={itemVariants} className="glass-card p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            Price Direction
          </h3>
          <div className="flex justify-center">
            <GaugeChart
              value={prediction.bullishProb}
              label=""
              size={180}
              strokeWidth={14}
              segments={[
                { from: 0, to: 38, color: '#ef4444', label: 'Bearish' },
                { from: 38, to: 62, color: '#f59e0b', label: 'Neutral' },
                { from: 62, to: 100, color: '#10b981', label: 'Bullish' },
              ]}
            />
          </div>
          <div className="mt-4 text-center">
            <span className={cn(
              'text-2xl font-bold',
              prediction.bullishProb > 62 ? 'text-emerald-400' : prediction.bullishProb < 38 ? 'text-red-400' : 'text-amber-400'
            )}>
              {prediction.bullishProb > 62 ? 'Bullish' : prediction.bullishProb < 38 ? 'Bearish' : 'Neutral'}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {prediction.bullishProb}% Bullish / {prediction.bearishProb}% Bearish
            </p>
          </div>
        </motion.div>

        {/* Volatility + Confidence Gauges */}
        <motion.div variants={itemVariants} className="glass-card p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Volatility & Confidence
          </h3>
          <div className="flex justify-center items-center gap-8">
            <GaugeChart
              value={prediction.volatilityScore}
              label="Volatility"
              size={130}
              strokeWidth={10}
              segments={[
                { from: 0, to: 35, color: '#10b981', label: 'Low' },
                { from: 35, to: 55, color: '#f59e0b', label: 'Medium' },
                { from: 55, to: 75, color: '#f97316', label: 'High' },
                { from: 75, to: 100, color: '#ef4444', label: 'Extreme' },
              ]}
            />
            <CircularProgress
              value={prediction.confidenceScore}
              label="Confidence"
              size={110}
              strokeWidth={8}
              color={prediction.confidenceScore > 80 ? '#10b981' : prediction.confidenceScore > 70 ? '#f59e0b' : '#6366f1'}
            />
          </div>

          {/* Expected Price Range */}
          <div className="mt-6">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Expected Price Range</p>
            <div className="relative h-10 bg-slate-800/50 rounded-lg overflow-hidden">
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20"
                style={{
                  left: `${Math.max(0, ((prediction.lowerBound - selectedStock.price * 0.95) / (selectedStock.price * 0.12)) * 100)}%`,
                  right: `${Math.max(0, ((selectedStock.price * 1.05 - prediction.upperBound) / (selectedStock.price * 0.12)) * 100)}%`,
                }}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500/30" />
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-white shadow-lg shadow-white/30" />
              </div>
              <div className="absolute bottom-1 left-3 text-[10px] text-emerald-400 font-medium">
                ${prediction.lowerBound}
              </div>
              <div className="absolute bottom-1 right-3 text-[10px] text-cyan-400 font-medium">
                ${prediction.upperBound}
              </div>
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-medium">
                ${formatPrice(selectedStock.price)}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recommendation Card */}
        <motion.div
          variants={itemVariants}
          className={cn(
            'relative rounded-2xl p-6 overflow-hidden',
            'bg-gradient-to-br',
            recStyle.gradient,
            'border',
            recStyle.border,
            recStyle.glow
          )}
        >
          <div className="absolute inset-0 backdrop-blur-sm" />
          <div className="relative z-10">
            <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Recommendation
            </h3>

            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-white/5">
                {recStyle.icon}
              </div>
              <Badge className={cn('text-lg font-bold px-4 py-1.5 border', recStyle.badgeBg)}>
                {prediction.recommendation}
              </Badge>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {prediction.recommendation === 'BUY' && `Based on our AI model's analysis, ${symbol} shows strong potential for upward movement. Multiple indicators align with a bullish outlook.`}
              {prediction.recommendation === 'SELL' && `Our AI model suggests caution with ${symbol}. Current indicators point to potential downside risk. Consider reducing exposure.`}
              {prediction.recommendation === 'HOLD' && `${symbol} is in a consolidation phase. Our AI recommends maintaining current positions while waiting for a clearer directional signal.`}
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Risk Level</p>
                <Badge variant="outline" className={cn('mt-1 text-xs border', getRiskColor(prediction.riskLevel))}>
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  {prediction.riskLevel}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Target Range</p>
                <p className="text-sm font-semibold text-white mt-1">
                  ${prediction.lowerBound} — ${prediction.upperBound}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Prediction Breakdown ── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          Prediction Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Bullish Probability
              </span>
              <span className="text-sm font-bold text-emerald-400">{prediction.bullishProb}%</span>
            </div>
            <div className="relative h-3 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${prediction.bullishProb}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.3 }}
                style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))' }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                Bearish Probability
              </span>
              <span className="text-sm font-bold text-red-400">{prediction.bearishProb}%</span>
            </div>
            <div className="relative h-3 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${prediction.bearishProb}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── AI Analysis Text ── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          AI Analysis Report
          <Badge variant="outline" className="ml-auto text-[10px] border-purple-500/30 text-purple-400">
            <Zap className="w-3 h-3 mr-1" />
            {dataSource === 'real' ? 'Live AI' : 'Generated'}
          </Badge>
        </h3>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {analysisTexts.map((text, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
              className="text-sm text-slate-300 leading-relaxed"
            >
              {text}
            </motion.p>
          ))}
        </div>
      </motion.div>

      {/* ── Historical Prediction Accuracy ── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          Historical Prediction Accuracy — Last 30 Days
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={accuracyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<AccuracyTooltip />} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
                name="Actual"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1' }}
                name="Predicted"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-4 h-0.5 bg-emerald-500 rounded" />
            Actual Price
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-4 h-0.5 bg-indigo-500 rounded border-dashed" style={{ borderTop: '2px dashed #6366f1' }} />
            Predicted Price
          </div>
        </div>
      </motion.div>

      {/* ── Model Performance Metrics ── */}
      <motion.div variants={itemVariants}>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Model Performance Metrics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Accuracy', value: `${prediction.accuracy}%`, icon: Target, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
            { label: 'Precision', value: `${prediction.precision}%`, icon: Zap, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
            { label: 'Recall', value: `${prediction.recall}%`, icon: Activity, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
            { label: 'F1-Score', value: `${prediction.f1Score}%`, icon: CheckCircle2, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
            { label: 'RMSE', value: prediction.rmse.toFixed(2), icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
            { label: 'MAE', value: prediction.mae.toFixed(2), icon: BarChart3, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
          ].map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.6 + i * 0.05 }}
              className="glass-card p-4 text-center group"
            >
              <div className={cn('inline-flex p-2 rounded-lg mb-2', metric.bgColor)}>
                <metric.icon className={cn('w-4 h-4', metric.color)} />
              </div>
              <p className="text-xl font-bold text-white">{metric.value}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">{metric.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}