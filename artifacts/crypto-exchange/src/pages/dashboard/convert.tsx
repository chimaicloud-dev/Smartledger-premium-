import { apiErrorMessage } from "@/lib/api-error";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, Button } from "@/components/ui/shared";
import { useGetPortfolio, useGetMarketPrices, useConvertCrypto } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatCrypto, cn } from "@/lib/utils";
import { ArrowDownUp, Repeat, ChevronDown, CheckCircle2, AlertCircle, Loader2, Wallet, X } from "lucide-react";

const COIN_META: Record<string, { name: string; icon: string; color: string }> = {
  BTC:   { name: "Bitcoin",   icon: "₿", color: "text-orange-400" },
  ETH:   { name: "Ethereum",  icon: "Ξ", color: "text-blue-400" },
  BNB:   { name: "BNB",       icon: "⬡", color: "text-yellow-400" },
  SOL:   { name: "Solana",    icon: "◎", color: "text-purple-400" },
  XRP:   { name: "XRP",       icon: "✕", color: "text-sky-400" },
  ADA:   { name: "Cardano",   icon: "₳", color: "text-blue-300" },
  DOGE:  { name: "Dogecoin",  icon: "Ð", color: "text-amber-300" },
  MATIC: { name: "Polygon",   icon: "⬢", color: "text-indigo-400" },
  DOT:   { name: "Polkadot",  icon: "●", color: "text-pink-400" },
  LINK:  { name: "Chainlink", icon: "⬡", color: "text-cyan-400" },
  USDT:  { name: "Tether",    icon: "₮", color: "text-green-400" },
  LTC:   { name: "Litecoin",  icon: "Ł", color: "text-slate-300" },
  TRX:   { name: "TRON",      icon: "⬤", color: "text-red-400" },
};

const ALL_SYMBOLS = Object.keys(COIN_META);

function CoinIcon({ symbol }: { symbol: string }) {
  const m = COIN_META[symbol] || { icon: "•", color: "text-foreground" };
  return (
    <div className={cn("w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-base font-bold", m.color)}>
      {m.icon}
    </div>
  );
}

