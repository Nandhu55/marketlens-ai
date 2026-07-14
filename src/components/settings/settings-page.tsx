'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  PanelLeftClose,
  PanelLeft,
  Bell,
  BellOff,
  Database,
  BarChart3,
  Monitor,
  Sun,
  Moon,
  Save,
  Info,
  Check,
  Globe,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { STOCKS } from '@/lib/stock-utils';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

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

// ─── Indicator options ────────────────────────────────────────────────────────
const INDICATOR_OPTIONS = [
  { id: 'sma', label: 'SMA (Simple Moving Average)', description: 'Smooths price data to identify trends' },
  { id: 'ema', label: 'EMA (Exponential Moving Average)', description: 'Gives more weight to recent prices' },
  { id: 'rsi', label: 'RSI (Relative Strength Index)', description: 'Momentum oscillator (0-100)' },
  { id: 'macd', label: 'MACD', description: 'Moving average convergence/divergence' },
  { id: 'bollinger', label: 'Bollinger Bands', description: 'Volatility bands around moving average' },
  { id: 'atr', label: 'ATR (Average True Range)', description: 'Measures market volatility' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    isDarkMode,
    toggleDarkMode,
    setActivePage,
  } = useAppStore();

  // Local state
  const [defaultStock, setDefaultStock] = useState('AAPL');
  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    newsAlerts: true,
    predictionUpdates: false,
    weeklyReports: true,
  });
  const [chartPeriod, setChartPeriod] = useState('1M');
  const [indicators, setIndicators] = useState<Record<string, boolean>>({
    sma: true,
    ema: false,
    rsi: true,
    macd: true,
    bollinger: false,
    atr: false,
  });

  // Handle save
  const handleSave = useCallback(() => {
    toast.success('Settings saved successfully');
  }, []);

  // Toggle notification
  const toggleNotification = useCallback((key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Toggle indicator
  const toggleIndicator = useCallback((id: string) => {
    setIndicators((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Apply default stock
  const handleApplyDefaultStock = useCallback(() => {
    if (STOCKS[defaultStock]) {
      toast.success(`Default stock set to ${defaultStock}`);
    } else {
      toast.error('Invalid stock symbol');
    }
  }, [defaultStock]);

  return (
    <motion.div
      className="space-y-6 max-w-3xl"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Settings"
        subtitle="Customize your MarketLens AI experience"
      />

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Palette className="w-5 h-5 text-indigo-400" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Theme toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-200 font-medium flex items-center gap-2">
                  {isDarkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
                  Theme
                </Label>
                <p className="text-xs text-slate-500">Switch between dark and light mode</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{isDarkMode ? 'Dark' : 'Light'}</span>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={toggleDarkMode}
                  className="data-[state=checked]:bg-indigo-500"
                />
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Sidebar toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-200 font-medium flex items-center gap-2">
                  {sidebarCollapsed ? <PanelLeftClose className="w-4 h-4 text-purple-400" /> : <PanelLeft className="w-4 h-4 text-purple-400" />}
                  Sidebar Collapsed
                </Label>
                <p className="text-xs text-slate-500">Show compact sidebar to maximize chart area</p>
              </div>
              <Switch
                checked={sidebarCollapsed}
                onCheckedChange={setSidebarCollapsed}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Default Stock ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Globe className="w-5 h-5 text-cyan-400" />
              Default Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Set the default stock symbol that loads when you open the app.
            </p>
            <div className="flex gap-3">
              <Input
                value={defaultStock}
                onChange={(e) => setDefaultStock(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 max-w-[200px]"
              />
              <Button onClick={handleApplyDefaultStock} className="gradient-button gap-1.5">
                <Check className="w-4 h-4" />
                Apply
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOG', 'META'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => setDefaultStock(sym)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    defaultStock === sym
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/8'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Notification Preferences ───────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Bell className="w-5 h-5 text-emerald-400" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'priceAlerts' as const, label: 'Price Alerts', desc: 'Get notified when stocks hit target prices', icon: Zap },
              { key: 'newsAlerts' as const, label: 'News Alerts', desc: 'Breaking financial news for watchlist stocks', icon: BarChart3 },
              { key: 'predictionUpdates' as const, label: 'Prediction Updates', desc: 'Daily AI prediction summaries', icon: Monitor },
              { key: 'weeklyReports' as const, label: 'Weekly Reports', desc: 'Automated weekly portfolio & market reports', icon: Database },
            ].map((item, i) => (
              <div key={item.key}>
                {i > 0 && <Separator className="bg-white/5 mb-4" />}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-slate-200 font-medium flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-slate-400" />
                      {item.label}
                    </Label>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={() => toggleNotification(item.key)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Data Settings ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Database className="w-5 h-5 text-yellow-400" />
              Data Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Default chart period */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-200 font-medium">Default Chart Period</Label>
                <p className="text-xs text-slate-500">Default time range for stock charts</p>
              </div>
              <Select value={chartPeriod} onValueChange={setChartPeriod}>
                <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1M">1 Month</SelectItem>
                  <SelectItem value="3M">3 Months</SelectItem>
                  <SelectItem value="6M">6 Months</SelectItem>
                  <SelectItem value="1Y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-white/5" />

            {/* Technical indicators */}
            <div>
              <div className="mb-3">
                <Label className="text-sm text-slate-200 font-medium">Technical Indicators</Label>
                <p className="text-xs text-slate-500 mt-0.5">Choose which indicators to display on charts</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INDICATOR_OPTIONS.map((ind) => (
                  <div
                    key={ind.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${
                      indicators[ind.id]
                        ? 'bg-indigo-500/10 border border-indigo-500/20'
                        : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                    }`}
                    onClick={() => toggleIndicator(ind.id)}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-slate-200">{ind.label}</p>
                      <p className="text-[10px] text-slate-500">{ind.description}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ml-2 ${
                        indicators[ind.id] ? 'bg-indigo-500' : 'bg-white/10'
                      }`}
                    >
                      {indicators[ind.id] && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── About Link ─────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Info className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">About MarketLens AI</p>
                  <p className="text-xs text-slate-500">Version 2.0.0 • Learn about the architecture & team</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-white/10 text-slate-300 hover:bg-white/5"
                onClick={() => setActivePage('about')}
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Save Button ────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button onClick={handleSave} className="gradient-button gap-2 px-8">
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </motion.div>
    </motion.div>
  );
}