import { Router, type IRouter, type Request } from "express";
import { fetchForexPrices } from "../lib/forex";

const router: IRouter = Router();

const COINS = [
  { symbol: "BTC", name: "Bitcoin", cgId: "bitcoin", icon: "₿", fallback: 67500 },
  { symbol: "ETH", name: "Ethereum", cgId: "ethereum", icon: "Ξ", fallback: 3450 },
  { symbol: "BNB", name: "BNB", cgId: "binancecoin", icon: "B", fallback: 580 },
  { symbol: "SOL", name: "Solana", cgId: "solana", icon: "◎", fallback: 175 },
  { symbol: "XRP", name: "XRP", cgId: "ripple", icon: "✕", fallback: 0.58 },
  { symbol: "ADA", name: "Cardano", cgId: "cardano", icon: "₳", fallback: 0.45 },
  { symbol: "DOGE", name: "Dogecoin", cgId: "dogecoin", icon: "Ð", fallback: 0.162 },
  { symbol: "MATIC", name: "Polygon", cgId: "matic-network", icon: "P", fallback: 0.87 },
  { symbol: "DOT", name: "Polkadot", cgId: "polkadot", icon: "●", fallback: 7.2 },
  { symbol: "LINK", name: "Chainlink", cgId: "chainlink", icon: "⬡", fallback: 18.5 },
];

type PriceRow = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  icon: string;
};

type CoinGeckoEntry = {
  usd?: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
};

let cache: { ts: number; data: PriceRow[] } | null = null;
const CACHE_MS = 60_000;
const ids = COINS.map((c) => c.cgId).join(",");
const COINGECKO_URL =
  `https://api.coingecko.com/api/v3/simple/price?ids=${ids}` +
  `&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

async function fetchLivePrices(req: Request): Promise<PriceRow[]> {
  const resp = await fetch(COINGECKO_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "smartledger-premium/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) {
    throw new Error(`CoinGecko responded ${resp.status}`);
  }
  const json = (await resp.json()) as Record<string, CoinGeckoEntry>;

  return COINS.map((c) => {
    const entry = json[c.cgId];
    if (!entry || typeof entry.usd !== "number") {
      req.log.warn({ id: c.cgId }, "missing CoinGecko entry, using fallback");
      return {
        symbol: c.symbol,
        name: c.name,
        price: c.fallback,
        change24h: 0,
        changePercent24h: 0,
        volume24h: 0,
        marketCap: 0,
        icon: c.icon,
      };
    }
    const price = entry.usd;
    const changePct = entry.usd_24h_change ?? 0;
    const change24h = (price * changePct) / 100;
    return {
      symbol: c.symbol,
      name: c.name,
      price,
      change24h,
      changePercent24h: changePct,
      volume24h: entry.usd_24h_vol ?? 0,
      marketCap: entry.usd_market_cap ?? 0,
      icon: c.icon,
    };
  });
}

function fallbackRows(): PriceRow[] {
  return COINS.map((c) => ({
    symbol: c.symbol,
    name: c.name,
    price: c.fallback,
    change24h: 0,
    changePercent24h: 0,
    volume24h: 0,
    marketCap: 0,
    icon: c.icon,
  }));
}

/**
 * Returns the current price rows, using the shared 60s cache. This is the
 * single source of truth for prices across the app — the portfolio, admin,
 * and market pages all read from here so a coin's price is identical
 * everywhere (previously the portfolio used stale hardcoded prices, which
 * made rates jump when an amount was entered on the Convert page).
 */
export async function getPriceRows(req: Request): Promise<PriceRow[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) return cache.data;
  try {
    const data = await fetchLivePrices(req);
    cache = { ts: now, data };
    return data;
  } catch (err) {
    req.log.error({ err }, "failed to fetch live prices");
    return cache?.data ?? fallbackRows();
  }
}

/** Live symbol -> USD price map, backed by the same cache as getPriceRows. */
export async function getPriceMap(req: Request): Promise<Record<string, number>> {
  const rows = await getPriceRows(req);
  const map: Record<string, number> = { USDT: 1, USDC: 1 };
  for (const r of rows) map[r.symbol] = r.price;
  return map;
}

router.get("/prices", async (req, res) => {
  res.json(await getPriceRows(req));
});

router.get("/forex", async (req, res) => {
  try {
    const data = await fetchForexPrices(req);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "failed to fetch forex prices");
    res.status(500).json({ error: "Failed to load forex markets" });
  }
});

export default router;
