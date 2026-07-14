'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  Area,
} from 'recharts';
import {
  Briefcase,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react';
import { STOCKS, formatPrice, formatPercent, formatNumber, getChangeColor } from '@/lib/stock-utils';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
}

type SortKey = 'symbol' | 'quantity' | 'buyPrice' | 'currentPrice' | 'currentValue' | 'pl' | 'plPercent';

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

// ─── Pre-populated holdings ───────────────────────────────────────────────────
const INITIAL_HOLDINGS: Holding[] = [
  { id: '1', symbol: 'AAPL', quantity: 50, buyPrice: 175.20 },
  { id: '2', symbol: 'NVDA', quantity: 100, buyPrice: 85.40 },
  { id: '3', symbol: 'MSFT', quantity: 25, buyPrice: 380.00 },
  { id: '4', symbol: 'GOOG', quantity: 40, buyPrice: 155.60 },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_HOLDINGS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');

  // Computed portfolio metrics
  const portfolioData = useMemo(() => {
    return holdings.map((h) => {
      const stock = STOCKS[h.symbol];
      const currentPrice = stock?.price || 0;
      const buyValue = h.quantity * h.buyPrice;
      const currentValue = h.quantity * currentPrice;
      const pl = currentValue - buyValue;
      const plPercent = buyValue > 0 ? (pl / buyValue) * 100 : 0;
      return { ...h, currentPrice, buyValue, currentValue, pl, plPercent, name: stock?.name || h.symbol };
    });
  }, [holdings]);

  const summary = useMemo(() => {
    const totalInvestment = portfolioData.reduce((s, h) => s + h.buyValue, 0);
    const currentValue = portfolioData.reduce((s, h) => s + h.currentValue, 0);
    const totalPL = currentValue - totalInvestment;
    const returnPct = totalInvestment > 0 ? (totalPL / totalInvestment) * 100 : 0;
    return { totalInvestment, currentValue, totalPL, returnPct };
  }, [portfolioData]);

  const sortedData = useMemo(() => {
    const arr = [...portfolioData];
    arr.sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return arr;
  }, [portfolioData, sortKey, sortAsc]);

  // Allocation pie data
  const allocationData = useMemo(() => {
    return portfolioData.map((h) => ({
      name: h.symbol,
      value: h.currentValue,
      color:
        h.symbol === 'AAPL' ? '#6366f1'
        : h.symbol === 'NVDA' ? '#06b6d4'
        : h.symbol === 'MSFT' ? '#8b5cf6'
        : h.symbol === 'GOOG' ? '#10b981'
        : h.symbol === 'TSLA' ? '#f59e0b'
        : h.symbol === 'META' ? '#ec4899'
        : '#64748b',
    }));
  }, [portfolioData]);

  // Portfolio performance history (mock)
  const performanceData = useMemo(() => {
    const days = 60;
    const data: { date: string; value: number }[] = [];
    const baseValue = summary.totalInvestment * 0.88;
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const progress = (days - i) / days;
      const noise = Math.sin(i * 0.5) * 0.03 + Math.sin(i * 1.3) * 0.02;
      const value = baseValue * (1 + progress * ((summary.currentValue / baseValue - 1)) + noise);
      data.push({
        date: d.toISOString().split('T')[0],
        value: parseFloat(value.toFixed(2)),
      });
    }
    return data;
  }, [summary.totalInvestment, summary.currentValue]);

  // Add stock
  const handleAdd = useCallback(() => {
    const sym = newSymbol.toUpperCase().trim();
    if (!STOCKS[sym]) {
      toast.error('Invalid stock symbol');
      return;
    }
    const qty = parseFloat(newQuantity);
    const price = parseFloat(newBuyPrice);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid buying price');
      return;
    }
    setHoldings((prev) => [
      ...prev,
      { id: Date.now().toString(), symbol: sym, quantity: qty, buyPrice: price },
    ]);
    setNewSymbol('');
    setNewQuantity('');
    setNewBuyPrice('');
    setDialogOpen(false);
    toast.success(`${sym} added to portfolio`);
  }, [newSymbol, newQuantity, newBuyPrice]);

  // Remove stock
  const handleRemove = useCallback((id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
    toast.success('Holding removed');
  }, []);

  // Sort handler
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(false);
      }
    },
    [sortKey, sortAsc]
  );

  // Autocomplete
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return [];
    return Object.values(STOCKS)
      .filter((s) => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase()))
      .slice(0, 5);
  }, [symbolSearch]);

  const sortIndicator = (field: SortKey) => (
    <span className="ml-1 text-[10px]">
      {sortKey === field ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Portfolio"
        subtitle="Track and manage your stock holdings"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-button gap-2">
                <Plus className="w-4 h-4" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card !bg-slate-900/95 border-white/10 sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-400" />
                  Add to Portfolio
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Symbol input with autocomplete */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Stock Symbol</Label>
                  <div className="relative">
                    <Input
                      value={newSymbol}
                      onChange={(e) => {
                        setNewSymbol(e.target.value);
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
                              setNewSymbol(s.symbol);
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
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Quantity</Label>
                  <Input
                    type="number"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="e.g. 50"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Buying Price ($)</Label>
                  <Input
                    type="number"
                    value={newBuyPrice}
                    onChange={(e) => setNewBuyPrice(e.target.value)}
                    placeholder="e.g. 175.00"
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
                <Button onClick={handleAdd} className="gradient-button">
                  Add Holding
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 glow-blue">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Investment</span>
          </div>
          <p className="text-xl font-bold text-white">${formatNumber(summary.totalInvestment)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 glow-cyan">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Current Value</span>
          </div>
          <p className="text-xl font-bold text-white">${formatNumber(summary.currentValue)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`glass-card p-4 ${summary.totalPL >= 0 ? 'glow-green' : 'glow-red'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${summary.totalPL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {summary.totalPL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total P/L</span>
          </div>
          <p className={`text-xl font-bold ${getChangeColor(summary.totalPL)}`}>
            {summary.totalPL >= 0 ? '+' : ''}${formatNumber(summary.totalPL)}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={`glass-card p-4 ${summary.returnPct >= 0 ? 'glow-green' : 'glow-red'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${summary.returnPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {summary.returnPct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Portfolio Return</span>
          </div>
          <p className={`text-xl font-bold ${getChangeColor(summary.returnPct)}`}>
            {formatPercent(summary.returnPct)}
          </p>
        </motion.div>
      </motion.div>

      {/* ── Holdings Table + Allocation ────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <Card className="glass-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              Holdings
              <Badge variant="outline" className="ml-2 border-white/10 text-slate-400 text-[10px]">
                {holdings.length} stocks
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort('symbol')}>
                      Symbol {sortIndicator('symbol')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs hidden sm:table-cell">Name</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('quantity')}>
                      Qty {sortIndicator('quantity')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('buyPrice')}>
                      Buy Price {sortIndicator('buyPrice')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('currentPrice')}>
                      Current {sortIndicator('currentPrice')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('currentValue')}>
                      Value {sortIndicator('currentValue')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('pl')}>
                      P/L {sortIndicator('pl')}
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedData.map((h) => (
                      <motion.tr
                        key={h.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <TableCell className="text-sm font-semibold text-white">{h.symbol}</TableCell>
                        <TableCell className="text-sm text-slate-400 hidden sm:table-cell">{h.name}</TableCell>
                        <TableCell className="text-sm text-slate-300 text-right">{h.quantity}</TableCell>
                        <TableCell className="text-sm text-slate-300 text-right">${formatPrice(h.buyPrice)}</TableCell>
                        <TableCell className="text-sm text-white font-medium text-right">${formatPrice(h.currentPrice)}</TableCell>
                        <TableCell className="text-sm text-slate-300 text-right hidden md:table-cell">${formatNumber(h.currentValue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={`text-sm font-semibold ${getChangeColor(h.pl)}`}>
                              {h.pl >= 0 ? '+' : ''}${formatNumber(h.pl)}
                            </span>
                            <span className={`text-[11px] ${getChangeColor(h.plPercent)}`}>
                              {formatPercent(h.plPercent)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleRemove(h.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Allocation Pie */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <PieChartIcon className="w-5 h-5 text-purple-400" />
              Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {allocationData.map((entry, idx) => (
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
                    formatter={(value: number) => [`$${formatNumber(value)}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {allocationData.map((d) => {
                const pct = summary.currentValue > 0 ? ((d.value / summary.currentValue) * 100).toFixed(1) : '0';
                return (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-300 font-medium">{d.name}</span>
                    </div>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Performance Chart ──────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Portfolio Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${formatNumber(value)}`, 'Value']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#perfGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}