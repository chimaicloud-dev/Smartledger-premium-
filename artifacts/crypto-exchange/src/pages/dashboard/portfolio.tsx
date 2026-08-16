import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, Button } from "@/components/ui/shared";
import { useGetPortfolio, useGetMarketPrices } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatCrypto, cn } from "@/lib/utils";
import { Link } from "wouter";
import { Eye, EyeOff, History, LineChart, Search, ChevronDown, Plus, Send, ArrowLeftRight, X, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { CoinLogo } from "@/components/ui/CoinLogo";
import { COIN_META } from "@/lib/coin-meta";

const ALL_SYMBOLS = Object.keys(COIN_META);

function DenominationPicker({
  value, onChange, onClose, prices,
}: {
  value: string;
  onChange: (s: string) => void;
  onClose: () => void;
  prices: Record<string, number>;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-bold text-foreground">Display total in</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-border">
          {ALL_SYMBOLS.map((sym) => {
            const m = COIN_META[sym];
            return (
              <button
                key={sym}
                onClick={() => { onChange(sym); onClose(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 transition-colors",
                  value === sym && "bg-secondary/30"
                )}
              >
                <CoinLogo symbol={sym} size={8} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground">{sym}</div>
                  <div className="text-xs text-muted-foreground">{m.name}</div>
                </div>
                <div className="text-xs text-muted-foreground mono-nums">${prices[sym]?.toFixed(prices[sym] < 1 ? 4 : 2)}</div>
                {value === sym && <CheckCircle2 className="w-4 h-4 text-primary ml-2" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { data: portfolio, isLoading } = useGetPortfolio();
  const { data: marketData } = useGetMarketPrices({ query: { queryKey: ["/api/market/prices"], refetchInterval: 15000, refetchOnWindowFocus: true } });
  const [hideBalance, setHideBalance] = useState(false);
  const [view, setView] = useState<"overview" | "spot">("overview");
  const [tab, setTab] = useState<"crypto" | "account">("crypto");
  const [search, setSearch] = useState("");
  const [denom, setDenom] = useState<string>("BTC");
  const [showDenomPicker, setShowDenomPicker] = useState(false);
  const [hideSmall, setHideSmall] = useState(false);

  // Build a comprehensive USD-price map from market data + holdings + defaults
  const prices: Record<string, number> = useMemo(() => {
    const p: Record<string, number> = {};
    for (const sym of ALL_SYMBOLS) p[sym] = COIN_META[sym].defaultPrice;
    if (marketData) for (const m of marketData) if (p[m.symbol] !== undefined) p[m.symbol] = m.price;
    if (portfolio?.holdings) for (const h of portfolio.holdings) if (p[h.symbol] !== undefined) p[h.symbol] = h.currentPrice;
    return p;
  }, [marketData, portfolio?.holdings]);

  if (isLoading) {
    return <DashboardLayout><div className="text-center py-20 text-muted-foreground animate-pulse">Loading portfolio...</div></DashboardLayout>;
  }
  if (!portfolio) return null;

  const denomPrice = prices[denom] ?? 1;
  const totalInDenom = portfolio.totalValue / denomPrice;

  const totalPnl = portfolio.holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalInvested = portfolio.holdings.reduce((sum, h) => sum + h.avgBuyPrice * h.amount, 0);
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const hide = (s: string) => (hideBalance ? "******" : s);

  const denomDecimals = denom === "USDT" ? 2 : denomPrice >= 100 ? 6 : 8;

  // Build asset rows
  const heldBySymbol = new Map(portfolio.holdings.map((h) => [h.symbol, h]));
  const buildRows = (forSpot: boolean) =>
    ALL_SYMBOLS
      .map((sym) => {
        const h = heldBySymbol.get(sym);
        const meta = COIN_META[sym];
        return {
          symbol: sym,
          coinName: meta.name,
          amount: h?.amount ?? 0,
          avgBuyPrice: h?.avgBuyPrice ?? 0,
          currentPrice: h?.currentPrice ?? prices[sym],
          currentValue: h?.currentValue ?? 0,
          pnl: h?.pnl ?? 0,
          pnlPercent: h?.pnlPercent ?? 0,
        };
      })
      .filter((r) => {
        // Spot view: only show held coins (real spot wallet behaviour) + hide small if toggled
        if (forSpot && r.amount === 0) return false;
        if (forSpot && hideSmall && r.currentValue < 1) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!r.symbol.toLowerCase().includes(q) && !r.coinName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.amount > 0 && b.amount === 0) return -1;
        if (a.amount === 0 && b.amount > 0) return 1;
        return b.currentValue - a.currentValue;
      });

  const cryptoRows = buildRows(false);
  const spotRows = buildRows(true);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Top tabs Overview / Spot */}
        <div className="flex items-center gap-6 border-b border-border pb-3">
          <button
            onClick={() => setView("overview")}
            className={cn(
              "relative pb-1 text-2xl font-display font-bold transition-colors",
              view === "overview" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Overview
            {view === "overview" && <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
          <button
            onClick={() => setView("spot")}
            className={cn(
              "relative pb-1 text-2xl font-display font-bold transition-colors",
              view === "spot" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Spot
            {view === "spot" && <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        </div>

        {/* Summary card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              {view === "spot" ? "Spot Wallet — Estimated Balance" : "Est. Total Value"}
              <button onClick={() => setHideBalance((v) => !v)} className="hover:text-foreground transition-colors" aria-label="Toggle balance visibility">
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Link href="/dashboard/transactions" className="hover:text-primary transition-colors" aria-label="Performance"><LineChart className="w-4 h-4" /></Link>
              <Link href="/dashboard/transactions" className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:text-primary hover:border-primary/40 transition-colors" aria-label="History"><History className="w-3.5 h-3.5" /></Link>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <div className="text-4xl sm:text-5xl font-display font-bold mono-nums text-foreground tracking-tight">
              {hide(totalInDenom.toFixed(denomDecimals))}
            </div>
            <button
              onClick={() => setShowDenomPicker(true)}
              className="flex items-center gap-1 px-2 py-1 -mx-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Change display denomination"
            >
              <span className="text-base font-bold">{denom}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-muted-foreground mono-nums mb-3">
            ≈ {hide(formatCurrency(portfolio.totalValue))}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard/transactions" className="text-muted-foreground underline underline-offset-2 decoration-muted-foreground/40 hover:text-foreground">Today's PNL</Link>
            <span className={cn("font-medium mono-nums", totalPnl >= 0 ? "text-success" : "text-destructive")}>
              {totalPnl >= 0 ? "+" : ""}{hide(formatCurrency(totalPnl))} ({totalPnl >= 0 ? "+" : ""}{hide(totalPnlPercent.toFixed(2))}%)
            </span>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <Link href="/dashboard/deposit">
              <Button className="w-full font-bold gap-1.5"><Plus className="w-4 h-4" /> Add Funds</Button>
            </Link>
            <Link href="/dashboard/withdraw">
              <Button variant="secondary" className="w-full font-semibold gap-1.5"><Send className="w-4 h-4" /> Send</Button>
            </Link>
            <Link href="/dashboard/convert">
              <Button variant="secondary" className="w-full font-semibold gap-1.5"><ArrowLeftRight className="w-4 h-4" /> Transfer</Button>
            </Link>
          </div>
        </Card>

        {view === "overview" ? (
          <>
            {/* Crypto / Account inner tabs + search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setTab("crypto")}
                  className={cn(
                    "relative pb-2 text-base font-bold transition-colors",
                    tab === "crypto" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Crypto
                  {tab === "crypto" && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
                <button
                  onClick={() => setTab("account")}
                  className={cn(
                    "relative pb-2 text-base font-bold transition-colors",
                    tab === "account" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Account
                  {tab === "account" && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              </div>
              <div className="relative flex-1 max-w-[180px]">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {tab === "crypto" ? (
              <div className="space-y-2">
                {cryptoRows.length === 0 && (
                  <Card className="p-6 text-center text-sm text-muted-foreground">No assets match "{search}".</Card>
                )}
                {cryptoRows.map((r) => {
                  const isPos = r.pnl >= 0;
                  const balanceInDenom = denomPrice > 0 ? r.currentValue / denomPrice : 0;
                  return (
                    <Card key={r.symbol} className="p-4 hover:border-border/80 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <CoinLogo symbol={r.symbol} size={10} />
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-base leading-tight">{r.symbol}</div>
                            <div className="text-xs text-muted-foreground">{r.coinName}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold mono-nums text-foreground leading-tight">
                            {hide(formatCrypto(r.amount, r.symbol))}
                          </div>
                          <div className="text-[11px] text-muted-foreground mono-nums">
                            {hide(balanceInDenom.toFixed(denomDecimals))} {denom}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                        <div className="text-muted-foreground">Today's PNL</div>
                        <div className={cn("text-right mono-nums font-medium", r.amount > 0 ? (isPos ? "text-success" : "text-destructive") : "text-muted-foreground")}>
                          {r.amount > 0
                            ? `${isPos ? "+" : ""}${hide(formatCurrency(r.pnl))}(${isPos ? "+" : ""}${hide(r.pnlPercent.toFixed(2))}%)`
                            : "$0.00(0.00%)"}
                        </div>
                        <div className="text-muted-foreground">Average Price</div>
                        <div className="text-right mono-nums text-foreground">
                          {hide(formatCurrency(r.avgBuyPrice > 0 ? r.avgBuyPrice : r.currentPrice))}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Link href={`/dashboard/invest`}>
                          <button className="px-4 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary/70 border border-border rounded-md text-foreground transition-colors">
                            Earn
                          </button>
                        </Link>
                        <Link href={`/dashboard/convert`}>
                          <button className="px-4 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary/70 border border-border rounded-md text-foreground transition-colors">
                            Trade
                          </button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Account Funds</div>
                    <div className="text-2xl font-bold mono-nums text-foreground">{hide(formatCurrency(portfolio.totalValue))}</div>
                    <div className="text-xs text-muted-foreground mt-1">Held across your coin balances</div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xl">Ξ</div>
                </div>
                <div className="flex gap-2">
                  <Link href="/dashboard/deposit"><Button variant="secondary" size="sm">Deposit</Button></Link>
                  <Link href="/dashboard/withdraw"><Button variant="secondary" size="sm">Withdraw</Button></Link>
                </div>
              </Card>
            )}
          </>
        ) : (
          // SPOT VIEW
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-foreground">My Assets</h2>
                <span className="text-xs text-muted-foreground">{spotRows.length} coins</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideSmall}
                    onChange={(e) => setHideSmall(e.target.checked)}
                    className="accent-primary w-3 h-3"
                  />
                  Hide &lt; $1
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[140px] pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/30">
                <div className="col-span-4">Coin</div>
                <div className="col-span-3 text-right">Total</div>
                <div className="col-span-2 text-right">Available</div>
                <div className="col-span-2 text-right hidden sm:block">In Order</div>
                <div className="col-span-1 text-right">USD Value</div>
              </div>
              {spotRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground space-y-3">
                  <div>No assets in your spot wallet yet.</div>
                  <Link href="/dashboard/deposit"><Button size="sm">Make a Deposit</Button></Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {spotRows.map((r) => {
                    const isPos = r.pnl >= 0;
                    return (
                      <div key={r.symbol} className="px-4 py-4 hover:bg-secondary/20 transition-colors">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <CoinLogo symbol={r.symbol} size={8} />
                            <div className="min-w-0">
                              <div className="font-bold text-foreground text-sm leading-tight">{r.symbol}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{r.coinName}</div>
                            </div>
                          </div>
                          <div className="col-span-3 text-right">
                            <div className="font-bold mono-nums text-sm text-foreground">{hide(formatCrypto(r.amount, r.symbol))}</div>
                            <div className="text-[10px] text-muted-foreground mono-nums">{hide((r.currentValue / denomPrice).toFixed(denomDecimals))} {denom}</div>
                          </div>
                          <div className="col-span-2 text-right mono-nums text-sm text-foreground">
                            {hide(formatCrypto(r.amount, r.symbol))}
                          </div>
                          <div className="col-span-2 text-right mono-nums text-sm text-muted-foreground hidden sm:block">
                            0.00
                          </div>
                          <div className="col-span-1 text-right mono-nums text-xs text-foreground">
                            {hide(formatCurrency(r.currentValue))}
                          </div>
                        </div>
                        <div className="mt-3 pl-11 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-muted-foreground">Avg.Cost</span>
                            <span className="mono-nums text-foreground">{hide(formatCurrency(r.avgBuyPrice > 0 ? r.avgBuyPrice : r.currentPrice))}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">PNL</span>
                            <span className={cn("mono-nums font-medium", isPos ? "text-success" : "text-destructive")}>
                              {isPos ? "+" : ""}{hide(formatCurrency(r.pnl))} ({isPos ? "+" : ""}{hide(r.pnlPercent.toFixed(2))}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/invest?action=buy&symbol=${r.symbol}`}>
                              <button className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-md bg-success/10 hover:bg-success/20 text-success border border-success/30">
                                <ArrowUpRight className="w-3 h-3" /> Buy
                              </button>
                            </Link>
                            <Link href={`/dashboard/invest?action=sell&symbol=${r.symbol}`}>
                              <button className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30">
                                <ArrowDownRight className="w-3 h-3" /> Sell
                              </button>
                            </Link>
                            <Link href={`/dashboard/convert`}>
                              <button className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-md bg-secondary hover:bg-secondary/70 text-foreground border border-border">
                                Convert
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}

        {showDenomPicker && (
          <DenominationPicker
            value={denom}
            prices={prices}
            onChange={setDenom}
            onClose={() => setShowDenomPicker(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
