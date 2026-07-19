'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Brain,
  Newspaper,
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileDown,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  KNOWN_SYMBOLS,
  formatPrice,
  formatPercent,
  formatNumber,
  getChangeColor,
} from '@/lib/stock-utils';
import { GaugeChart } from '@/components/shared/gauge-chart';
import { SectionHeader } from '@/components/shared/animated-counter';
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
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportType = 'prediction' | 'news' | 'risk' | null;

interface ReportHistoryEntry {
  id: string;
  type: ReportType;
  symbol: string;
  date: string;
  title: string;
}

interface FetchedStockData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  high52w: number;
  low52w: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
}

interface FetchedSentiment {
  sentiment: string;
  score: number;
  articles: Array<{ title: string; sentiment: string }>;
}

interface FetchedPrediction {
  predictedPrice: number;
  predictedChange: number;
  predictedChangePercent: number;
  confidence: number;
  reasoning: string;
}

interface ReportData {
  title: string;
  generatedAt: string;
  stock: FetchedStockData;
  sentiment: FetchedSentiment | null;
  prediction: FetchedPrediction | null;
  analysis: string;
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
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Report type config ──────────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    id: 'prediction' as const,
    title: 'Prediction Report',
    description: 'AI-powered price prediction analysis with confidence intervals and trend analysis.',
    icon: Brain,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    id: 'news' as const,
    title: 'News Summary Report',
    description: 'Comprehensive sentiment analysis of recent news and its potential market impact.',
    icon: Newspaper,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'risk' as const,
    title: 'Risk Analysis Report',
    description: 'Detailed risk assessment including volatility metrics and risk scores.',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>(null);
  const [reportStock, setReportStock] = useState('AAPL');
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate report by fetching real API data
  const handleGenerate = useCallback(
    async (type: ReportType) => {
      setReportType(type);
      setIsGenerating(true);
      setError(null);
      setReportData(null);

      try {
        const symbol = reportStock.toUpperCase();

        // Fetch stock data
        const stockRes = await fetch(`/api/stock?symbol=${symbol}`);
        const stockJson = await stockRes.json();

        if (!stockJson.stock || stockJson.stock.price <= 0) {
          throw new Error(`Unable to fetch real-time data for ${symbol}. The stock may not exist or the data source is temporarily unavailable.`);
        }

        const stock: FetchedStockData = {
          symbol: stockJson.stock.symbol,
          name: stockJson.stock.name,
          sector: stockJson.stock.sector || 'N/A',
          price: stockJson.stock.price,
          change: stockJson.stock.change,
          changePercent: stockJson.stock.changePercent,
          volume: stockJson.stock.volume,
          marketCap: stockJson.stock.marketCap,
          pe: stockJson.stock.pe || 0,
          high52w: stockJson.stock.high52w || 0,
          low52w: stockJson.stock.low52w || 0,
          dayHigh: stockJson.stock.dayHigh || 0,
          dayLow: stockJson.stock.dayLow || 0,
          open: stockJson.stock.open || 0,
          previousClose: stockJson.stock.previousClose || 0,
        };

        // Fetch sentiment data
        let sentiment: FetchedSentiment | null = null;
        try {
          const sentRes = await fetch(`/api/sentiment?symbol=${symbol}`);
          const sentJson = await sentRes.json();
          if (sentJson.sentiment !== undefined) {
            sentiment = {
              sentiment: sentJson.sentiment || 'N/A',
              score: sentJson.score || 0,
              articles: (sentJson.articles || []).slice(0, 5),
            };
          }
        } catch {
          // sentiment fetch failed, continue without it
        }

        // Fetch prediction data
        let prediction: FetchedPrediction | null = null;
        try {
          const predRes = await fetch(`/api/prediction?symbol=${symbol}`);
          const predJson = await predRes.json();
          if (predJson.prediction) {
            prediction = {
              predictedPrice: predJson.prediction.predictedPrice || 0,
              predictedChange: predJson.prediction.predictedChange || 0,
              predictedChangePercent: predJson.prediction.predictedChangePercent || 0,
              confidence: predJson.prediction.confidence || 0,
              reasoning: predJson.prediction.reasoning || '',
            };
          }
        } catch {
          // prediction fetch failed, continue without it
        }

        // Build analysis text from real data
        let analysis = '';
        const trend = stock.changePercent > 0 ? 'bullish' : stock.changePercent < 0 ? 'bearish' : 'neutral';

        if (type === 'prediction') {
          if (prediction) {
            analysis = `Based on AI analysis, ${stock.symbol} (${stock.name}) currently shows a ${trend} trend with a price of $${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%). ` +
              `The AI model predicts a target price of $${prediction.predictedPrice.toFixed(2)} over the next 7 days, representing a ${prediction.predictedChangePercent >= 0 ? '+' : ''}${prediction.predictedChangePercent.toFixed(2)}% change. ` +
              `Confidence level: ${prediction.confidence}%. ${prediction.reasoning}`;
          } else {
            analysis = `Unable to generate prediction analysis for ${stock.symbol}. The AI prediction service is currently unavailable. Current price: $${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%).`;
          }
        } else if (type === 'news') {
          if (sentiment && sentiment.articles.length > 0) {
            const articleList = sentiment.articles.map((a) => `• ${a.title} (${a.sentiment})`).join('\n');
            analysis = `News sentiment analysis for ${stock.symbol} (${stock.name}). ` +
              `Overall sentiment: ${sentiment.sentiment} (score: ${sentiment.score}/100).\n\n` +
              `Recent news articles:\n${articleList}\n\n` +
              `The ${sentiment.sentiment.toLowerCase()} sentiment suggests ${sentiment.score > 60 ? 'potential positive momentum' : sentiment.score < 40 ? 'caution is advised' : 'a mixed market outlook'} for this stock.`;
          } else {
            analysis = `Unable to generate news sentiment analysis for ${stock.symbol}. No recent news data is currently available. Current price: $${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%).`;
          }
        } else {
          const riskLevel = stock.pe > 0 && stock.pe > 50 ? 'elevated' : stock.pe > 0 && stock.pe > 25 ? 'moderate' : 'low';
          const volatilityNote = stock.dayHigh > 0 && stock.dayLow > 0
            ? `Today's trading range: $${stock.dayLow.toFixed(2)} - $${stock.dayHigh.toFixed(2)} (spread: $${(stock.dayHigh - stock.dayLow).toFixed(2)}).`
            : '';
          analysis = `Risk assessment for ${stock.symbol} (${stock.name}). ` +
            `Current price: $${stock.price.toFixed(2)} with a P/E ratio of ${stock.pe > 0 ? stock.pe.toFixed(1) : 'N/A'}. ` +
            `The risk profile is assessed as ${riskLevel} based on current valuation metrics. ${volatilityNote} ` +
            `52-week range: $${stock.low52w > 0 ? stock.low52w.toFixed(2) : 'N/A'} - $${stock.high52w > 0 ? stock.high52w.toFixed(2) : 'N/A'}. ` +
            `Volume: ${formatNumber(stock.volume)}. Market cap: $${formatNumber(stock.marketCap)}.`;
        }

        const data: ReportData = {
          title: `${stock.symbol} ${REPORT_TYPES.find((t) => t.id === type)?.title || 'Report'}`,
          generatedAt: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          }),
          stock,
          sentiment,
          prediction,
          analysis,
        };

        setReportData(data);
        const newEntry: ReportHistoryEntry = {
          id: Date.now().toString(),
          type,
          symbol,
          date: new Date().toISOString().split('T')[0],
          title: data.title,
        };
        setReportHistory((prev) => [newEntry, ...prev]);
        toast.success('Report generated successfully');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to generate report';
        setError(msg);
        toast.error('Failed to generate report');
      } finally {
        setIsGenerating(false);
      }
    },
    [reportStock]
  );

  // Download text report
  const handleDownloadTXT = useCallback(() => {
    if (!reportData) return;
    const { stock: s } = reportData;
    const text = `
═══════════════════════════════════════════════
  MARKETLENS AI - ${reportData.title}
═══════════════════════════════════════════════

Generated: ${reportData.generatedAt}
Stock: ${s.symbol} — ${s.name}
Sector: ${s.sector}
Current Price: $${s.price.toFixed(2)}
Change: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%)
52-Week High: $${s.high52w > 0 ? s.high52w.toFixed(2) : 'N/A'}  |  Low: $${s.low52w > 0 ? s.low52w.toFixed(2) : 'N/A'}
Market Cap: $${formatNumber(s.marketCap)}
P/E Ratio: ${s.pe > 0 ? s.pe.toFixed(1) : 'N/A'}

───────────────────────────────────────────────
  ANALYSIS
───────────────────────────────────────────────

${reportData.analysis}

${reportData.prediction ? `───────────────────────────────────────────────\n  PREDICTION\n───────────────────────────────────────────────\n\nTarget Price: $${reportData.prediction.predictedPrice.toFixed(2)}\nChange: ${reportData.prediction.predictedChangePercent >= 0 ? '+' : ''}${reportData.prediction.predictedChangePercent.toFixed(2)}%\nConfidence: ${reportData.prediction.confidence}%\n` : ''}
${reportData.sentiment ? `───────────────────────────────────────────────\n  SENTIMENT\n───────────────────────────────────────────────\n\nOverall: ${reportData.sentiment.sentiment} (${reportData.sentiment.score}/100)\n` : ''}
───────────────────────────────────────────────
  Disclaimer: This report is generated by AI and
  should not be considered as financial advice.
═══════════════════════════════════════════════
`.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.symbol}_report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  }, [reportData]);

  // Copy report to clipboard
  const handleCopy = useCallback(async () => {
    if (!reportData) return;
    try {
      await navigator.clipboard.writeText(reportData.analysis);
      toast.success('Analysis copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [reportData]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Reports"
        subtitle="Generate and download AI-powered financial reports"
        action={
          <Select value={reportStock} onValueChange={setReportStock}>
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

      {/* ── Report Type Selector ───────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          const isActive = reportType === rt.id;
          return (
            <motion.button
              key={rt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGenerate(rt.id)}
              className={`glass-card p-6 text-left transition-all ${
                isActive
                  ? `${rt.border} ${rt.bg}`
                  : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className={`p-3 rounded-xl ${rt.bg} w-fit mb-3`}>
                <Icon className={`w-6 h-6 ${rt.color}`} />
              </div>
              <h3 className="text-white font-semibold mb-1">{rt.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{rt.description}</p>
            </motion.button>
          );
        })}
      </motion.div>

      {/* ── Loading State ──────────────────────────────────────────────────── */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 flex flex-col items-center justify-center gap-4"
        >
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">Fetching real data and generating report...</p>
        </motion.div>
      )}

      {/* ── Error State ────────────────────────────────────────────────────── */}
      {error && !isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-8 flex flex-col items-center justify-center gap-4"
        >
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-slate-300 text-sm text-center max-w-md">{error}</p>
          <Button
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </motion.div>
      )}

      {/* ── Report Preview ─────────────────────────────────────────────────── */}
      {reportData && !isGenerating && !error && (
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    {reportData.title}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    {reportData.generatedAt} • {reportData.stock.symbol} — {reportData.stock.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-slate-300 hover:bg-white/5 gap-1.5"
                    onClick={handleCopy}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-slate-300 hover:bg-white/5 gap-1.5"
                    onClick={handleDownloadTXT}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Price</p>
                  <p className="text-lg font-bold text-white">${formatPrice(reportData.stock.price)}</p>
                  <p className={`text-xs ${getChangeColor(reportData.stock.changePercent)}`}>
                    {formatPercent(reportData.stock.changePercent)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Market Cap</p>
                  <p className="text-lg font-bold text-white">${formatNumber(reportData.stock.marketCap)}</p>
                  <p className="text-xs text-slate-500">{reportData.stock.sector}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volume</p>
                  <p className="text-lg font-bold text-white">{formatNumber(reportData.stock.volume)}</p>
                  <p className="text-xs text-slate-500">P/E: {reportData.stock.pe > 0 ? reportData.stock.pe.toFixed(1) : 'N/A'}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">52-Week Range</p>
                  <p className="text-sm font-bold text-white">
                    {reportData.stock.low52w > 0 ? `$${formatPrice(reportData.stock.low52w)}` : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    to {reportData.stock.high52w > 0 ? `$${formatPrice(reportData.stock.high52w)}` : '—'}
                  </p>
                </div>
              </div>

              {/* Sentiment & Prediction Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportData.sentiment && (
                  <div className="p-4 rounded-xl bg-white/[0.02] flex flex-col items-center">
                    <p className="text-xs text-slate-400 font-medium mb-2">Sentiment Score</p>
                    <GaugeChart
                      value={reportData.sentiment.score}
                      label=""
                      size={140}
                      strokeWidth={10}
                    />
                    <p className="text-xs text-slate-400 mt-1">Overall: {reportData.sentiment.sentiment}</p>
                  </div>
                )}
                {reportData.prediction && (
                  <div className="p-4 rounded-xl bg-white/[0.02] flex flex-col items-center">
                    <p className="text-xs text-slate-400 font-medium mb-2">Prediction Confidence</p>
                    <GaugeChart
                      value={reportData.prediction.confidence}
                      label=""
                      size={140}
                      strokeWidth={10}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Target: ${reportData.prediction.predictedPrice.toFixed(2)} ({reportData.prediction.predictedChangePercent >= 0 ? '+' : ''}{reportData.prediction.predictedChangePercent.toFixed(2)}%)
                    </p>
                  </div>
                )}
              </div>

              {/* News Articles (if available) */}
              {reportData.sentiment && reportData.sentiment.articles.length > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.02]">
                  <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1.5">
                    <Newspaper className="w-3.5 h-3.5" />
                    Recent News Articles
                  </p>
                  <div className="space-y-2">
                    {reportData.sentiment.articles.map((article, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 mt-0.5 ${
                            article.sentiment === 'Positive' ? 'border-emerald-500/30 text-emerald-400' :
                            article.sentiment === 'Negative' ? 'border-red-500/30 text-red-400' :
                            'border-slate-500/30 text-slate-400'
                          }`}
                        >
                          {article.sentiment}
                        </Badge>
                        <span className="text-slate-300">{article.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis Text */}
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  AI Analysis
                </p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{reportData.analysis}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Report History ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Clock className="w-5 h-5 text-slate-400" />
              Report History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {reportHistory.map((entry) => {
                  const rt = REPORT_TYPES.find((t) => t.id === entry.type);
                  const Icon = rt?.icon || FileText;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                      onClick={() => {
                        setReportStock(entry.symbol);
                        handleGenerate(entry.type);
                      }}
                    >
                      <div className={`p-2 rounded-lg ${rt?.bg || 'bg-slate-500/10'}`}>
                        <Icon className={`w-4 h-4 ${rt?.color || 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{entry.title}</p>
                        <p className="text-xs text-slate-500">{entry.date}</p>
                      </div>
                      <Badge variant="outline" className="border-white/10 text-slate-400 text-[10px] shrink-0">
                        {entry.type}
                      </Badge>
                    </div>
                  );
                })}
                {reportHistory.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">No reports generated yet. Select a report type above to get started.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}