function CoinPicker({
  value, onChange, options, title, onClose,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { symbol: string; balance?: number }[];
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-bold text-foreground">{title}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-border">
          {options.map((opt) => {
            const m = COIN_META[opt.symbol] || { name: opt.symbol, icon: "•", color: "text-foreground" };
            return (
              <button
                key={opt.symbol}
                onClick={() => { onChange(opt.symbol); onClose(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 transition-colors",
                  value === opt.symbol && "bg-secondary/30"
                )}
              >
                <CoinIcon symbol={opt.symbol} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground">{opt.symbol}</div>
                  <div className="text-xs text-muted-foreground">{m.name}</div>
                </div>
                {opt.balance !== undefined && (
                  <div className="text-right">
                    <div className="text-sm mono-nums text-foreground">{formatCrypto(opt.balance, opt.symbol)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</div>
                  </div>
                )}
                {value === opt.symbol && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ConvertPage() {
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading: pLoading } = useGetPortfolio();
  const { data: marketData } = useGetMarketPrices({ query: { queryKey: ["/api/market/prices"], refetchInterval: 10000, refetchOnWindowFocus: true } });

  const holdings = portfolio?.holdings ?? [];
  const fromOptions = useMemo(
    () => holdings.filter((h) => h.amount > 0).map((h) => ({ symbol: h.symbol, balance: h.amount })),
    [holdings]
  );

  const defaultFrom = fromOptions[0]?.symbol ?? "USDT";
  const [fromSymbol, setFromSymbol] = useState<string>(defaultFrom);
  const [toSymbol, setToSymbol] = useState<string>("BTC");
  const [fromAmount, setFromAmount] = useState<string>("");
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [success, setSuccess] = useState<null | { from: string; to: string; fromAmount: number; toAmount: number; rate: number; usdValue: number }>(null);

  const fromHolding = holdings.find((h) => h.symbol === fromSymbol);
  const fromBalance = fromHolding?.amount ?? 0;
  const fromPrice = fromHolding?.currentPrice ?? marketData?.find((m) => m.symbol === fromSymbol)?.price ?? (fromSymbol === "USDT" ? 1 : 0);
  const toMeta = marketData?.find((m) => m.symbol === toSymbol);
  const toPrice = toMeta?.price ?? holdings.find((h) => h.symbol === toSymbol)?.currentPrice ?? (toSymbol === "USDT" ? 1 : 0);

  const fromAmtNum = parseFloat(fromAmount) || 0;
  const usdValue = fromAmtNum * fromPrice;
  const previewToAmount = toPrice > 0 ? (usdValue * 0.999) / toPrice : 0;
  const rate = fromPrice > 0 && toPrice > 0 ? (fromPrice * 0.999) / toPrice : 0;
  const insufficient = fromAmtNum > fromBalance;
  const sameCoin = fromSymbol === toSymbol;
  const valid = fromAmtNum > 0 && !insufficient && !sameCoin && fromBalance > 0;

  const convertMutation = useConvertCrypto({
    mutation: {
      onSuccess: (data) => {
        setSuccess({
          from: data.fromSymbol, to: data.toSymbol,
          fromAmount: data.fromAmount, toAmount: data.toAmount,
          rate: data.rate, usdValue: data.usdValue,
        });
        setFromAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      },
    },
  });

  const handleSwapDirection = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setFromAmount("");
  };

  const handleConvert = () => {
    if (!valid) return;
    convertMutation.mutate({ data: { fromSymbol, toSymbol, fromAmount: fromAmtNum } });
  };

  const errorMsg = convertMutation.error
    ? apiErrorMessage(convertMutation.error, "Conversion failed")
    : null;

  if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto py-8 space-y-5">
          <Card className="p-7 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/15 border border-success/40 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Conversion Successful</h2>
              <p className="text-sm text-muted-foreground mt-1">Your assets have been swapped instantly.</p>
            </div>

            <div className="bg-secondary/30 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <CoinIcon symbol={success.from} />
                <ArrowDownUp className="w-4 h-4 text-muted-foreground -rotate-90" />
                <CoinIcon symbol={success.to} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Spent</div>
                  <div className="font-bold text-foreground mono-nums">{formatCrypto(success.fromAmount, success.from)} {success.from}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Received</div>
                  <div className="font-bold text-success mono-nums">{formatCrypto(success.toAmount, success.to)} {success.to}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Rate</div>
                  <div className="font-mono text-sm text-foreground">1 {success.from} = {success.rate.toFixed(8)} {success.to}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">USD Value</div>
                  <div className="font-mono text-sm text-foreground">{formatCurrency(success.usdValue)}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setSuccess(null)}>Convert Again</Button>
              <Button className="flex-1" onClick={() => { setSuccess(null); window.location.href = "/dashboard/portfolio"; }}>View Portfolio</Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Repeat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Convert</h1>
            <p className="text-sm text-muted-foreground">Swap any coin you hold for another, instantly.</p>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          {/* From */}
          <div className="bg-background/40 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Balance: <span className="text-foreground font-medium mono-nums">{formatCrypto(fromBalance, fromSymbol)}</span> {fromSymbol}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowFrom(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors shrink-0"
              >
                <CoinIcon symbol={fromSymbol} />
                <div className="text-left">
                  <div className="font-bold text-foreground text-sm">{fromSymbol}</div>
                  <div className="text-[10px] text-muted-foreground">{COIN_META[fromSymbol]?.name}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="min-w-0 w-0 flex-1 bg-transparent border-0 p-0 text-right text-xl sm:text-2xl font-bold mono-nums focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1.5">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFromAmount(((fromBalance * p) / 100).toString())}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border"
                  >
                    {p === 100 ? "MAX" : `${p}%`}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground mono-nums">≈ {formatCurrency(usdValue)}</span>
            </div>
          </div>

          {/* Switch */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwapDirection}
              className="w-10 h-10 rounded-full bg-secondary border-2 border-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center"
              title="Switch direction"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>
          </div>

          {/* To */}
          <div className="bg-background/40 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</span>
              <span className="text-xs text-muted-foreground">You receive (est.)</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowTo(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors shrink-0"
              >
                <CoinIcon symbol={toSymbol} />
                <div className="text-left">
                  <div className="font-bold text-foreground text-sm">{toSymbol}</div>
                  <div className="text-[10px] text-muted-foreground">{COIN_META[toSymbol]?.name}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="min-w-0 flex-1 overflow-hidden text-right text-xl sm:text-2xl font-bold mono-nums text-foreground break-all">
                {previewToAmount > 0 ? formatCrypto(previewToAmount, toSymbol) : <span className="text-muted-foreground/40">0.00</span>}
              </div>
            </div>
            {fromAmtNum > 0 && rate > 0 && (
              <div className="text-xs text-muted-foreground mt-2 text-right">
                1 {fromSymbol} ≈ {rate < 0.01 ? rate.toExponential(4) : rate.toFixed(8)} {toSymbol} · 0.1% fee
              </div>
            )}
          </div>

          {/* Errors */}
          {sameCoin && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> Pick a different target coin.
            </div>
          )}
          {insufficient && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> Insufficient {fromSymbol} balance.
            </div>
          )}
          {fromBalance === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> You don't hold any {fromSymbol}. Deposit or buy some first.
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
            </div>
          )}

          <Button
            onClick={handleConvert}
            disabled={!valid || convertMutation.isPending}
            className="w-full py-3.5 text-base font-bold gap-2"
          >
            {convertMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting...</> : <>Convert</>}
          </Button>
        </Card>

        {pLoading && <div className="text-center text-sm text-muted-foreground">Loading your wallet...</div>}

        {showFrom && (
          <CoinPicker
            title="Convert From"
            value={fromSymbol}
            onChange={setFromSymbol}
            onClose={() => setShowFrom(false)}
            options={fromOptions.length > 0 ? fromOptions : [{ symbol: "USDT", balance: 0 }]}
          />
        )}
        {showTo && (
          <CoinPicker
            title="Convert To"
            value={toSymbol}
            onChange={setToSymbol}
            onClose={() => setShowTo(false)}
            options={ALL_SYMBOLS.filter((s) => s !== fromSymbol).map((s) => ({ symbol: s }))}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
