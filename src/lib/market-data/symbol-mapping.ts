// Centralized Indian Symbol → Upstox Instrument Key mapping
// Extends the existing KNOWN_SYMBOLS in stock-utils.ts with Upstox-specific metadata.
// Do NOT duplicate the full symbol list — extend where needed.

export type SymbolMappingEntry = {
  symbol: string;
  name: string;
  exchange: string;       // NSE, BSE
  instrumentKey: string;   // Upstox instrument key
  instrumentType: 'EQ' | 'INDEX';
  sector?: string;
  isin?: string;
};

/**
 * Master mapping for Indian symbols supported by the Upstox provider.
 * Instrument keys are stable (based on ISIN for equities, fixed names for indices).
 *
 * Format:  NSE_EQ|{ISIN}  for stocks
 *          NSE_INDEX|{Name}  for indices
 */
export const INDIAN_SYMBOL_MAP: Record<string, SymbolMappingEntry> = {
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE002A01018',
    instrumentType: 'EQ',
    sector: 'Conglomerate',
    isin: 'INE002A01018',
  },
  TCS: {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE467B01029',
    instrumentType: 'EQ',
    sector: 'IT Services',
    isin: 'INE467B01029',
  },
  INFY: {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE009A01021',
    instrumentType: 'EQ',
    sector: 'IT Services',
    isin: 'INE009A01021',
  },
  HDFCBANK: {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE040A01034',
    instrumentType: 'EQ',
    sector: 'Banking',
    isin: 'INE040A01034',
  },
  ICICIBANK: {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE090A01021',
    instrumentType: 'EQ',
    sector: 'Banking',
    isin: 'INE090A01021',
  },
  SBIN: {
    symbol: 'SBIN',
    name: 'State Bank of India',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE062A01020',
    instrumentType: 'EQ',
    sector: 'Banking',
    isin: 'INE062A01020',
  },
  WIPRO: {
    symbol: 'WIPRO',
    name: 'Wipro Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE075A01022',
    instrumentType: 'EQ',
    sector: 'IT Services',
    isin: 'INE075A01022',
  },
  ITC: {
    symbol: 'ITC',
    name: 'ITC Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE154A01025',
    instrumentType: 'EQ',
    sector: 'FMCG',
    isin: 'INE154A01025',
  },
  BHARTIARTL: {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE397D01024',
    instrumentType: 'EQ',
    sector: 'Telecom',
    isin: 'INE397D01024',
  },
  HINDUNILVR: {
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE030A01027',
    instrumentType: 'EQ',
    sector: 'FMCG',
    isin: 'INE030A01027',
  },
  KOTAKBANK: {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE237A01028',
    instrumentType: 'EQ',
    sector: 'Banking',
    isin: 'INE237A01028',
    // NOTE: Official ISIN (INE237A01028, valid check digit) is not recognised by
    // the Upstox V2 historical-candle endpoint. Quote endpoint returns empty data.
    // Retained for future correction when Upstox adds this instrument.
  },
  LT: {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE018A01030',
    instrumentType: 'EQ',
    sector: 'Infrastructure',
    isin: 'INE018A01030',
  },
  AXISBANK: {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE238A01034',
    instrumentType: 'EQ',
    sector: 'Banking',
    isin: 'INE238A01034',
  },
  HCLTECH: {
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE860A01027',
    instrumentType: 'EQ',
    sector: 'IT Services',
    isin: 'INE860A01027',
  },
  BAJFINANCE: {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE296A01024',
    instrumentType: 'EQ',
    sector: 'Financial Services',
    isin: 'INE296A01024',
    // NOTE: Official ISIN (INE296A01024, from Wikipedia) is not recognised by
    // the Upstox V2 historical-candle endpoint. Quote endpoint returns empty data.
    // Retained for future correction when Upstox adds this instrument.
  },
  MARUTI: {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE585B01010',
    instrumentType: 'EQ',
    sector: 'Automotive',
    isin: 'INE585B01010',
  },
  ASIANPAINT: {
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE021A01026',
    instrumentType: 'EQ',
    sector: 'Consumer Goods',
    isin: 'INE021A01026',
  },
  SUNPHARMA: {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE044A01036',
    instrumentType: 'EQ',
    sector: 'Pharma',
    isin: 'INE044A01036',
  },
  TATAMOTORS: {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE155A01022',
    instrumentType: 'EQ',
    sector: 'Automotive',
    isin: 'INE155A01022',
  },
  POWERGRID: {
    symbol: 'POWERGRID',
    name: 'Power Grid Corporation of India Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE752E01010',
    instrumentType: 'EQ',
    sector: 'Power',
    isin: 'INE752E01010',
  },
  ADANIENT: {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE423A01024',
    instrumentType: 'EQ',
    sector: 'Conglomerate',
    isin: 'INE423A01024',
  },
  TITAN: {
    symbol: 'TITAN',
    name: 'Titan Company Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE280A01028',
    instrumentType: 'EQ',
    sector: 'Consumer Goods',
    isin: 'INE280A01028',
  },
  NIFTY: {
    symbol: 'NIFTY',
    name: 'Nifty 50',
    exchange: 'NSE',
    instrumentKey: 'NSE_INDEX|Nifty 50',
    instrumentType: 'INDEX',
    sector: 'Index',
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank',
    exchange: 'NSE',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    instrumentType: 'INDEX',
    sector: 'Index',
  },
};

/** Check whether a symbol is known to be an Indian market symbol. */
export function isIndianSymbol(symbol: string): boolean {
  return symbol.toUpperCase() in INDIAN_SYMBOL_MAP;
}

/** Get the mapping entry for an Indian symbol, or null. */
export function getIndianSymbolMapping(symbol: string): SymbolMappingEntry | null {
  return INDIAN_SYMBOL_MAP[symbol.toUpperCase()] || null;
}

/** Get the Upstox instrument key for an Indian symbol, or null. */
export function getInstrumentKey(symbol: string): string | null {
  return INDIAN_SYMBOL_MAP[symbol.toUpperCase()]?.instrumentKey || null;
}

/** Get all known Indian symbols as a flat array (for autocomplete/search). */
export function getAllIndianSymbols(): SymbolMappingEntry[] {
  return Object.values(INDIAN_SYMBOL_MAP);
}
