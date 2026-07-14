'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { useAppStore, type PageId } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/shared/animated-counter';

const DashboardPage = dynamic(() => import('@/components/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })), { loading: () => <PageLoading />, ssr: false });
const LiveMarketPage = dynamic(() => import('@/components/market/live-market-page').then(m => ({ default: m.LiveMarketPage })), { loading: () => <PageLoading />, ssr: false });
const AIPredictionPage = dynamic(() => import('@/components/prediction/ai-prediction-page').then(m => ({ default: m.AIPredictionPage })), { loading: () => <PageLoading />, ssr: false });
const TechnicalAnalysisPage = dynamic(() => import('@/components/technical/technical-analysis-page').then(m => ({ default: m.TechnicalAnalysisPage })), { loading: () => <PageLoading />, ssr: false });
const NewsSentimentPage = dynamic(() => import('@/components/news/news-sentiment-page').then(m => ({ default: m.NewsSentimentPage })), { loading: () => <PageLoading />, ssr: false });
const ForecastPage = dynamic(() => import('@/components/forecast/forecast-page').then(m => ({ default: m.ForecastPage })), { loading: () => <PageLoading />, ssr: false });
const PortfolioPage = dynamic(() => import('@/components/portfolio/portfolio-page').then(m => ({ default: m.PortfolioPage })), { loading: () => <PageLoading />, ssr: false });
const ReportsPage = dynamic(() => import('@/components/reports/reports-page').then(m => ({ default: m.ReportsPage })), { loading: () => <PageLoading />, ssr: false });
const SettingsPage = dynamic(() => import('@/components/settings/settings-page').then(m => ({ default: m.SettingsPage })), { loading: () => <PageLoading />, ssr: false });
const AboutPage = dynamic(() => import('@/components/about/about-page').then(m => ({ default: m.AboutPage })), { loading: () => <PageLoading />, ssr: false });

const pageComponents: Record<PageId, React.ComponentType> = {
  'dashboard': DashboardPage,
  'live-market': LiveMarketPage,
  'ai-prediction': AIPredictionPage,
  'technical-analysis': TechnicalAnalysisPage,
  'news-sentiment': NewsSentimentPage,
  'forecast': ForecastPage,
  'portfolio': PortfolioPage,
  'reports': ReportsPage,
  'settings': SettingsPage,
  'about': AboutPage,
};

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size={48} label="Loading..." />
    </div>
  );
}

function MarketClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setTime(now.toLocaleTimeString('en-US', options));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const nyHour = parseInt(
    now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
  );
  const isMarketHours = isWeekday && nyHour >= 9 && nyHour < 16;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Wifi className="w-3 h-3" />
        <span>Live</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3 h-3" />
        <span>NYSE {time}</span>
      </div>
      <div
        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isMarketHours ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}
      >
        {isMarketHours ? 'MARKET OPEN' : 'MARKET CLOSED'}
      </div>
    </div>
  );
}

export default function Home() {
  const { activePage } = useAppStore();
  const ActiveComponent = pageComponents[activePage];

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-40 bg-[#0a0e1a]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-300 capitalize">
              {activePage.replace(/-/g, ' ')}
            </h2>
            <span className="text-[10px] text-slate-600 font-mono">v2.0.0</span>
          </div>
          <MarketClock />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: 'easeOut' as const }}
                >
                  <ActiveComponent />
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>
        </main>

        {/* Footer */}
        <footer className="h-10 border-t border-white/5 flex items-center justify-between px-6 text-[11px] text-slate-600 shrink-0 bg-[#0a0e1a]/80 backdrop-blur-xl">
          <span>&copy; 2025 MarketLens AI &mdash; Intelligent Stock Analytics</span>
          <span className="flex items-center gap-1">
            Powered by LSTM + FinBERT
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1 animate-pulse" />
          </span>
        </footer>
      </div>
    </div>
  );
}