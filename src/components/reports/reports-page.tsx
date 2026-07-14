'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  FileText,
  Download,
  Brain,
  Newspaper,
  ShieldAlert,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  FileDown,
  Printer,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STOCKS,
  generateStockData,
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
import { Separator } from '@/components/ui/separator';
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
    description: 'Detailed risk assessment including volatility metrics, drawdown analysis, and risk scores.',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { selectedStock } = useAppStore();
  const [reportType, setReportType] = useState<ReportType>(null);
  const [reportStock, setReportStock] = useState(selectedStock.symbol);
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([
    { id: '1', type: 'prediction', symbol: 'AAPL', date: '2025-01-15', title: 'AAPL Prediction Report' },
    { id: '2', type: 'news', symbol: 'NVDA', date: '2025-01-14', title: 'NVDA News Summary' },
    { id: '3', type: 'risk', symbol: 'TSLA', date: '2025-01-13', title: 'TSLA Risk Analysis' },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const stock = STOCKS[reportStock] || STOCKS.AAPL;

  // Generate mock report data
  const reportData = useMemo(() => {
    if (!reportType || !stock) return null;

    const histData = generateStockData(reportStock, 30);
    const priceChange = stock.changePercent;
    const rsi = 40 + Math.abs(stock.pe % 30);
    const volatility = stock.pe > 50 ? 'High' : stock.pe > 30 ? 'Medium' : 'Low';
    const sentimentScore = priceChange > 0 ? 65 + Math.round(Math.abs(priceChange) * 5) : 35 + Math.round(Math.abs(priceChange) * 5);
    const riskScore = stock.pe > 50 ? 72 : stock.pe > 30 ? 55 : 35;

    const miniChartData = histData.slice(-14).map((d) => ({
      date: d.date,
      price: d.close,
    }));

    const riskBars = [
      { name: 'Volatility', value: stock.pe > 50 ? 78 : 45, color: '#ef4444' },
      { name: 'Market Risk', value: 55, color: '#f59e0b' },
      { name: 'Liquidity', value: 85, color: '#10b981' },
      { name: 'Concentration', value: 40, color: '#6366f1' },
    ];

    const typeLabels: Record<string, string> = {
      prediction: 'Price Prediction',
      news: 'News Sentiment Summary',
      risk: 'Risk Assessment',
    };

    return {
      title: `${stock.symbol} ${typeLabels[reportType]}`,
      generatedAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
      stock,
      priceChange,
      rsi: Math.min(90, rsi),
      volatility,
      sentimentScore: Math.min(95, sentimentScore),
      riskScore,
      miniChartData,
      riskBars,
      analysis:
        reportType === 'prediction'
          ? `Based on our LSTM neural network analysis, ${stock.symbol} shows a ${priceChange > 0 ? 'bullish' : 'bearish'} trend. The model predicts continued ${priceChange > 0 ? 'upward' : 'downward'} momentum over the next 7 days with a confidence level of 82%. Key technical indicators support this outlook, with the 20-day SMA trending ${priceChange > 0 ? 'above' : 'below'} the 50-day SMA. Volume analysis confirms ${priceChange > 0 ? 'accumulation' : 'distribution'} patterns.`
          : reportType === 'news'
          ? `Recent news coverage for ${stock.name} has been predominantly ${priceChange > 0 ? 'positive' : 'negative'}. Key themes include earnings performance, sector trends, and macroeconomic factors. Sentiment analysis of 156 recent articles indicates a ${sentimentScore}/100 positive sentiment score. Notable headlines suggest ${priceChange > 0 ? 'institutional buying interest' : 'increased caution from major holders'}.`
          : `The overall risk profile for ${stock.symbol} is assessed as ${riskScore > 60 ? 'Elevated' : riskScore > 40 ? 'Moderate' : 'Low'}. Key risk factors include ${volatility} volatility, market beta of ${stock.pe > 50 ? '1.4' : '1.1'}, and sector-specific headwinds. The maximum drawdown over the past year was ${((1 - stock.low52w / stock.high52w) * 100).toFixed(1)}%. Risk-adjusted returns suggest ${riskScore > 60 ? 'cautious positioning is advised' : 'favorable risk-reward ratio'}.`,
    };
  }, [reportType, reportStock, stock]);

  // Generate report
  const handleGenerate = useCallback(
    (type: ReportType) => {
      setReportType(type);
      setIsGenerating(true);
      setTimeout(() => {
        setIsGenerating(false);
        const newEntry: ReportHistoryEntry = {
          id: Date.now().toString(),
          type,
          symbol: reportStock,
          date: new Date().toISOString().split('T')[0],
          title: `${reportStock} ${REPORT_TYPES.find((t) => t.id === type)?.title || 'Report'}`,
        };
        setReportHistory((prev) => [newEntry, ...prev]);
        toast.success('Report generated successfully');
      }, 1200);
    },
    [reportStock]
  );

  // Download CSV
  const handleDownloadCSV = useCallback(() => {
    if (!reportData) return;
    const { stock: s, miniChartData, riskBars } = reportData;
    const rows = [
      [`MarketLens AI Report - ${reportData.title}`],
      [`Generated: ${reportData.generatedAt}`],
      [`Stock: ${s.symbol} - ${s.name}`],
      [`Current Price: $${s.price}`],
      [`Change: ${s.changePercent.toFixed(2)}%`],
      [],
      ['Date', 'Price'],
      ...miniChartData.map((d) => [d.date, d.price.toFixed(2)]),
      [],
      ['Risk Metric', 'Score'],
      ...riskBars.map((r) => [r.name, r.value]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.symbol}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }, [reportData]);

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
Current Price: $${s.price}
Change: ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)} (${s.changePercent.toFixed(2)}%)
52-Week High: $${s.high52w}  |  Low: $${s.low52w}
Market Cap: $${formatNumber(s.marketCap)}
P/E Ratio: ${s.pe}

───────────────────────────────────────────────
  ANALYSIS
───────────────────────────────────────────────

${reportData.analysis}

───────────────────────────────────────────────
  KEY METRICS
───────────────────────────────────────────────

Sentiment Score: ${reportData.sentimentScore}/100
Risk Score: ${reportData.riskScore}/100
Volatility: ${reportData.volatility}
RSI (14): ${reportData.rsi}

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
              {Object.values(STOCKS).map((s) => (
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
          <motion.div
            className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-slate-400 text-sm">Generating report...</p>
        </motion.div>
      )}

      {/* ── Report Preview ─────────────────────────────────────────────────── */}
      {reportData && !isGenerating && (
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
                    onClick={handleDownloadCSV}
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
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
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volatility</p>
                  <p className="text-lg font-bold text-white">{reportData.volatility}</p>
                  <p className="text-xs text-slate-500">P/E: {reportData.stock.pe}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">RSI (14)</p>
                  <p className={`text-lg font-bold ${reportData.rsi > 70 ? 'text-red-400' : reportData.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
                    {reportData.rsi}
                  </p>
                  <p className="text-xs text-slate-500">{reportData.rsi > 70 ? 'Overbought' : reportData.rsi < 30 ? 'Oversold' : 'Neutral'}</p>
                </div>
              </div>

              {/* Charts + Gauges row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Mini price chart */}
                <div className="lg:col-span-2 p-4 rounded-xl bg-white/[0.02]">
                  <p className="text-xs text-slate-400 font-medium mb-3">14-Day Price Trend</p>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData.miniChartData}>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${v.toFixed(0)}`}
                          width={50}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(15,23,42,0.95)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '8px',
                            color: '#e2e8f0',
                            fontSize: '11px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gauge + Risk bars */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] flex flex-col items-center">
                    <p className="text-xs text-slate-400 font-medium mb-2">
                      {reportType === 'risk' ? 'Risk Score' : 'Sentiment Score'}
                    </p>
                    <GaugeChart
                      value={reportType === 'risk' ? reportData.riskScore : reportData.sentimentScore}
                      label=""
                      size={140}
                      strokeWidth={10}
                    />
                  </div>
                  {reportType === 'risk' && (
                    <div className="p-4 rounded-xl bg-white/[0.02] space-y-2">
                      <p className="text-xs text-slate-400 font-medium mb-2">Risk Breakdown</p>
                      {reportData.riskBars.map((bar) => (
                        <div key={bar.name} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">{bar.name}</span>
                            <span style={{ color: bar.color }}>{bar.value}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${bar.value}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ background: bar.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Text */}
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  AI Analysis
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">{reportData.analysis}</p>
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
                  <p className="text-sm text-slate-500 text-center py-8">No reports generated yet.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}