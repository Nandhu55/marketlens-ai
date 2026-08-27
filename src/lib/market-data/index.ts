// Market Data — Public API
// Import from '@/lib/market-data' to access all market-data functionality.

export type {
  MarketQuote,
  OHLCVCandle,
  CandleInterval,
  ProviderStatus,
  ProviderResult,
  MarketDataError,
  MarketDataProvider,
} from './types';

export {
  isIndianSymbol,
  getIndianSymbolMapping,
  getInstrumentKey,
  getAllIndianSymbols,
  type SymbolMappingEntry,
} from './symbol-mapping';

export { getIndianMarketStatus } from './indian-market-status';

export {
  getMarketDataProviderStatus,
  fetchQuote,
  fetchOHLCV,
  isMarketDataError,
} from './market-service';

export { upstoxProvider } from './upstox-provider';
