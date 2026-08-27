// Indian market status calculation
// Uses Asia/Kolkata timezone — NOT the user's browser timezone.

import type { MarketQuote } from './types';

/**
 * Get the current NSE market status based on Asia/Kolkata time.
 * NSE trading hours: 9:15 AM – 3:30 PM IST, Monday – Friday.
 * Pre-market: 9:00 AM – 9:15 AM IST.
 * Post-market: 3:30 PM – 4:00 PM IST (closing price calculation).
 */
export function getIndianMarketStatus(): MarketQuote['marketStatus'] {
  const now = new Date();

  // Use Asia/Kolkata (IST = UTC+5:30)
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'long',
  });

  const parts = istFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const weekday = getPart('weekday');

  // Weekend check
  if (weekday === 'Saturday' || weekday === 'Sunday') {
    return 'CLOSED';
  }

  const totalMinutes = hour * 60 + minute;

  // Pre-market: 9:00 – 9:14 IST
  if (totalMinutes >= 540 && totalMinutes < 555) {
    return 'PRE_MARKET';
  }

  // Regular session: 9:15 – 15:30 IST
  if (totalMinutes >= 555 && totalMinutes <= 930) {
    return 'OPEN';
  }

  // Post-market: 15:31 – 16:00 IST
  if (totalMinutes > 930 && totalMinutes <= 960) {
    return 'POST_MARKET';
  }

  return 'CLOSED';
}
