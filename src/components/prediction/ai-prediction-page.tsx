'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  Activity,
  Zap,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  KNOWN_SYMBOLS,
  formatPrice,
  formatPercent,
} from '@/lib/stock-utils';
import { CircularProgress } from '@/components/shared/gauge-chart';
import { LoadingSpinner, EmptyState, SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────────
interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface PredictionData {
  bullishProbability: number;
  bearishProbability: number;
  volatility: number;
  predictedPrice: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  riskLevel: string;
  recommendation: string;
  analysis: string;
  keyFactors: string[];
  supportLevels: number[];
  resistanceLevels: number[];
}

interface PredictionResponse {
  symbol: string;
  stock: StockData;
  dataSource: string;
  indicators?: Record<string, number | undefined>;
  prediction: PredictionData | null;
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

// ─── Component ──────────────────────────────────────────────────────────────
export function AIPredictionPage() {
  const { selectedStock } = useAppStore();
  const [stockSymbol, setStockSymbol] = useState(selectedStock.symbol);
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prediction?symbol=${stockSymbol}`);
      const json: PredictionResponse = await res.json();
      setData(json);
      if (json.dataSource === 'none' || json.error) {
        setError(json.error || 'No Live Data Available');
      }
    } catch {
      setError('No Live Data Available');
    } finally {
      setLoading(false);
    }
  }, [stockSymbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stock = KNOWN_SYMBOLS.find((s) => s.symbol === stockSymbol) || KNOWN_SYMBOLS[0];
  const pred = data?.prediction;
  const stk = data?.stock;
  const isReal = data?.dataSource === 'real';

  const getRecommendationColor = (rec: string) => {
    switch (rec?.toUpperCase()) {
      case 'BUY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'SELL': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'HOLD': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  // ─── Loading State ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="AI Prediction"
          subtitle={`Loading prediction for ${stock.name} (${stockSymbol})...`}
          action={
            <Skeleton className="h-9 w-[160px] bg-white/5" />
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5">
              <Skeleton className="h-4 w-24 bg-white/5 mb-3" />
              <Skeleton className="h-8 w-32 bg-white/5 mb-2" />
              <Skeleton className="h-3 w-16 bg-white/5" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6">
          <Skeleton className="h-6 w-48 bg-white/5 mb-6" />
          <Skeleton className="h-40 w-full bg-white/5" />
        </div>
        <div className="glass-card p-6">
          <Skeleton className="h-6 w-36 bg-white/5 mb-4" />
          <Skeleton className="h-24 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  // ─── Error / No Data State ─────────────────────────────────────────────
  if (error || !data || data.dataSource === 'none' || !pred) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="AI Prediction"
          subtitle={`AI-powered stock prediction for ${stock.name} (${stockSymbol})`}
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
          icon={<BrainCircuit className="w-12 h-12" />}
          title="No Live Data Available"
          description={error || `Could not generate an AI prediction for ${stockSymbol}. The service may be temporarily unavailable.`}
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
        title="AI Prediction"
        subtitle={
          stk
            ? `${stk.name} (${stk.symbol}) — $${formatPrice(stk.price)} ${formatPercent(stk.changePercent)}`
            : `AI-powered prediction for ${stock.name} (${stockSymbol})`
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

      {/* ── Bullish / Bearish Probability ───────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card glow-green">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-300">Bullish Probability</span>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">
                {pred.bullishProbability > 60 ? 'Strong' : pred.bullishProbability > 50 ? 'Moderate' : 'Weak'}
              </Badge>
            </div>
            <div className="flex items-center gap-6">
              <CircularProgress
                value={pred.bullishProbability}
                label=""
                size={100}
                strokeWidth={8}
                color="#10b981"
              />
              <div className="flex-1">
                <div className="text-3xl font-bold text-emerald-400 mb-2">{pred.bullishProbability}%</div>
                <Progress value={pred.bullishProbability} className="h-2 bg-white/5 [&>div]:bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glow-red">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-sm font-medium text-slate-300">Bearish Probability</span>
              </div>
              <Badge className="bg-red-500/15 text-red-400 border-red-500/30" variant="outline">
                {pred.bearishProbability > 60 ? 'Strong' : pred.bearishProbability > 50 ? 'Moderate' : 'Weak'}
              </Badge>
            </div>
            <div className="flex items-center gap-6">
              <CircularProgress
                value={pred.bearishProbability}
                label=""
                size={100}
                strokeWidth={8}
                color="#ef4444"
              />
              <div className="flex-1">
                <div className="text-3xl font-bold text-red-400 mb-2">{pred.bearishProbability}%</div>
                <Progress value={pred.bearishProbability} className="h-2 bg-white/5 [&>div]:bg-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Recommendation Badge ────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex justify-center">
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border ${getRecommendationColor(pred.recommendation)}`}>
          <Zap className="w-5 h-5" />
          <span className="text-xl font-bold tracking-wider">{pred.recommendation}</span>
        </div>
      </motion.div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            title: 'Predicted Price',
            value: `$${formatPrice(pred.predictedPrice)}`,
            icon: Target,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
            glow: 'glow-cyan',
            sub: stk ? `Current: $${formatPrice(stk.price)}` : undefined,
          },
          {
            title: 'Direction',
            value: pred.bullishProbability > pred.bearishProbability ? 'BULLISH' : 'BEARISH',
            icon: pred.bullishProbability > pred.bearishProbability ? TrendingUp : TrendingDown,
            color: pred.bullishProbability > pred.bearishProbability ? 'text-emerald-400' : 'text-red-400',
            bg: pred.bullishProbability > pred.bearishProbability ? 'bg-emerald-500/10' : 'bg-red-500/10',
            glow: pred.bullishProbability > pred.bearishProbability ? 'glow-green' : 'glow-red',
          },
          {
            title: 'Volatility',
            value: `${pred.volatility.toFixed(2)}%`,
            icon: Activity,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            glow: 'glow-purple',
          },
          {
            title: 'Confidence',
            value: `${pred.confidence}%`,
            icon: Sparkles,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
            glow: 'glow-cyan',
          },
          {
            title: 'Risk Level',
            value: pred.riskLevel,
            icon: ShieldAlert,
            color: getRiskColor(pred.riskLevel),
            bg: pred.riskLevel?.toLowerCase() === 'low'
              ? 'bg-emerald-500/10'
              : pred.riskLevel?.toLowerCase() === 'high'
              ? 'bg-red-500/10'
              : 'bg-yellow-500/10',
            glow: pred.riskLevel?.toLowerCase() === 'low'
              ? 'glow-green'
              : pred.riskLevel?.toLowerCase() === 'high'
              ? 'glow-red'
              : '',
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className={`glass-card p-4 ${card.glow}`}
          >
            <div className={`p-2 rounded-lg ${card.bg} w-fit mb-2`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
              {card.title}
            </p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            {card.sub && (
              <p className="text-[10px] text-slate-500 mt-1">{card.sub}</p>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* ── AI Analysis ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
              AI Analysis
              {isReal && (
                <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 ml-2" variant="outline">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI POWERED
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{pred.analysis}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Key Factors, Support & Resistance ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Key Factors */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Key Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[280px]">
                <ul className="space-y-2">
                  {pred.keyFactors.map((factor, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <ChevronRightIcon className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-300">{factor}</span>
                    </motion.li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Support & Resistance Levels */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Target className="w-5 h-5 text-yellow-400" />
                Support & Resistance Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Resistance Levels */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resistance</span>
                </div>
                <div className="space-y-2">
                  {(pred.resistanceLevels || []).map((level, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.06 }}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]"
                    >
                      <span className="text-xs text-slate-500">R{i + 1}</span>
                      <span className="text-sm font-semibold text-emerald-400">${formatPrice(level)}</span>
                    </motion.div>
                  ))}
                  {(!pred.resistanceLevels || pred.resistanceLevels.length === 0) && (
                    <span className="text-xs text-slate-500">No resistance levels available</span>
                  )}
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Support Levels */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Support</span>
                </div>
                <div className="space-y-2">
                  {(pred.supportLevels || []).map((level, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]"
                    >
                      <span className="text-xs text-slate-500">S{i + 1}</span>
                      <span className="text-sm font-semibold text-red-400">${formatPrice(level)}</span>
                    </motion.div>
                  ))}
                  {(!pred.supportLevels || pred.supportLevels.length === 0) && (
                    <span className="text-xs text-slate-500">No support levels available</span>
                  )}
                </div>
              </div>

              {/* Price Range Indicator */}
              <Separator className="bg-white/5" />
              <div className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Price Range</span>
                  <span className="text-xs text-slate-400">
                    ${formatPrice(pred.lowerBound)} — ${formatPrice(pred.upperBound)}
                  </span>
                </div>
                <div className="relative h-2 bg-white/5 rounded-full">
                  {pred.predictedPrice > 0 && pred.upperBound > pred.lowerBound && (
                    <div
                      className="absolute top-0 h-full bg-gradient-to-r from-red-500/60 via-yellow-500/60 to-emerald-500/60 rounded-full"
                      style={{
                        left: '0%',
                        width: '100%',
                      }}
                    />
                  )}
                  {pred.predictedPrice > 0 && pred.upperBound > pred.lowerBound && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-cyan-400 rounded-full border-2 border-background"
                      style={{
                        left: `${((pred.predictedPrice - pred.lowerBound) / (pred.upperBound - pred.lowerBound)) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Chevron Right SVG Icon ─────────────────────────────────────────────
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}