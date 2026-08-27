import { Server } from 'socket.io';

const PORT = 3003;
const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const SYMBOLS = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOG', 'META', 'AMZN', 'JPM', 'V', 'NFLX'];

// Track latest quotes from the main app
interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: string;
}

const quotes: Record<string, LiveQuote> = {};

// Health check endpoint
io.on('connection', (socket) => {
  console.log(`[Streamer] Client connected: ${socket.id}`);
  const clientSymbols = new Set<string>();

  // Send current state on connect
  socket.emit('quotes', quotes);

  // Client subscribes to specific symbols
  socket.on('subscribe', (symbols: string[]) => {
    symbols.forEach((s) => clientSymbols.add(s.toUpperCase()));
    // Send current quotes for subscribed symbols
    const subQuotes: Record<string, LiveQuote> = {};
    clientSymbols.forEach((s) => {
      if (quotes[s]) subQuotes[s] = quotes[s];
    });
    socket.emit('quotes', subQuotes);
    console.log(`[Streamer] ${socket.id} subscribed to: ${[...clientSymbols].join(', ')}`);
  });

  // Client unsubscribes
  socket.on('unsubscribe', (symbols: string[]) => {
    symbols.forEach((s) => clientSymbols.delete(s.toUpperCase()));
  });

  // Main app pushes updated quotes
  socket.on('update_quotes', (newQuotes: Record<string, LiveQuote>) => {
    Object.assign(quotes, newQuotes);
    // Broadcast to all clients
    io.emit('quotes', quotes);
  });

  // Single quote update
  socket.on('update_quote', (quote: LiveQuote) => {
    quotes[quote.symbol] = quote;
    io.emit('quote_update', quote);
  });

  socket.on('disconnect', () => {
    console.log(`[Streamer] Client disconnected: ${socket.id}`);
  });
});

// Periodic heartbeat
setInterval(() => {
  io.emit('heartbeat', { timestamp: new Date().toISOString(), connectedClients: io.engine.clientsCount });
}, 30000);

console.log(`[Streamer] WebSocket price streaming service running on port ${PORT}`);