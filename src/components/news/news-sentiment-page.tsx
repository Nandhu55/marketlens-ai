'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Hash,
  Globe,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { KNOWN_SYMBOLS } from '@/lib/stock-utils';
import { GaugeChart } from '@/components/shared/gauge-chart';
import { SectionHeader, EmptyState } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────────
type Sentiment = 'positive' | 'negative' | 'neutral';

interface Article {
  headline: string;
  source: string;
  url: string;
  time: string;
  sentiment: Sentiment;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  snippet: string;
}

interface SentimentSummary {
  overallScore: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  trending: string[];
}

interface SentimentResponse {
  symbol: string;
  dataSource: string;
  articles: Article[];
  summary: SentimentSummary | null;
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

// ─── Pie Tooltip ────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-tooltip px-3 py-2 text-xs">
      <p style={{ color: payload[0].payload.fill }} className="font-medium">
        {payload[0].name}: {payload[0].value.toFixed(1)}%
      </p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const sentimentConfig = {
  positive: {
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    progress: 'bg-emerald-500',
    icon: TrendingUp,
  },
  negative: {
    color: 'text-red-400',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    progress: 'bg-red-500',
    icon: TrendingDown,
  },
  neutral: {
    color: 'text-yellow-400',
    badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    progress: 'bg-yellow-500',
    icon: Minus,
  },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────
export function NewsSentimentPage() {
  const { selectedStock } = useAppStore();
  const [stockSymbol, setStockSymbol] = useState(selectedStock.symbol);
  const [data, setData] = useState<SentimentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sentiment?symbol=${stockSymbol}`);
      const json: SentimentResponse = await res.json();
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
  const articles = data?.articles || [];
  const summary = data?.summary;
  const isReal = data?.dataSource === 'real';

  // Donut chart data
  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Positive', value: summary.positivePct, fill: '#10b981' },
      { name: 'Neutral', value: summary.neutralPct, fill: '#f59e0b' },
      { name: 'Negative', value: summary.negativePct, fill: '#ef4444' },
    ];
  }, [summary]);

  // ─── Loading State ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="News & Sentiment"
          subtitle={`Loading news for ${stock.name}...`}
          action={<Skeleton className="h-9 w-[160px] bg-white/5" />}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="glass-card p-6">
            <Skeleton className="h-4 w-24 bg-white/5 mb-4" />
            <Skeleton className="h-[140px] w-[140px] bg-white/5 mx-auto" />
          </Card>
          <Card className="glass-card p-6">
            <Skeleton className="h-4 w-32 bg-white/5 mb-4" />
            <Skeleton className="h-[160px] w-[160px] bg-white/5 mx-auto" />
          </Card>
          <Card className="glass-card p-6">
            <Skeleton className="h-4 w-28 bg-white/5 mb-4" />
            <div className="flex flex-wrap gap-2 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 bg-white/5 rounded-full" />
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-card p-4">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-6 w-16 bg-white/5 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2 bg-white/5 mt-3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error / No Data State ─────────────────────────────────────────────
  if (error || !data || data.dataSource === 'none') {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="News & Sentiment"
          subtitle={`Real-time news sentiment for ${stock.name} (${stockSymbol})`}
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
          icon={<Newspaper className="w-12 h-12" />}
          title="No Live Data Available"
          description={error || `Could not fetch news sentiment for ${stockSymbol}. The service may be temporarily unavailable.`}
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
        title="News & Sentiment"
        subtitle={
          isReal
            ? `Real-time sentiment analysis for ${stock.name} (${stockSymbol}) — ${articles.length} articles analyzed`
            : `News sentiment for ${stock.name} (${stockSymbol})`
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

      {/* ── Sentiment Overview Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overall Sentiment Gauge */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card p-5 flex flex-col items-center">
            <h3 className="text-sm font-medium text-slate-400 mb-4 self-start">Overall Sentiment</h3>
            {summary && (
              <>
                <GaugeChart
                  value={summary.overallScore}
                  label="Score"
                  size={160}
                  strokeWidth={12}
                  segments={[
                    { from: 0, to: 30, color: '#ef4444', label: 'Bearish' },
                    { from: 30, to: 50, color: '#f59e0b', label: 'Cautious' },
                    { from: 50, to: 70, color: '#f59e0b', label: 'Neutral' },
                    { from: 70, to: 85, color: '#10b981', label: 'Bullish' },
                    { from: 85, to: 100, color: '#10b981', label: 'Very Bullish' },
                  ]}
                />
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {summary.positiveCount} positive
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {summary.negativeCount} negative
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    {summary.neutralCount} neutral
                  </span>
                </div>
              </>
            )}
            {!summary && (
              <p className="text-sm text-slate-500 mt-8">No sentiment data</p>
            )}
          </Card>
        </motion.div>

        {/* Sentiment Distribution Donut */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card p-5 flex flex-col items-center">
            <h3 className="text-sm font-medium text-slate-400 mb-4 self-start">Sentiment Distribution</h3>
            {pieData.length > 0 && (
              <div className="relative">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {summary?.overallScore || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Score</span>
                </div>
              </div>
            )}
            {pieData.length === 0 && (
              <p className="text-sm text-slate-500 mt-8">No distribution data</p>
            )}
            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Positive {summary?.positivePct || 0}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-slate-400">Neutral {summary?.neutralPct || 0}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-400">Negative {summary?.negativePct || 0}%</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Trending Topics */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Trending Topics</h3>
            {summary && summary.trending && summary.trending.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {summary.trending.map((topic, i) => (
                  <motion.div
                    key={topic}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <Badge
                      variant="outline"
                      className="bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-colors px-3 py-1.5 text-xs"
                    >
                      <Hash className="w-3 h-3 mr-1 text-cyan-400" />
                      {topic}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No trending topics detected</p>
            )}

            {/* Sentiment Breakdown Bar */}
            {summary && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Breakdown</h4>
                {[
                  { label: 'Positive', value: summary.positivePct, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                  { label: 'Neutral', value: summary.neutralPct, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
                  { label: 'Negative', value: summary.negativePct, color: 'bg-red-500', textColor: 'text-red-400' },
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{bar.label}</span>
                      <span className={bar.textColor}>{bar.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full">
                      <motion.div
                        className={`h-full ${bar.color} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.value}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Articles List ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Newspaper className="w-5 h-5 text-cyan-400" />
              Latest Articles
              {isReal && (
                <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 ml-2" variant="outline">
                  <Sparkles className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              )}
              <Badge variant="outline" className="ml-auto text-xs text-slate-400 border-white/10">
                {articles.length} articles
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No articles found. Try selecting a different stock.
              </p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {articles.map((article, i) => {
                    const cfg = sentimentConfig[article.sentiment] || sentimentConfig.neutral;
                    const SentIcon = cfg.icon;
                    return (
                      <motion.a
                        key={i}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                        className="block p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-cyan-500/20 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Sentiment icon */}
                          <div className={`p-2 rounded-lg ${cfg.badge.split(' ')[0]} shrink-0 mt-0.5`}>
                            <SentIcon className={`w-4 h-4 ${cfg.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                                {article.headline}
                                <ExternalLink className="w-3 h-3 inline ml-1.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </h4>
                              <Badge variant="outline" className={`shrink-0 text-[10px] ${cfg.badge}`}>
                                {article.sentiment}
                              </Badge>
                            </div>

                            {/* Snippet */}
                            {article.snippet && (
                              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{article.snippet}</p>
                            )}

                            {/* Meta row */}
                            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {article.source}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {article.time}
                              </span>
                            </div>

                            {/* Sentiment confidence bars */}
                            <div className="flex items-center gap-3 mt-2.5">
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-[9px] text-emerald-500 w-2 shrink-0">+</span>
                                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-emerald-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${article.positivePct}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                                  />
                                </div>
                                <span className="text-[9px] text-slate-500 w-7 text-right">{article.positivePct}%</span>
                              </div>
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-[9px] text-red-500 w-2 shrink-0">−</span>
                                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-red-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${article.negativePct}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                                  />
                                </div>
                                <span className="text-[9px] text-slate-500 w-7 text-right">{article.negativePct}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.a>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}