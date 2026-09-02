import type { Request } from "express";

export type ForexAsset = {
  symbol: string;
  tradingViewSymbol: string;
  scanner: "forex" | "cfd" | "america";
  name: string;
  icon: string;
  category: "metal" | "forex" | "stock";
};

export const FOREX_ASSETS: ForexAsset[] = [
  { symbol: "XAUUSD", tradingViewSymbol: "OANDA:XAUUSD", scanner: "cfd", name: "Gold Spot", icon: "🥇", category: "metal" },
  { symbol: "XAGUSD", tradingViewSymbol: "TVC:SILVER", scanner: "cfd", name: "Silver Spot", icon: "🥈", category: "metal" },
  { symbol: "EURUSD", tradingViewSymbol: "FX:EURUSD", scanner: "forex", name: "Euro / US Dollar", icon: "💶", category: "forex" },
  { symbol: "GBPUSD", tradingViewSymbol: "FX:GBPUSD", scanner: "forex", name: "British Pound / USD", icon: "💷", category: "forex" },
  { symbol: "USDJPY", tradingViewSymbol: "FX:USDJPY", scanner: "forex", name: "US Dollar / Yen", icon: "💴", category: "forex" },
  { symbol: "AUDUSD", tradingViewSymbol: "FX:AUDUSD", scanner: "forex", name: "Australian Dollar / USD", icon: "🇦🇺", category: "forex" },
  { symbol: "USDCAD", tradingViewSymbol: "FX:USDCAD", scanner: "forex", name: "US Dollar / Canadian", icon: "🇨🇦", category: "forex" },
  { symbol: "USDCHF", tradingViewSymbol: "FX:USDCHF", scanner: "forex", name: "US Dollar / Swiss Franc", icon: "🇨🇭", category: "forex" },
  { symbol: "AAPL", tradingViewSymbol: "NASDAQ:AAPL", scanner: "america", name: "Apple Inc.", icon: "🍎", category: "stock" },
  { symbol: "TSLA", tradingViewSymbol: "NASDAQ:TSLA", scanner: "america", name: "Tesla Inc.", icon: "🚗", category: "stock" },
  { symbol: "MSFT", tradingViewSymbol: "NASDAQ:MSFT", scanner: "america", name: "Microsoft", icon: "💻", category: "stock" },
  { symbol: "NVDA", tradingViewSymbol: "NASDAQ:NVDA", scanner: "america", name: "NVIDIA", icon: "🎮", category: "stock" },
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

type TradingViewScanResponse = {
  data?: Array<{
    s: string;
    d: [number | null, number | null, number | null];
  }>;
};

let cache: { ts: number; data: ForexRow[] } | null = null;
const CACHE_MS = 5_000;

async function fetchTradingViewQuotes(scanner: ForexAsset["scanner"], symbols: string[]) {
  const resp = await fetch(`https://scanner.tradingview.com/${scanner}/scan`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      symbols: { tickers: symbols, query: { types: [] } },
      columns: ["close", "change", "volume"],
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!resp.ok) throw new Error(`TradingView ${scanner} scanner returned ${resp.status}`);
  const json = (await resp.json()) as TradingViewScanResponse;
  return new Map((json.data ?? []).map((row) => [row.s, row.d]));
}

export async function fetchForexPrices(req: Request): Promise<ForexRow[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) return cache.data;

  try {
    const scanners = ["forex", "cfd", "america"] as const;
    const quoteGroups = await Promise.all(
      scanners.map(async (scanner) => [
        scanner,
        await fetchTradingViewQuotes(
          scanner,
          FOREX_ASSETS.filter((asset) => asset.scanner === scanner).map((asset) => asset.tradingViewSymbol),
        ),
      ] as const),
    );
    const quotes = new Map(quoteGroups);
    const results = FOREX_ASSETS.map((asset) => {
      const quote = quotes.get(asset.scanner)?.get(asset.tradingViewSymbol);
      const [price, changePercent, volume] = quote ?? [];
      if (typeof price !== "number" || typeof changePercent !== "number") {
        throw new Error(`TradingView quote missing for ${asset.tradingViewSymbol}`);
      }
      const previousClose = price / (1 + changePercent / 100);
      return {
        symbol: asset.symbol,
        name: asset.name,
        price,
        change24h: price - previousClose,
        changePercent24h: changePercent,
        volume24h: typeof volume === "number" ? volume : 0,
        marketCap: 0,
        icon: asset.icon,
      } satisfies ForexRow;
    });
    cache = { ts: now, data: results };
    return results;
  } catch (error) {
    if (cache) {
      req.log.warn({ err: error }, "live TradingView fetch failed, serving last exact quote");
      return cache.data;
    }
    throw error;
  }
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
