'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  BarChart3,
  Sparkles,
  Hash,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { STOCKS, formatNumber } from '@/lib/stock-utils';
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

// ─── Types ────────────────────────────────────────────────────────────────────
type Sentiment = 'positive' | 'negative' | 'neutral';

interface NewsArticle {
  id: number;
  headline: string;
  source: string;
  time: string;
  sentiment: Sentiment;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
  summary: string;
}

// ─── Deterministic news generator ─────────────────────────────────────────────
const SOURCES = ['Bloomberg', 'Reuters', 'CNBC', 'WSJ', 'Financial Times'];

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const HEADLINES_BY_STOCK: Record<string, string[]> = {
  AAPL: [
    'Apple Reports Record Services Revenue in Q4 Earnings',
    'iPhone 16 Pro Demand Exceeds Wall Street Expectations',
    'Apple Vision Pro Adoption Accelerates in Enterprise Sector',
    'Apple Expands AI Features Across Entire Product Lineup',
    'Apple Stock Buyback Program Reaches $100 Billion Milestone',
    'China iPhone Sales Show Signs of Recovery in Latest Quarter',
    'Apple Car Project Cancellation Frees Up R&D Resources',
    'Apple Music Subscribers Surpass 110 Million Worldwide',
    'Tim Cook Signals Strong Holiday Quarter Guidance',
    'Apple Pay Transaction Volume Grows 25% Year Over Year',
    'Regulatory Pressure on App Store Fees Intensifies in EU',
    'Apple Supply Chain Diversification Strategy Shows Results',
  ],
  TSLA: [
    'Tesla Delivers Record Number of Vehicles in Q3',
    'Elon Musk Unveils Next-Generation Autonomous Driving Platform',
    'Tesla Cybertruck Production Ramps Up to Full Capacity',
    'Tesla Energy Storage Division Revenue Doubles Year Over Year',
    'China EV Competition Intensifies Pressure on Tesla Margins',
    'Tesla Supercharger Network Opens to Third-Party Automakers',
    'Tesla FSD V12 Receives Regulatory Approval in New Markets',
    'Tesla Stock Faces Volatility Amid Executive Shakeup',
    'Gigafactory Mexico Construction Ahead of Schedule',
    'Tesla Robotaxi Fleet Launches Pilot Program in Austin',
    'Tesla Battery Costs Decline 15% with New Cell Technology',
    'Analysts Raise Tesla Price Target Following Strong Deliveries',
  ],
  MSFT: [
    'Microsoft Azure Cloud Revenue Growth Beats Expectations',
    'Copilot AI Integration Drives Enterprise Office 365 Adoption',
    'Microsoft Activision Acquisition Yields Strong Gaming Revenue',
    'GitHub Copilot Reaches 10 Million Active Developers',
    'Microsoft Teams Surpasses Slack in Enterprise Market Share',
    'Azure AI Services See 300% Growth in Customer Adoption',
    'Microsoft Stock Dividend Increase Signals Board Confidence',
    'Windows 12 Development Focuses on AI-First Experience',
    'Microsoft LinkedIn Revenue Growth Accelerates in B2B Market',
    'Microsoft Security Division Reaches $20 Billion Annual Revenue',
    'Xbox Game Pass Subscriber Base Exceeds 40 Million',
    'Microsoft Announces $10 Billion AI Infrastructure Investment',
  ],
  NVDA: [
    'NVIDIA Data Center Revenue Surges 400% Year Over Year',
    'NVIDIA Blackwell GPU Architecture Sets New Performance Records',
    'AI Chip Demand Exceeds Supply as Tech Giants Expand Capacity',
    'NVIDIA Announces Next-Gen H200 Tensor Core GPU for AI Training',
    'NVIDIA Market Cap Crosses $3 Trillion Milestone',
    'NVIDIA Expands Automotive AI Platform with Major Automaker Deals',
    'NVIDIA Stock Splits 10-for-1 to Boost Retail Accessibility',
    'Competitors Challenge NVIDIA Dominance in AI Chip Market',
    'NVIDIA CUDA Ecosystem Strengthens Developer Lock-in Advantage',
    'NVIDIA Omniverse Platform Gains Traction in Digital Twin Market',
    'NVIDIA Earnings Beat Estimates Driven by AI Infrastructure Demand',
    'Sovereign AI Initiatives Create New Revenue Stream for NVIDIA',
  ],
  GOOG: [
    'Google Gemini AI Model Outperforms GPT-4 in Key Benchmarks',
    'Alphabet Cloud Revenue Growth Reaccelerates to 35%',
    'Google Search AI Overviews Roll Out Globally',
    'YouTube Advertising Revenue Hits New All-Time High',
    'Alphabet Stock Buyback Program Expanded by $70 Billion',
    'Google Waymo Autonomous Fleet Expands to 5 New Cities',
    'Alphabet Faces Antitrust Ruling in DOJ Search Monopoly Case',
    'Google Pixel 9 Sales Exceed Internal Projections',
    'Alphabet DeepMind Achieves Breakthrough in Protein Folding AI',
    'Google Cloud AI Platform Wins Major Enterprise Contracts',
    'Alphabet Nest Smart Home Revenue Grows 40% Year Over Year',
    'Google Ad Market Share Remains Dominant Despite AI Disruption',
  ],
  META: [
    'Meta AI Assistant Reaches 500 Million Monthly Active Users',
    'Meta Platforms Reality Labs Losses Narrow as AR/VR Grows',
    'Instagram Reels Monetization Improves Ad Revenue Per User',
    'Meta Threads User Base Surpasses 250 Million',
    'Meta Stock Rallies on Strong Advertising Revenue Growth',
    'WhatsApp Business Messaging Revenue Model Shows Promise',
    'Meta Llama 3 Open Source Model Gains Industry Adoption',
    'Meta Announces $35 Billion AI Data Center Investment Plan',
    'Facebook Engagement Metrics Show Unexpected Resurgence',
    'Meta Virtual Reality Headset Sales Double During Holiday Quarter',
    'Meta Content Moderation AI Reduces Harmful Content by 60%',
    'Meta Platforms Enters AR Glasses Market with Smart Specs',
  ],
  AMZN: [
    'Amazon AWS Revenue Growth Accelerates to 20% in Q3',
    'Amazon Prime Membership Reaches 250 Million Subscribers',
    'Amazon Advertising Business Becomes Major Profit Driver',
    'Amazon Robotics Deployment Reduces Fulfillment Costs by 30%',
    'Amazon Healthcare Initiative Expands to 35 New Markets',
    'Amazon Stock Hits All-Time High on Cloud Strength',
    'Project Kuiper Satellite Internet Receives FCC Approval',
    'Amazon Same-Day Delivery Now Available in 50 US Cities',
    'AWS Announces Custom AI Chips to Compete with NVIDIA',
    'Amazon MGM Studios Streaming Investment Yields Original Hits',
    'Amazon One Palm Payment Technology Expands Nationwide',
    'Amazon Logistics Network Handles Record Holiday Season Volume',
  ],
  INFY: [
    'Infosys Wins $2 Billion AI Transformation Deal with Fortune 500',
    'Infosys Revenue Growth Beats Expectations in Q2 Results',
    'Infosys Topaz AI Platform Gains Traction Among Enterprise Clients',
    'Infosys Expands European Operations with New Delivery Centers',
    'Infosys Stock Rallies on Strong Guidance Upgrade',
    'Infosys Partners with NVIDIA for AI Workforce Training Program',
    'Infosys Cloud Infrastructure Practice Sees 50% Revenue Growth',
    'Infosys Wins Major Banking Sector Digital Transformation Deal',
    'Infosys Employee Attrition Rate Drops to Multi-Year Low',
    'Infosys Announces Strategic Acquisition in Consulting Space',
    'Infosys Cobalt Cloud Platform Adds 100 New Enterprise Clients',
    'Infosys Sustainability Initiative Achieves Carbon Neutral Status',
  ],
  TCS: [
    'Tata Consultancy Services Reports Strong Q2 Revenue Growth',
    'TCS Wins Landmark $3 Billion Deal with UK Financial Institution',
    'TCS AI.Cloud Platform Launches with Enterprise-Grade Features',
    'TCS Employee Headcount Reaches 600,000 Worldwide',
    'TCS Stock Gains on Better-Than-Expected Margin Expansion',
    'TCS Enters Strategic Partnership with Google Cloud',
    'TCS Banking Software Platform Wins Multiple Global Clients',
    'TCS Digital Reimagination Practice Revenue Surges 40%',
    'TCS Expands Latin American Presence with New Brazil Office',
    'TCS Cognitive AI Practice Reaches $1 Billion Annual Revenue',
    'TCS Named Leader in Gartner Magic Quadrant for IT Services',
    'TCS Sustainability Report Shows 30% Reduction in Carbon Footprint',
  ],
  RELIANCE: [
    'Reliance Jio User Base Crosses 500 Million Mark in India',
    'Reliance Industries Announces Major Green Energy Investment',
    'Reliance Retail Expansion Reaches 20,000 Stores Nationwide',
    'Reliance Stock Surges on Strong Q3 Earnings Beat',
    'Jio Financial Services Launches Digital Banking Platform',
    'Reliance Partners with Global Tech Firms for AI Initiative',
    'Reliance New Energy Division Secures $5 Billion in Funding',
    'Reliance Petrochemical Margins Improve on Strong Demand',
    'Jio 5G Network Now Covers 80% of Urban India',
    'Reliance Media & Entertainment Revenue Grows 25%',
    'Reliance Announces Strategic Investment in Semiconductor Sector',
    'Reliance Industries Market Cap Approaches $300 Billion',
  ],
  JPM: [
    'JPMorgan Chase Reports Record Annual Profit of $50 Billion',
    'Jamie Dimon Warns of Geopolitical Risks to Global Economy',
    'JPMorgan Investment Banking Revenue Surges on IPO Recovery',
    'JPMorgan Stock Dividend Increase Signals Strong Capital Position',
    'JPMorgan Expands AI-Powered Trading Platform Capabilities',
    'JPMorgan Consumer Banking Sees Strong Credit Growth',
    'JPMorgan Asset Management AUM Crosses $4 Trillion',
    'JPMorgan Wins Regulatory Approval for Crypto Custody Service',
    'JPMorgan Chase Acquires Fintech Startup to Boost Digital Banking',
    'JPMorgan Fixed Income Trading Revenue Reaches New Heights',
    'JPMorgan Opens New Offices in Key Asia-Pacific Markets',
    'JPMorgan AI Research Lab Publishes Breakthrough Financial Models',
  ],
  V: [
    'Visa Revenue Growth Accelerates on Cross-Border Payment Recovery',
    'Visa Stock Hits All-Time High on Strong Fiscal Results',
    'Visa Launches AI-Powered Fraud Detection System Globally',
    'Visa Direct Real-Time Payment Volume Grows 30%',
    'Visa Partners with Central Banks on Digital Currency Pilots',
    'Visa Stock Split Announced to Boost Share Liquidity',
    'Visa B2B Connect Network Expands to 100 Countries',
    'Visa Credit Card Spending Data Signals Consumer Confidence',
    'Visa Acquires Fintech Firm to Enhance Open Banking Capabilities',
    'Visa Tap-to-Pay Adoption Surges Among Small Businesses',
    'Visa Tokenization Service Processes 1 Billion Transactions',
    'Visa Sustainability Bond Program Reaches $1 Billion Issuance',
  ],
};

