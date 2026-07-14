'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { LiveMarketPage } from '@/components/market/live-market-page';
import { AIPredictionPage } from '@/components/prediction/ai-prediction-page';
import { TechnicalAnalysisPage } from '@/components/technical/technical-analysis-page';
import { NewsSentimentPage } from '@/components/news/news-sentiment-page';
import { ForecastPage } from '@/components/forecast/forecast-page';
import { PortfolioPage } from '@/components/portfolio/portfolio-page';
import { ReportsPage } from '@/components/reports/reports-page';
import { SettingsPage } from '@/components/settings/settings-page';
import { AboutPage } from '@/components/about/about-page';
import { useAppStore, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';

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
        className={cn(
          'px-2 py-0.5 rounded-full text-[10px] font-medium',
          isMarketHours
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        )}
      >
        {isMarketHours ? 'MARKET OPEN' : 'MARKET CLOSED'}
      </div>
    </div>
  );
}

export default function Home() {
  const { activePage, sidebarCollapsed } = useAppStore();
  const ActiveComponent = pageComponents[activePage];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
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
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <ActiveComponent />
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>
        </main>

        {/* Footer */}
        <footer className="h-10 border-t border-white/5 flex items-center justify-between px-6 text-[11px] text-slate-600 shrink-0 bg-[#0a0e1a]/80 backdrop-blur-xl mt-auto">
          <span>© 2025 MarketLens AI — Intelligent Stock Analytics</span>
          <span className="flex items-center gap-1">
            Powered by LSTM + FinBERT
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1 animate-pulse" />
          </span>
        </footer>
      </div>
    </div>
  );
}