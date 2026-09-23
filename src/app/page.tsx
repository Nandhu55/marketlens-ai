'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { useAppStore, type PageId } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Wifi, Radio, WifiOff, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/shared/animated-counter';
import { useLiveMarket } from '@/hooks/use-live-market';

const DashboardPage = dynamic(() => import('@/components/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })), { loading: () => <PageLoading />, ssr: false });
const LiveMarketPage = dynamic(() => import('@/components/market/live-market-page').then(m => ({ default: m.LiveMarketPage })), { loading: () => <PageLoading />, ssr: false });
const AIPredictionPage = dynamic(() => import('@/components/prediction/ai-prediction-page').then(m => ({ default: m.AIPredictionPage })), { loading: () => <PageLoading />, ssr: false });
const TechnicalAnalysisPage = dynamic(() => import('@/components/technical/technical-analysis-page').then(m => ({ default: m.TechnicalAnalysisPage })), { loading: () => <PageLoading />, ssr: false });
const NewsSentimentPage = dynamic(() => import('@/components/news/news-sentiment-page').then(m => ({ default: m.NewsSentimentPage })), { loading: () => <PageLoading />, ssr: false });
const ForecastPage = dynamic(() => import('@/components/forecast/forecast-page').then(m => ({ default: m.ForecastPage })), { loading: () => <PageLoading />, ssr: false });
const PortfolioPage = dynamic(() => import('@/components/portfolio/portfolio-page').then(m => ({ default: m.PortfolioPage })), { loading: () => <PageLoading />, ssr: false });
const ScreenerPage = dynamic(() => import('@/components/screener/screener-page').then(m => ({ default: m.ScreenerPage })), { loading: () => <PageLoading />, ssr: false });
const AIAssistantPage = dynamic(() => import('@/components/ai-assistant/ai-assistant-page').then(m => ({ default: m.AIAssistantPage })), { loading: () => <PageLoading />, ssr: false });
const AlertsPage = dynamic(() => import('@/components/alerts/alerts-page').then(m => ({ default: m.AlertsPage })), { loading: () => <PageLoading />, ssr: false });
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
  'screener': ScreenerPage,
  'ai-assistant': AIAssistantPage,
  'alerts': AlertsPage,
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
  const { wsConnectionStatus, usWsConnectionStatus, liveTicks, staleSymbols, subscribedWsSymbols } = useAppStore();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
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

  // NSE market hours: 9:15 AM – 3:30 PM IST, Mon–Fri
  const now = new Date();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const istHourMin = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [istH, istM] = istHourMin.split(':').map(Number);
  const istTotalMin = istH * 60 + istM;
  const nseOpen = 9 * 60 + 15;
  const nseClose = 15 * 60 + 30;
  const isMarketHours = isWeekday && istTotalMin >= nseOpen && istTotalMin <= nseClose;

  // Determine live data status truthfully (check both India and US)
  const hasLiveTicks = subscribedWsSymbols.length > 0 &&
    subscribedWsSymbols.some((s) => liveTicks[s] && !staleSymbols.includes(s));
  const indiaLive = wsConnectionStatus === 'CONNECTED' && hasLiveTicks;
  const usLive = usWsConnectionStatus === 'CONNECTED' && hasLiveTicks;

  // Status label helper
  function wsStatusLabel(status: string, provider: string) {
    if (status === 'CONNECTED') return <span className="text-emerald-400 font-semibold">LIVE</span>;
    if (status === 'CONNECTING' || status === 'RECONNECTING') return <span className="text-amber-400">Connecting</span>;
    if (status === 'ERROR') return <span className="text-red-400">Error</span>;
    return <span className="text-slate-500">OFF</span>;
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* India (Upstox) WebSocket Status */}
      <div className="flex items-center gap-1">
        {indiaLive ? <Radio className="w-3 h-3 animate-pulse text-emerald-400" /> : <Wifi className="w-3 h-3 text-slate-500" />}
        <span className="text-[9px] text-slate-500">IN:</span>
        {wsStatusLabel(wsConnectionStatus, 'upstox')}
      </div>
      {/* US (Finnhub) WebSocket Status */}
      <div className="flex items-center gap-1">
        {usLive ? <Radio className="w-3 h-3 animate-pulse text-emerald-400" /> : <Wifi className="w-3 h-3 text-slate-500" />}
        <span className="text-[9px] text-slate-500">US:</span>
        {wsStatusLabel(usWsConnectionStatus, 'finnhub')}
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3 h-3" />
        <span>NSE {time}</span>
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
  const { activePage, setRealQuotes, setMarketOverview, setIsLive, isLive, liveTicks, wsConnectionStatus, usWsConnectionStatus } = useAppStore();
  const ActiveComponent = pageComponents[activePage];

  // Initialize WebSocket connection to price-streamer
  useLiveMarket();

  // Fetch real-time market data on mount (REST — initial data)
  const fetchMarketData = useCallback(async () => {
    try {
      const res = await fetch('/api/market-overview');
      const data = await res.json();
      if (data.success && data.hasRealData) {
        setRealQuotes(data.quotes || {});
        if (data.overview) {
          setMarketOverview({
            fearGreedIndex: data.overview.fearGreedIndex,
            marketTrend: data.overview.marketTrend,
            topGainers: data.overview.topGainers,
            topLosers: data.overview.topLosers,
          });
        }
        setIsLive(true);
      }
    } catch (err) {
      console.error('Market data fetch failed:', err);
    }
  }, [setRealQuotes, setMarketOverview, setIsLive]);

  useEffect(() => {
    fetchMarketData();
    // Refresh every 5 minutes (REST fallback for overview data)
    const interval = setInterval(fetchMarketData, 300_000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Determine effective isLive: REST data OR WebSocket connected with live ticks
  const indiaWsLive = wsConnectionStatus === 'CONNECTED' && Object.keys(liveTicks).some(k => liveTicks[k]?.source === 'upstox');
  const usWsLive = usWsConnectionStatus === 'CONNECTED' && Object.keys(liveTicks).some(k => liveTicks[k]?.source === 'finnhub');
  const hasWsLive = indiaWsLive || usWsLive;
  const effectiveLive = isLive || hasWsLive;

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
            <span className="text-[10px] text-slate-600 font-mono">v3.1.0</span>
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
            {effectiveLive ? (
              <>
                {indiaWsLive && usWsLive ? 'Live: Upstox WS + Finnhub WS'
                  : indiaWsLive ? 'Live: Upstox WS (India)'
                  : usWsLive ? 'Live: Finnhub WS (US)'
                  : 'Real-time via Market APIs'}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1 animate-pulse" />
              </>
            ) : (
              'Connecting...'
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}
