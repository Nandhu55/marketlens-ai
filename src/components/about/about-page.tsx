'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  Github,
  ExternalLink,
  Layers,
  Brain,
  Database,
  Cpu,
  CheckCircle,
  ArrowRight,
  Box,
  Server,
  Cloud,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

// ─── Architecture box component ───────────────────────────────────────────────
function ArchBox({
  icon: Icon,
  title,
  items,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + delay }}
      className={`glass-card p-5 border-l-2 ${color}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-slate-300" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-1 h-1 rounded-full bg-indigo-400/50 shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Tech stack items ─────────────────────────────────────────────────────────
const TECH_STACK = [
  { name: 'Next.js 16', color: 'bg-slate-500/20 text-slate-300 border-slate-500/20' },
  { name: 'TypeScript', color: 'bg-blue-500/20 text-blue-300 border-blue-500/20' },
  { name: 'Tailwind CSS 4', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20' },
  { name: 'shadcn/ui', color: 'bg-purple-500/20 text-purple-300 border-purple-500/20' },
  { name: 'Framer Motion', color: 'bg-pink-500/20 text-pink-300 border-pink-500/20' },
  { name: 'Recharts', color: 'bg-orange-500/20 text-orange-300 border-orange-500/20' },
  { name: 'Prisma ORM', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20' },
  { name: 'Zustand', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/20' },
  { name: 'z-ai-web-dev-sdk', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' },
  { name: 'Lucide Icons', color: 'bg-rose-500/20 text-rose-300 border-rose-500/20' },
];

// ─── Features list ────────────────────────────────────────────────────────────
const FEATURES = [
  'Real-time stock quotes via Web Search + LLM Analysis',
  'AI-powered price predictions using GPT-class LLM',
  'Comprehensive technical analysis with 15+ indicators',
  'News sentiment analysis powered by LLM',
  'Stock screener with real-time data filtering',
  'Conversational AI assistant for market Q&A',
  'Custom price alerts and notification management',
  'Portfolio tracking with P/L analytics and allocation charts',
  'Multi-timeframe forecasting with confidence intervals',
  'Customizable report generation with text export',
  'Dark theme with glassmorphism design',
  'Responsive design for desktop and mobile',
];

// ─── Component ────────────────────────────────────────────────────────────────
export function AboutPage() {
  const { setActivePage } = useAppStore();

  return (
    <motion.div
      className="space-y-6 max-w-4xl"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="text-center py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' as const }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/20 mb-4"
        >
          <Sparkles className="w-10 h-10 text-indigo-400" />
        </motion.div>
        <h1 className="text-4xl font-bold gradient-text mb-2">MarketLens AI</h1>
        <p className="text-slate-400 text-sm mb-1">v3.0.0</p>
        <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
          A premium financial analytics platform that combines real-time market data from web search,
          GPT-class LLM analysis, and advanced technical indicators into one elegant interface.
        </p>
      </motion.div>

      {/* ── Architecture Section ────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Layers className="w-5 h-5 text-purple-400" />
              System Architecture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Connection line */}
              <div className="flex justify-center">
                <div className="w-px h-4 bg-gradient-to-b from-indigo-500/50 to-transparent" />
              </div>

              {/* Frontend */}
              <ArchBox
                icon={Box}
                title="Frontend Layer"
                items={['Next.js 16 App Router', 'React 19 with Client Components', 'Tailwind CSS 4 + Glassmorphism', 'shadcn/ui Component Library', 'Framer Motion Animations']}
                color="border-l-indigo-500"
                delay={0}
              />

              {/* Connection line */}
              <div className="flex justify-center">
                <div className="w-px h-4 bg-gradient-to-b from-purple-500/50 to-transparent" />
              </div>

              {/* Backend */}
              <ArchBox
                icon={Server}
                title="Backend Services"
                items={['Next.js API Routes', 'Prisma ORM (SQLite)', 'Zustand State Management', 'z-ai-web-dev-sdk Integration', 'Real-time WebSocket Support']}
                color="border-l-purple-500"
                delay={0.1}
              />

              {/* Connection line */}
              <div className="flex justify-center">
                <div className="w-px h-4 bg-gradient-to-b from-cyan-500/50 to-transparent" />
              </div>

              {/* AI Engine */}
              <ArchBox
                icon={Brain}
                title="AI Engine"
                items={['GPT-class LLM for Predictions', 'GPT-class LLM for Sentiment Analysis', '15+ Technical Indicator Features', 'Real-time Web Search Data', 'Conversational AI Assistant']}
                color="border-l-cyan-500"
                delay={0.2}
              />

              {/* Connection line */}
              <div className="flex justify-center">
                <div className="w-px h-4 bg-gradient-to-b from-emerald-500/50 to-transparent" />
              </div>

              {/* Data Sources */}
              <ArchBox
                icon={Database}
                title="Data Sources"
                items={['Real-time via Web Search + LLM Analysis', 'Historical OHLCV Data via AI SDK', 'Real-time Market Feeds', 'News Aggregation via Web Search', 'Economic Indicators']}
                color="border-l-emerald-500"
                delay={0.3}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Model Information ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Cpu className="w-5 h-5 text-cyan-400" />
              AI Model Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LLM Analysis */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  GPT-class LLM
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Powered by GPT-class large language model for predictions, sentiment analysis, and conversational assistance.
                  All analysis is generated in real-time using current market data.
                </p>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Use Cases</span>
                    <span className="text-white font-medium">Predictions, Sentiment, Chat</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Input</span>
                    <span className="text-white font-medium">Real-time + Technical Indicators</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Features</span>
                    <span className="text-white font-medium">15 technical indicators + news</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency</span>
                    <span className="text-emerald-400 font-semibold">Real-time inference</span>
                  </div>
                </div>
              </div>

              {/* Sentiment Analysis */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  News Sentiment via LLM
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Financial news articles are fetched via web search and analyzed by LLM for sentiment scoring.
                  Provides real-time market sentiment for informed decision-making.
                </p>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Model</span>
                    <span className="text-white font-medium">GPT-class LLM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sentiment Classes</span>
                    <span className="text-white font-medium">Positive / Neutral / Negative</span>
                  </div>
                  <div className="flex justify-between">
                    <span>News Sources</span>
                    <span className="text-white font-medium">Web Search (real-time)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Update Frequency</span>
                    <span className="text-white font-medium">Real-time</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tech Stack Grid ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Layers className="w-5 h-5 text-yellow-400" />
              Technology Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech, i) => (
                <motion.div
                  key={tech.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                >
                  <Badge
                    variant="outline"
                    className={`px-3 py-1.5 text-xs font-medium ${tech.color}`}
                  >
                    {tech.name}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Features List ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-300 leading-relaxed">{feature}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Developer Section ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card glow-purple">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white mb-1">Built with AI by Z.ai</p>
                <p className="text-sm text-slate-400 max-w-md">
                  MarketLens AI was designed and developed with cutting-edge AI assistance,
                  showcasing the potential of AI-augmented software development.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-slate-300 hover:bg-white/5 gap-2"
                  onClick={() => window.open('https://github.com', '_blank')}
                >
                  <Github className="w-4 h-4" />
                  GitHub
                  <ExternalLink className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 text-slate-300 hover:bg-white/5 gap-2"
                  onClick={() => setActivePage('settings')}
                >
                  Settings
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}