const TRENDING_TOPICS: Record<string, string[]> = {
  AAPL: ['AI Integration', 'Services Revenue', 'iPhone Demand', 'China Market'],
  TSLA: ['FSD Autonomy', 'Cybertruck', 'Energy Storage', 'Gigafactory'],
  MSFT: ['Azure AI', 'Copilot', 'Cloud Growth', 'Gaming'],
  NVDA: ['AI Chips', 'Blackwell GPU', 'Data Center', 'Sovereign AI'],
  GOOG: ['Gemini AI', 'Cloud Revenue', 'Waymo', 'Antitrust'],
  META: ['AI Assistant', 'Threads', 'Reality Labs', 'Llama 3'],
  AMZN: ['AWS Growth', 'Prime', 'Advertising', 'Robotics'],
  INFY: ['AI Transformation', 'Topaz Platform', 'Cloud Practice', 'Attrition'],
  TCS: ['Banking Deals', 'AI.Cloud', 'Digital Growth', 'Sustainability'],
  RELIANCE: ['Jio 5G', 'Green Energy', 'Retail Expansion', 'New Energy'],
  JPM: ['Record Profits', 'Investment Banking', 'AI Trading', 'Crypto'],
  V: ['Cross-Border', 'Real-Time Payments', 'Digital Currency', 'Fraud Detection'],
};

