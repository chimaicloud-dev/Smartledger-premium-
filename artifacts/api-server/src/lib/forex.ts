import type { Request } from "express";

export type ForexAsset = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  icon: string;
  category: "metal" | "forex" | "stock";
  fallback: number;
};

export const FOREX_ASSETS: ForexAsset[] = [
  { symbol: "XAUUSD", yahooSymbol: "GC=F", name: "Gold Spot", icon: "🥇", category: "metal", fallback: 2350.0 },
  { symbol: "XAGUSD", yahooSymbol: "SI=F", name: "Silver Spot", icon: "🥈", category: "metal", fallback: 28.5 },
  { symbol: "EURUSD", yahooSymbol: "EURUSD=X", name: "Euro / US Dollar", icon: "💶", category: "forex", fallback: 1.085 },
  { symbol: "GBPUSD", yahooSymbol: "GBPUSD=X", name: "British Pound / USD", icon: "💷", category: "forex", fallback: 1.265 },
  { symbol: "USDJPY", yahooSymbol: "JPY=X", name: "US Dollar / Yen", icon: "💴", category: "forex", fallback: 156.4 },
  { symbol: "AUDUSD", yahooSymbol: "AUDUSD=X", name: "Australian Dollar / USD", icon: "🇦🇺", category: "forex", fallback: 0.658 },
  { symbol: "USDCAD", yahooSymbol: "CAD=X", name: "US Dollar / Canadian", icon: "🇨🇦", category: "forex", fallback: 1.368 },
  { symbol: "USDCHF", yahooSymbol: "CHF=X", name: "US Dollar / Swiss Franc", icon: "🇨🇭", category: "forex", fallback: 0.912 },
  { symbol: "AAPL", yahooSymbol: "AAPL", name: "Apple Inc.", icon: "🍎", category: "stock", fallback: 218.0 },
  { symbol: "TSLA", yahooSymbol: "TSLA", name: "Tesla Inc.", icon: "🚗", category: "stock", fallback: 245.0 },
  { symbol: "MSFT", yahooSymbol: "MSFT", name: "Microsoft", icon: "💻", category: "stock", fallback: 425.0 },
  { symbol: "NVDA", yahooSymbol: "NVDA", name: "NVIDIA", icon: "🎮", category: "stock", fallback: 118.0 },
];

export type ForexRow = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  icon: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
      };
    }>;
  };
};

let cache: { ts: number; data: ForexRow[] } | null = null;
const CACHE_MS = 15_000;

async function fetchYahooQuote(yahooSymbol: string): Promise<{ price: number; prevClose: number; volume: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
  try {
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as YahooChartResponse;
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      price: meta.regularMarketPrice,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice,
      volume: meta.regularMarketVolume ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchForexPrices(req: Request): Promise<ForexRow[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) return cache.data;

  const results = await Promise.all(
    FOREX_ASSETS.map(async (a) => {
      const live = await fetchYahooQuote(a.yahooSymbol);
      if (!live) {
        req.log.warn({ symbol: a.symbol }, "forex live fetch failed, using fallback");
        const price = a.fallback;
        return {
          symbol: a.symbol,
          name: a.name,
          price,
          change24h: 0,
          changePercent24h: 0,
          volume24h: 0,
          marketCap: 0,
          icon: a.icon,
        } satisfies ForexRow;
      }
      const change = live.price - live.prevClose;
      const changePct = live.prevClose ? (change / live.prevClose) * 100 : 0;
      return {
        symbol: a.symbol,
        name: a.name,
        price: live.price,
        change24h: change,
        changePercent24h: changePct,
        volume24h: live.volume,
        marketCap: 0,
        icon: a.icon,
      } satisfies ForexRow;
    })
  );

  cache = { ts: now, data: results };
  return results;
}

export function getForexAssetPrice(symbol: string): { price: number; name: string } | null {
  if (!cache) return null;
  const row = cache.data.find((r) => r.symbol === symbol.toUpperCase());
  if (!row) return null;
  return { price: row.price, name: row.name };
}

export function getForexAssetMeta(symbol: string): ForexAsset | null {
  return FOREX_ASSETS.find((a) => a.symbol === symbol.toUpperCase()) ?? null;
}
