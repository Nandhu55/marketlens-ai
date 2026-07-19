'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  Search,
  Loader2,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { formatPrice, formatPercent, formatNumber, getChangeColor } from '@/lib/stock-utils';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
interface ScreenedStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  rsi?: number;
  macd?: number;
  hasRealData: boolean;
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'volume' | 'marketCap' | 'pe' | 'rsi';

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

// ─── Unique sectors from KNOWN_SYMBOLS ────────────────────────────────────────
const SECTORS = [
  'Technology',
  'Semiconductors',
  'Automotive',
  'Consumer Cyclical',
  'IT Services',
  'Financial Services',
  'Consumer Staples',
  'Healthcare',
  'Communication',
  'Conglomerate',
];

// ─── Component ────────────────────────────────────────────────────────────────
export function ScreenerPage() {
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sector, setSector] = useState('all');
  const [minRSI, setMinRSI] = useState('');
  const [maxRSI, setMaxRSI] = useState('');
  const [results, setResults] = useState<ScreenedStock[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [sortField, setSortField] = useState<SortField>('marketCap');
  const [sortAsc, setSortAsc] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Run screener
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setErrorMsg(null);
    setHasScanned(false);

    try {
      const params = new URLSearchParams();
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (sector && sector !== 'all') params.set('sector', sector);
      if (minRSI) params.set('minRSI', minRSI);
      if (maxRSI) params.set('maxRSI', maxRSI);

      const res = await fetch(`/api/screener?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        toast.error(data.error);
      } else {
        setResults(data.results || []);
        toast.success(`Found ${data.total || 0} stocks matching criteria`);
      }
    } catch {
      setErrorMsg('Screener service unavailable. Please try again.');
      toast.error('Failed to run screener');
    } finally {
      setIsScanning(false);
      setHasScanned(true);
    }
  }, [minPrice, maxPrice, sector, minRSI, maxRSI]);

  // Sort results
  const sortedResults = (() => {
    const arr = [...results];
    arr.sort((a, b) => {
      const aVal = (a[sortField] as number) || 0;
      const bVal = (b[sortField] as number) || 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return arr;
  })();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortIndicator = (field: SortField) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 inline ${sortField === field ? 'text-indigo-400' : 'text-slate-600'}`} />
  );

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSector('all');
    setMinRSI('');
    setMaxRSI('');
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="Stock Screener"
        subtitle="Filter and scan stocks based on real-time data"
      />

      {/* ── Filter Controls ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              Filter Criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Min Price ($)</Label>
                <Input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Max Price ($)</Label>
                <Input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="99999"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sectors</SelectItem>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Min RSI</Label>
                <Input
                  type="number"
                  value={minRSI}
                  onChange={(e) => setMinRSI(e.target.value)}
                  placeholder="0"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Max RSI</Label>
                <Input
                  type="number"
                  value={maxRSI}
                  onChange={(e) => setMaxRSI(e.target.value)}
                  placeholder="100"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleScan}
                disabled={isScanning}
                className="gradient-button gap-2"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isScanning ? 'Scanning...' : 'Scan Stocks'}
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="border-white/10 text-slate-300 hover:bg-white/5"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Filter className="w-5 h-5 text-cyan-400" />
              Results
              {hasScanned && (
                <Badge variant="outline" className="ml-2 border-white/10 text-slate-400 text-[10px]">
                  {results.length} stocks
                </Badge>
              )}
              {isScanning && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-2" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasScanned && !isScanning && (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
                <Activity className="w-10 h-10 text-slate-600" />
                <p className="text-sm">Configure filters and click &quot;Scan Stocks&quot; to search</p>
              </div>
            )}

            {errorMsg && !isScanning && (
              <div className="py-12 flex flex-col items-center gap-3 text-amber-400">
                <AlertCircle className="w-10 h-10" />
                <p className="text-sm text-center max-w-md">{errorMsg}</p>
              </div>
            )}

            {hasScanned && !errorMsg && results.length === 0 && (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
                <Filter className="w-10 h-10 text-slate-600" />
                <p className="text-sm">No stocks matched your criteria. Try adjusting the filters.</p>
              </div>
            )}

            {results.length > 0 && (
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-slate-400 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort('symbol')}>
                        Symbol {sortIndicator('symbol')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs hidden md:table-cell">Name</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs hidden lg:table-cell">Sector</TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('price')}>
                        Price {sortIndicator('price')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none" onClick={() => handleSort('changePercent')}>
                        Change {sortIndicator('changePercent')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none hidden sm:table-cell" onClick={() => handleSort('volume')}>
                        Volume {sortIndicator('volume')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('marketCap')}>
                        Mkt Cap {sortIndicator('marketCap')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort('pe')}>
                        P/E {sortIndicator('pe')}
                      </TableHead>
                      <TableHead className="text-slate-400 font-medium text-xs text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort('rsi')}>
                        RSI {sortIndicator('rsi')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {sortedResults.map((stock, idx) => (
                        <motion.tr
                          key={stock.symbol}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <TableCell className="text-sm font-semibold text-white">{stock.symbol}</TableCell>
                          <TableCell className="text-sm text-slate-400 hidden md:table-cell">{stock.name}</TableCell>
                          <TableCell className="text-xs text-slate-500 hidden lg:table-cell">
                            <Badge variant="outline" className="border-white/5 text-slate-400 text-[10px]">
                              {stock.sector}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-white font-medium text-right">${formatPrice(stock.price)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-sm font-semibold ${getChangeColor(stock.changePercent)}`}>
                                {formatPercent(stock.changePercent)}
                              </span>
                              <span className={`text-[10px] ${getChangeColor(stock.change)}`}>
                                {stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-300 text-right hidden sm:table-cell">{formatNumber(stock.volume)}</TableCell>
                          <TableCell className="text-sm text-slate-300 text-right hidden md:table-cell">${formatNumber(stock.marketCap)}</TableCell>
                          <TableCell className="text-sm text-slate-300 text-right hidden lg:table-cell">
                            {stock.pe > 0 ? stock.pe.toFixed(1) : '—'}
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            {stock.rsi !== undefined ? (
                              <span className={`text-sm font-medium ${stock.rsi > 70 ? 'text-red-400' : stock.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
                                {stock.rsi.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}