function generateArticles(symbol: string): NewsArticle[] {
  const headlines = HEADLINES_BY_STOCK[symbol] || HEADLINES_BY_STOCK.AAPL;
  const stock = STOCKS[symbol] || STOCKS.AAPL;
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return headlines.map((headline, i) => {
    const r1 = seededRandom(hash * 100 + i * 7);
    const r2 = seededRandom(hash * 200 + i * 13);
    const r3 = seededRandom(hash * 300 + i * 17);
    const r4 = seededRandom(hash * 400 + i * 23);

    let sentiment: Sentiment;
    if (r1 > 0.55) sentiment = 'positive';
    else if (r1 > 0.25) sentiment = 'neutral';
    else sentiment = 'negative';

    const positivePercent = sentiment === 'positive' ? 55 + Math.round(r2 * 30) : sentiment === 'negative' ? 10 + Math.round(r2 * 20) : 20 + Math.round(r2 * 20);
    const negativePercent = sentiment === 'negative' ? 50 + Math.round(r3 * 30) : sentiment === 'positive' ? 5 + Math.round(r3 * 15) : 15 + Math.round(r3 * 15);
    const neutralPercent = 100 - positivePercent - negativePercent;

    const times = ['15m ago', '32m ago', '1h ago', '2h ago', '3h ago', '5h ago', '7h ago', '8h ago', '12h ago', '18h ago', '1d ago', '2d ago'];

    return {
      id: i,
      headline,
      source: SOURCES[Math.floor(r4 * SOURCES.length)],
      time: times[i % times.length],
      sentiment,
      positivePercent,
      negativePercent,
      neutralPercent,
      summary: `${stock.name} related development. Market impact assessment pending detailed analysis.`,
    };
  });
}

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function NewsSentimentPage() {
  const { selectedStock } = useAppStore();
  const [stockFilter, setStockFilter] = useState(selectedStock.symbol);

  const articles = useMemo(() => generateArticles(stockFilter), [stockFilter]);
  const stock = STOCKS[stockFilter] || STOCKS.AAPL;

  const sentimentCounts = useMemo(() => {
    const pos = articles.filter((a) => a.sentiment === 'positive').length;
    const neg = articles.filter((a) => a.sentiment === 'negative').length;
    const neu = articles.filter((a) => a.sentiment === 'neutral').length;
    return { positive: pos, negative: neg, neutral: neu, total: articles.length };
  }, [articles]);

  const aggregateScore = useMemo(() => {
    const { positive, total } = sentimentCounts;
    return Math.round((positive / total) * 100);
  }, [sentimentCounts]);

  const pieData = useMemo(
    () => [
      { name: 'Positive', value: sentimentCounts.positive, color: '#10b981' },
      { name: 'Neutral', value: sentimentCounts.neutral, color: '#f59e0b' },
      { name: 'Negative', value: sentimentCounts.negative, color: '#ef4444' },
    ],
    [sentimentCounts]
  );

  const trendingTopics = useMemo(
    () => TRENDING_TOPICS[stockFilter] || TRENDING_TOPICS.AAPL,
    [stockFilter]
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="News Sentiment"
        subtitle={`AI-powered sentiment analysis for ${stock.name} (${stockFilter})`}
        action={
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
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
        }
      />

      {/* ── Overall Sentiment Summary ─────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Overall Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2">
            <GaugeChart
              value={aggregateScore}
              label="Sentiment Score"
              size={180}
              strokeWidth={12}
            />
            <div className="flex gap-4 mt-4 text-xs">
              <span className="text-emerald-400 font-medium">
                {sentimentCounts.positive} Positive
              </span>
              <span className="text-yellow-400 font-medium">
                {sentimentCounts.neutral} Neutral
              </span>
              <span className="text-red-400 font-medium">
                {sentimentCounts.negative} Negative
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Distribution Donut */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Sentiment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
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
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="text-slate-400">
                    {d.name} ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trending Topics */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Trending Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {trendingTopics.map((topic, i) => (
              <motion.div
                key={topic}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Hash className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{topic}</p>
                  <p className="text-xs text-slate-500">
                    {Math.round(20 + seededRandom(stockFilter.length + i * 11) * 80)} mentions
                  </p>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Articles List ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Newspaper className="w-5 h-5 text-indigo-400" />
              Latest News & Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {articles.map((article) => (
                    <motion.article
                      key={article.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] hover:border-indigo-500/20 transition-all group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-semibold ${
                                article.sentiment === 'positive'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : article.sentiment === 'negative'
                                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                                  : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                              }`}
                            >
                              {article.sentiment === 'positive' && <TrendingUp className="w-3 h-3 mr-1" />}
                              {article.sentiment === 'negative' && <TrendingDown className="w-3 h-3 mr-1" />}
                              {article.sentiment === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
                              {article.sentiment.charAt(0).toUpperCase() + article.sentiment.slice(1)}
                            </Badge>
                            <span className="text-[11px] text-slate-500 font-medium">{article.source}</span>
                            <span className="text-[11px] text-slate-600">•</span>
                            <span className="text-[11px] text-slate-500">{article.time}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-indigo-300 transition-colors">
                            {article.headline}
                          </h3>
                        </div>
                        {/* Sentiment breakdown bar */}
                        <div className="sm:w-40 shrink-0 space-y-1.5">
                          <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                            <div
                              className="bg-emerald-500 transition-all duration-500"
                              style={{ width: `${article.positivePercent}%` }}
                            />
                            <div
                              className="bg-yellow-500 transition-all duration-500"
                              style={{ width: `${article.neutralPercent}%` }}
                            />
                            <div
                              className="bg-red-500 transition-all duration-500"
                              style={{ width: `${article.negativePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-emerald-400">{article.positivePercent}%</span>
                            <span className="text-yellow-400">{article.neutralPercent}%</span>
                            <span className="text-red-400">{article.negativePercent}%</span>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}