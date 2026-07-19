'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { KNOWN_SYMBOLS, formatPrice } from '@/lib/stock-utils';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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

// ─── Alert type options ───────────────────────────────────────────────────────
const ALERT_TYPES = [
  { id: 'above', label: 'Price Above', description: 'Trigger when price goes above target' },
  { id: 'below', label: 'Price Below', description: 'Trigger when price drops below target' },
  { id: 'change_above', label: 'Change Above %', description: 'Trigger when daily change exceeds %' },
  { id: 'change_below', label: 'Change Below %', description: 'Trigger when daily change drops below %' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function AlertsPage() {
  const { alerts, addAlert, removeAlert } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState('AAPL');
  const [alertType, setAlertType] = useState('above');
  const [alertValue, setAlertValue] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showTriggered, setShowTriggered] = useState(true);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (showTriggered) return alerts;
    return alerts.filter((a) => !a.triggered);
  }, [alerts, showTriggered]);

  const activeAlerts = alerts.filter((a) => !a.triggered).length;
  const triggeredAlerts = alerts.filter((a) => a.triggered).length;

  // Autocomplete
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return [];
    return KNOWN_SYMBOLS
      .filter((s) => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase()))
      .slice(0, 5);
  }, [symbolSearch]);

  // Create alert
  const handleCreateAlert = useCallback(() => {
    const val = parseFloat(alertValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Enter a valid value');
      return;
    }

    const typeLabel = ALERT_TYPES.find((t) => t.id === alertType)?.label || alertType;
    const newAlert = {
      id: Date.now().toString(),
      symbol: alertSymbol.toUpperCase(),
      type: typeLabel,
      value: val,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    addAlert(newAlert);
    setAlertValue('');
    setDialogOpen(false);
    toast.success(`Alert created for ${alertSymbol.toUpperCase()}`);
  }, [alertSymbol, alertType, alertValue, addAlert]);

  // Remove alert
  const handleRemove = useCallback((id: string) => {
    removeAlert(id);
    toast.success('Alert removed');
  }, [removeAlert]);

  // Get icon for alert type
  const getAlertIcon = (type: string, triggered: boolean) => {
    if (triggered) return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (type.includes('Above')) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (type.includes('Below')) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  };

  // Get type description
  const getAlertDescription = (alert: { type: string; value: number; triggered: boolean }) => {
    if (alert.type === 'Price Above') return `Triggers when price goes above $${formatPrice(alert.value)}`;
    if (alert.type === 'Price Below') return `Triggers when price drops below $${formatPrice(alert.value)}`;
    if (alert.type === 'Change Above %') return `Triggers when daily change exceeds ${alert.value}%`;
    if (alert.type === 'Change Below %') return `Triggers when daily change drops below ${alert.value}%`;
    return `${alert.type}: ${alert.value}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Price Alerts"
        subtitle="Create and manage custom price alerts for your watchlist"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-button gap-2">
                <Plus className="w-4 h-4" />
                Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card !bg-slate-900/95 border-white/10 sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  Create Price Alert
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Symbol */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Stock Symbol</Label>
                  <div className="relative">
                    <Input
                      value={alertSymbol}
                      onChange={(e) => {
                        setAlertSymbol(e.target.value);
                        setSymbolSearch(e.target.value);
                      }}
                      placeholder="e.g. AAPL"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                    {filteredSymbols.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-slate-800/95 backdrop-blur-lg border border-white/10 shadow-xl overflow-hidden">
                        {filteredSymbols.map((s) => (
                          <button
                            key={s.symbol}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex justify-between items-center transition-colors"
                            onClick={() => {
                              setAlertSymbol(s.symbol);
                              setSymbolSearch('');
                            }}
                          >
                            <span className="text-white font-medium">{s.symbol}</span>
                            <span className="text-slate-400 text-xs">{s.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alert Type */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Alert Type</Label>
                  <Select value={alertType} onValueChange={setAlertType}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex flex-col">
                            <span>{t.label}</span>
                            <span className="text-[10px] text-slate-500">{t.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">
                    {alertType.includes('change') ? 'Threshold (%)' : 'Target Price ($)'}
                  </Label>
                  <Input
                    type="number"
                    value={alertValue}
                    onChange={(e) => setAlertValue(e.target.value)}
                    placeholder={alertType.includes('change') ? 'e.g. 5' : 'e.g. 200.00'}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <DialogClose asChild>
                  <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
                    Cancel
                  </Button>
                </DialogClose>
                <Button onClick={handleCreateAlert} className="gradient-button">
                  Create Alert
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 glow-blue">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Alerts</span>
          </div>
          <p className="text-2xl font-bold text-white">{alerts.length}</p>
        </div>

        <div className="glass-card p-4 glow-cyan">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <BellOff className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeAlerts}</p>
        </div>

        <div className="glass-card p-4 glow-green">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Triggered</span>
          </div>
          <p className="text-2xl font-bold text-white">{triggeredAlerts}</p>
        </div>
      </motion.div>

      {/* ── Alerts List ───────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Bell className="w-5 h-5 text-indigo-400" />
                Alert List
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500">Show triggered</Label>
                <Switch
                  checked={showTriggered}
                  onCheckedChange={setShowTriggered}
                  className="data-[state=checked]:bg-indigo-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredAlerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                        alert.triggered
                          ? 'bg-emerald-500/5 border-emerald-500/10'
                          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="shrink-0">
                        {getAlertIcon(alert.type, alert.triggered)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">{alert.symbol}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              alert.triggered
                                ? 'border-emerald-500/30 text-emerald-400'
                                : 'border-white/10 text-slate-400'
                            }`}
                          >
                            {alert.triggered ? 'TRIGGERED' : 'ACTIVE'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          {alert.type}: {alert.type.includes('%') ? `${alert.value}%` : `$${formatPrice(alert.value)}`}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {getAlertDescription(alert)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-600">{formatDate(alert.createdAt)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                        onClick={() => handleRemove(alert.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {alerts.length === 0 && (
                  <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
                    <Bell className="w-10 h-10 text-slate-600" />
                    <p className="text-sm">No alerts created yet</p>
                    <p className="text-xs text-slate-600">Click &quot;Create Alert&quot; to set up your first price alert</p>
                  </div>
                )}

                {alerts.length > 0 && filteredAlerts.length === 0 && (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
                    <BellOff className="w-10 h-10 text-slate-600" />
                    <p className="text-sm">No active alerts to display</p>
                    <p className="text-xs text-slate-600">Toggle &quot;Show triggered&quot; to see triggered alerts</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}