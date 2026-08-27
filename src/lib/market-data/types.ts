// Market Data — Normalized Types
// Single source of truth for all market data structures.

/** Normalized market quote returned by any provider. */
export type MarketQuote = {
  symbol: string;
  exchange: string;
  market: 'IN' | 'US';
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  timestamp: string;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  source: string;
};

/** Normalized OHLCV candle. */
export type OHLCVCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Supported candle intervals. */
export type CandleInterval = '1minute' | '5minute' | '15minute' | '30minute' | '1day' | '1week' | '1month';

/** Provider health status. */
export type ProviderStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTED'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'NO_DATA';

/** Result wrapper with provider metadata. */
export type ProviderResult<T> = {
  data: T;
  source: string;
  dataStatus: 'LIVE' | 'HISTORICAL' | 'UNAVAILABLE';
  timestamp: string;
};

/** Error from a market-data provider. */
export type MarketDataError = {
  code: ProviderStatus;
  message: string;
  symbol?: string;
  provider?: string;
};

/** Market-data provider interface — allows future providers (Twelve Data, etc.). */
export type MarketDataProvider = {
  readonly name: string;
  readonly supportedMarkets: ('IN' | 'US')[];
  getStatus(): Promise<ProviderStatus>;
  getQuote(symbol: string): Promise<MarketQuote | MarketDataError>;
  getHistoricalOHLCV(symbol: string, days: number): Promise<OHLCVCandle[] | MarketDataError>;
};
