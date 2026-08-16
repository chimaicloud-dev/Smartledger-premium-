import { apiErrorMessage } from "@/lib/api-error";
import { useState, useEffect, useRef, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, Button, Input } from "@/components/ui/shared";
import { useAuth } from "@/hooks/use-auth";
import { useGetMarketPrices, useGetForexPrices, useConvertCrypto, useGetPortfolio, useCreateInvestment, useGetInvestments } from "@workspace/api-client-react";
import type { Investment } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, cn, formatCrypto } from "@/lib/utils";
import {
  Search, TrendingUp, TrendingDown, Zap, Shield, Rocket, Crown, Star,
  Check, ChevronRight, X, ArrowRight, Wallet, AlertCircle, Maximize2, Minimize2,
  ChevronDown, ChevronUp, BarChart2
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

const tradeSchema = z.object({
  usdAmount: z.coerce.number().positive("Amount must be positive"),
});

const investSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
});

const INVESTMENT_PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: TrendingUp,
    color: "text-green-400",
    ringColor: "ring-green-500/40",
    borderColor: "border-green-500/40",
    bgGlow: "bg-green-500",
    btnBg: "bg-green-500 hover:bg-green-600",
    gradientFrom: "from-green-500/15",
    gradientTo: "to-green-500/5",
    minInvest: 50,
    maxInvest: 499,
    dailyReturn: "2%",
    dailyPct: 0.02,
    monthlyReturn: "60%",
    duration: "30 days",
    features: ["Auto-compounding", "Daily payouts", "All coins supported", "Email support"],
    badge: null,
    desc: "Perfect for beginners. Steady daily returns.",
  },
  {
    id: "balanced",
    name: "Balanced",
    icon: Shield,
    color: "text-blue-400",
    ringColor: "ring-blue-500/40",
    borderColor: "border-blue-500/40",
    bgGlow: "bg-blue-500",
    btnBg: "bg-blue-500 hover:bg-blue-600",
    gradientFrom: "from-blue-500/15",
    gradientTo: "to-blue-500/5",
    minInvest: 500,
    maxInvest: 999,
    dailyReturn: "1.5%",
    dailyPct: 0.015,
    monthlyReturn: "45%",
    duration: "30 days",
    features: ["Auto-compounding", "Daily payouts", "All coins supported", "Priority support"],
    badge: null,
    desc: "Balanced risk-reward for steady growth.",
  },
  {
    id: "upgrade",
    name: "Upgrade",
    icon: Rocket,
    color: "text-purple-400",
    ringColor: "ring-purple-500/40",
    borderColor: "border-purple-500/40",
    bgGlow: "bg-purple-500",
    btnBg: "bg-purple-600 hover:bg-purple-700",
    gradientFrom: "from-purple-500/15",
    gradientTo: "to-purple-500/5",
    minInvest: 1000,
    maxInvest: 4999,
    dailyReturn: "1%",
    dailyPct: 0.01,
    monthlyReturn: "30%",
    duration: "30 days",
    features: ["Auto-compounding", "Daily payouts", "All coins supported", "Priority support", "Portfolio analytics"],
    badge: "Most Popular",
    desc: "Step up to higher capital with sustainable returns.",
  },
  {
    id: "pro-trader",
    name: "Pro Trader",
    icon: Star,
    color: "text-orange-400",
    ringColor: "ring-orange-500/40",
    borderColor: "border-orange-500/40",
    bgGlow: "bg-orange-500",
    btnBg: "bg-orange-500 hover:bg-orange-600",
    gradientFrom: "from-orange-500/15",
    gradientTo: "to-orange-500/5",
    minInvest: 5000,
    maxInvest: 9999,
    dailyReturn: "0.80%",
    dailyPct: 0.008,
    monthlyReturn: "24%",
    duration: "30 days",
    features: ["Auto-compounding", "Hourly payouts", "All coins supported", "24/7 support", "Advanced analytics", "Futures trading"],
    badge: "Best Value",
    desc: "Advanced tools and lower fees for active traders.",
  },
  {
    id: "professional",
    name: "Professional",
    icon: Crown,
    color: "text-red-400",
    ringColor: "ring-red-500/40",
    borderColor: "border-red-500/40",
    bgGlow: "bg-red-500",
    btnBg: "bg-red-500 hover:bg-red-600",
    gradientFrom: "from-red-500/15",
    gradientTo: "to-red-500/5",
    minInvest: 10000,
    maxInvest: null,
    dailyReturn: "0.5%",
    dailyPct: 0.005,
    monthlyReturn: "15%",
    duration: "30 days",
    features: ["Auto-compounding", "Real-time payouts", "Unlimited coins", "Dedicated manager", "Institutional tools", "VIP withdrawals", "Custom strategies"],
    badge: "VIP",
    desc: "Institutional-grade tier with a dedicated account manager.",
  },
];

type Plan = Omit<typeof INVESTMENT_PLANS[number], "minInvest" | "maxInvest" | "dailyPct" | "dailyReturn" | "monthlyReturn"> & {
  minInvest: number;
  maxInvest: number | null;
  dailyPct: number;
  dailyReturn: string;
  monthlyReturn: string;
};

// ─── Pip & Lot Config ───────────────────────────────────────────────────────
const PIP_MAP: Record<string, { size: number; decimals: number; lotUsd: number }> = {
  XAUUSD: { size: 0.01,    decimals: 2, lotUsd: 1000 },
  XAGUSD: { size: 0.001,   decimals: 3, lotUsd: 500  },
  EURUSD: { size: 0.0001,  decimals: 5, lotUsd: 1000 },
  GBPUSD: { size: 0.0001,  decimals: 5, lotUsd: 1000 },
  USDJPY: { size: 0.01,    decimals: 3, lotUsd: 1000 },
  AUDUSD: { size: 0.0001,  decimals: 5, lotUsd: 1000 },
  USDCAD: { size: 0.0001,  decimals: 5, lotUsd: 1000 },
  USDCHF: { size: 0.0001,  decimals: 5, lotUsd: 1000 },
  AAPL:   { size: 0.01,    decimals: 2, lotUsd: 500  },
  TSLA:   { size: 0.01,    decimals: 2, lotUsd: 500  },
  MSFT:   { size: 0.01,    decimals: 2, lotUsd: 500  },
  NVDA:   { size: 0.01,    decimals: 2, lotUsd: 500  },
  BTC:    { size: 1,       decimals: 2, lotUsd: 2000 },
  ETH:    { size: 0.1,     decimals: 2, lotUsd: 1000 },
  BNB:    { size: 0.01,    decimals: 2, lotUsd: 500  },
  SOL:    { size: 0.01,    decimals: 2, lotUsd: 500  },
  XRP:    { size: 0.0001,  decimals: 4, lotUsd: 500  },
};
function getPip(symbol: string) {
  return PIP_MAP[symbol] ?? { size: 0.0001, decimals: 5, lotUsd: 1000 };
}
// Pip value in USD per lot (simplified: pipSize * 10000 * lotUsd/100000)
// We use a fixed $1/pip per lot for display simplicity
function pipValuePerLot(_symbol: string) { return 1; }

const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "TVC:SILVER",
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  USDJPY: "FX:USDJPY",
  AUDUSD: "FX:AUDUSD",
  USDCAD: "FX:USDCAD",
  USDCHF: "FX:USDCHF",
  AAPL: "NASDAQ:AAPL",
  TSLA: "NASDAQ:TSLA",
  MSFT: "NASDAQ:MSFT",
  NVDA: "NASDAQ:NVDA",
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  BNB: "BINANCE:BNBUSDT",
  SOL: "BINANCE:SOLUSDT",
  XRP: "BINANCE:XRPUSDT",
};

let tvScriptLoaded = false;
let tvScriptCallbacks: (() => void)[] = [];

function loadTvScript(cb: () => void) {
  if (tvScriptLoaded) { cb(); return; }
  tvScriptCallbacks.push(cb);
  if (document.getElementById("tv-script")) return;
  const s = document.createElement("script");
  s.id = "tv-script";
  s.src = "https://s3.tradingview.com/tv.js";
  s.async = true;
  s.onload = () => {
    tvScriptLoaded = true;
    tvScriptCallbacks.forEach(fn => fn());
    tvScriptCallbacks = [];
  };
  document.head.appendChild(s);
}

let widgetIdCounter = 0;

function TvChartInner({ tvSymbol, height, id }: { tvSymbol: string; height: number | string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    const containerId = id;
    let cancelled = false;

    function buildWidget() {
      if (cancelled) return;
      const el = document.getElementById(containerId);
      if (!el || !(window as any).TradingView) return;
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch (_) {}
        widgetRef.current = null;
      }
      el.innerHTML = "";
      widgetRef.current = new (window as any).TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: "60",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0d0d0d",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        container_id: containerId,
        withdateranges: true,
        hide_volume: false,
        studies: [],
        overrides: {
          "paneProperties.background": "#0d0d0d",
          "paneProperties.backgroundType": "solid",
          "scalesProperties.lineColor": "#333",
          "scalesProperties.textColor": "#888",
          "mainSeriesProperties.candleStyle.upColor": "#22c55e",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        },
      });
    }

    loadTvScript(buildWidget);

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch (_) {}
        widgetRef.current = null;
      }
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
    };
  }, [tvSymbol, id]);

  return (
    <div
      ref={containerRef}
      id={id}
      style={{ width: "100%", height }}
    />
  );
}

function TradingViewChart({ symbol, fillHeight, tradeFooter }: { symbol: string; fillHeight?: boolean; tradeFooter?: React.ReactNode }) {
  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? `FX:${symbol}`;
  const [fullscreen, setFullscreen] = useState(false);
  const idRef = useRef(`tv_${++widgetIdCounter}`);
  const fsIdRef = useRef(`tv_fs_${widgetIdCounter}`);

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  if (fillHeight) {
    return (
      <>
        <div className="h-full w-full flex flex-col overflow-hidden bg-[#0d0d0d]">
          {/* mini header with fullscreen button */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 shrink-0">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">forex.com</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-mono text-muted-foreground">{tvSymbol}</span>
            <span className="flex items-center gap-1 text-[10px] text-green-400 ml-1">
              <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" /> Live
            </span>
            <button
              onClick={() => setFullscreen(true)}
              className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
            >
              <Maximize2 className="w-3 h-3" /> Fullscreen
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <TvChartInner tvSymbol={tvSymbol} height="100%" id={idRef.current} />
          </div>
        </div>

        {fullscreen && (
          <div className="fixed inset-0 z-[100] bg-[#0d0d0d] flex flex-col">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
              <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">forex.com</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono font-bold text-foreground">{tvSymbol}</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-border px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Minimize2 className="w-4 h-4" /> Exit
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <TvChartInner tvSymbol={tvSymbol} height="100%" id={fsIdRef.current} />
            </div>
            {tradeFooter && (
              <div className="shrink-0 bg-card border-t border-border">
                {tradeFooter}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-border bg-[#0d0d0d] mb-4">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">forex.com</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[11px] font-mono text-foreground font-semibold">{tvSymbol}</span>
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
          </span>
          <button
            onClick={() => setFullscreen(true)}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-amber-400 transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
            title="Open fullscreen chart"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fullscreen
          </button>
        </div>
        <TvChartInner tvSymbol={tvSymbol} height={300} id={idRef.current} />
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-[#0d0d0d] flex flex-col">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">forex.com</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono font-bold text-foreground">{tvSymbol}</span>
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">TradingView Advanced Chart · Powered by forex.com</span>
              <button
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-border px-3 py-1.5 rounded-lg transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
                Exit
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <TvChartInner tvSymbol={tvSymbol} height={window.innerHeight - 52} id={fsIdRef.current} />
          </div>
        </div>
      )}
    </>
  );
}

function PlanModal({ plan, onClose, userBalance, onSuccess }: {
  plan: Plan;
  onClose: () => void;
  userBalance: number;
  onSuccess: (plan: Plan, amount: number) => void;
}) {
  const Icon = plan.icon;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [investAmount, setInvestAmount] = useState<number>(0);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<{ amount: number }>({
    resolver: zodResolver(investSchema.refine(d => d.amount >= plan.minInvest, {
      message: `Minimum investment is ${formatCurrency(plan.minInvest)}`,
      path: ["amount"],
    }).refine(d => plan.maxInvest === null || d.amount <= plan.maxInvest, {
      message: `Maximum investment is ${formatCurrency(plan.maxInvest!)}`,
      path: ["amount"],
    }).refine(d => d.amount <= userBalance, {
      message: "Insufficient balance",
      path: ["amount"],
    })),
  });

  const watchAmount = watch("amount") || 0;
  const dailyEarning = watchAmount * plan.dailyPct;
  const monthlyEarning = watchAmount * plan.dailyPct * 30;
  const totalReturn = watchAmount + monthlyEarning;

  const investMutation = useCreateInvestment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/investments"] });
        setStep("success");
        onSuccess(plan, investAmount);
      },
    }
  });

  const onFormSubmit = (data: { amount: number }) => {
    setInvestAmount(data.amount);
    setStep("confirm");
  };

  const onConfirm = () => {
    investMutation.mutate({ data: { planId: plan.id, amount: investAmount } });
  };
  const depositMutation = investMutation; // keep existing pending/disabled wiring below

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        "relative w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden",
        plan.borderColor
      )}>
        {/* Glow */}
        <div className={cn("absolute -top-16 -right-16 w-48 h-48 blur-3xl rounded-full opacity-20 pointer-events-none", plan.bgGlow)} />

        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-background border border-border", plan.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{plan.name} Plan</h2>
              <p className="text-xs text-muted-foreground">{plan.monthlyReturn} monthly return · {plan.duration}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1 hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative p-6 space-y-5">
          {/* Step: Form */}
          {step === "form" && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-xl p-3 border border-border">
                <Wallet className="w-4 h-4 shrink-0" />
                <span>Your balance: <span className="text-foreground font-semibold">{formatCurrency(userBalance)}</span></span>
              </div>

              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Investment Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-lg">$</span>
                    <input
                      {...register("amount")}
                      type="number"
                      step="any"
                      placeholder={`Min. ${formatCurrency(plan.minInvest)}`}
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-4 text-lg font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    />
                  </div>
                  {errors.amount && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.amount.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Range: {formatCurrency(plan.minInvest)} – {plan.maxInvest ? formatCurrency(plan.maxInvest) : "Unlimited"}
                  </p>
                </div>

                {/* Live Earnings Preview */}
                {watchAmount >= plan.minInvest && !errors.amount && (
                  <div className={cn("rounded-xl p-4 border space-y-3", plan.borderColor, `bg-gradient-to-br ${plan.gradientFrom} ${plan.gradientTo}`)}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Returns</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Daily</p>
                        <p className={cn("text-sm font-bold", plan.color)}>{formatCurrency(dailyEarning)}</p>
                      </div>
                      <div className="text-center border-x border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                        <p className={cn("text-base font-extrabold", plan.color)}>{formatCurrency(monthlyEarning)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(totalReturn)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className={cn(
                    "w-full py-4 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2",
                    plan.btnBg
                  )}
                >
                  Review Investment <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <p className="text-muted-foreground text-sm mb-1">You are investing</p>
                <p className="text-4xl font-extrabold text-foreground">{formatCurrency(investAmount)}</p>
                <p className={cn("text-sm font-medium mt-1", plan.color)}>in the {plan.name} Plan</p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 border border-border space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investment</span>
                  <span className="font-semibold text-foreground">{formatCurrency(investAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily return ({plan.dailyReturn})</span>
                  <span className={cn("font-semibold", plan.color)}>+{formatCurrency(investAmount * plan.dailyPct)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly return ({plan.monthlyReturn})</span>
                  <span className={cn("font-semibold", plan.color)}>+{formatCurrency(investAmount * plan.dailyPct * 30)}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-medium text-foreground">Total after 30 days</span>
                  <span className="font-bold text-foreground">{formatCurrency(investAmount + investAmount * plan.dailyPct * 30)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={depositMutation.isPending}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2",
                    plan.btnBg,
                    depositMutation.isPending && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {depositMutation.isPending ? "Processing..." : "Confirm & Invest"}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center space-y-5 py-4">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2", plan.borderColor, `bg-gradient-to-br ${plan.gradientFrom} ${plan.gradientTo}`)}>
                <Check className={cn("w-8 h-8", plan.color)} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Investment Activated!</h3>
                <p className="text-muted-foreground text-sm">
                  Your <span className={cn("font-semibold", plan.color)}>{plan.name} Plan</span> is now active.
                  You'll start earning <span className="font-semibold text-foreground">{plan.dailyReturn}</span> daily.
                </p>
              </div>
              <div className={cn("rounded-xl p-4 border text-sm", plan.borderColor, `bg-gradient-to-br ${plan.gradientFrom} ${plan.gradientTo}`)}>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Amount Invested</span>
                  <span className="font-bold text-foreground">{formatCurrency(investAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected after 30 days</span>
                  <span className={cn("font-bold", plan.color)}>{formatCurrency(investAmount + investAmount * plan.dailyPct * 30)}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className={cn("w-full py-3 rounded-xl text-sm font-bold text-white transition-all", plan.btnBg)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Preview Modal ────────────────────────────────────────────────────
interface OrderPreview {
  tradeType: "buy" | "sell";
  symbol: string;
  name: string;
  icon: string;
  usdAmount: number;
  price: number;
  coinAmount: number;
  lots: number;
  slPips: number | null;
  tpPips: number | null;
  pipVal: number;
}

function OrderPreviewModal({
  preview,
  onConfirm,
  onCancel,
  isPending,
}: {
  preview: OrderPreview;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const isBuy = preview.tradeType === "buy";
  const pip = getPip(preview.symbol);
  const spreadPips = 2;
  const halfSpread = pip.size * spreadPips / 2;
  const fillPrice = isBuy ? preview.price + halfSpread : preview.price - halfSpread;
  const slPrice = preview.slPips ? (isBuy ? fillPrice - pip.size * preview.slPips : fillPrice + pip.size * preview.slPips) : null;
  const tpPrice = preview.tpPips ? (isBuy ? fillPrice + pip.size * preview.tpPips : fillPrice - pip.size * preview.tpPips) : null;
  const slRisk = preview.slPips ? preview.slPips * preview.pipVal : null;
  const tpReward = preview.tpPips ? preview.tpPips * preview.pipVal : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={cn("px-5 py-4 flex items-center gap-3", isBuy ? "bg-green-500/10 border-b border-green-500/20" : "bg-red-500/10 border-b border-red-500/20")}>
          <span className="text-2xl">{preview.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{preview.symbol}</span>
              <span className={cn("px-2 py-0.5 rounded text-xs font-bold tracking-widest", isBuy ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                {isBuy ? "BUY" : "SELL"}
              </span>
              <span className="text-xs text-muted-foreground">Market</span>
            </div>
            <p className="text-xs text-muted-foreground">{preview.name}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fill price banner */}
        <div className={cn("px-5 py-3 flex items-center justify-between border-b border-border", isBuy ? "bg-green-500/5" : "bg-red-500/5")}>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Est. Fill Price</span>
          <span className={cn("font-mono font-extrabold text-2xl", isBuy ? "text-green-400" : "text-red-400")}>
            {fillPrice.toFixed(pip.decimals)}
          </span>
        </div>

        {/* Order Details */}
        <div className="px-5 py-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Volume</span>
            <span className="font-semibold text-foreground">{preview.lots} lots</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spread</span>
            <span className="font-mono text-amber-400">{spreadPips} pips</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pip value</span>
            <span className="font-mono text-foreground">{formatCurrency(preview.pipVal)}/pip</span>
          </div>
          <div className="border-t border-border" />
          {slPrice && (
            <div className="flex justify-between text-sm">
              <span className="text-red-400 font-semibold">Stop Loss</span>
              <span className="font-mono text-red-400">{slPrice.toFixed(pip.decimals)} <span className="text-muted-foreground">({preview.slPips} pips · risk {formatCurrency(slRisk!)})</span></span>
            </div>
          )}
          {tpPrice && (
            <div className="flex justify-between text-sm">
              <span className="text-green-400 font-semibold">Take Profit</span>
              <span className="font-mono text-green-400">{tpPrice.toFixed(pip.decimals)} <span className="text-muted-foreground">({preview.tpPips} pips · reward {formatCurrency(tpReward!)})</span></span>
            </div>
          )}
          <div className="border-t border-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Required Margin</span>
            <span className="text-xl font-extrabold text-foreground">{formatCurrency(preview.usdAmount)}</span>
          </div>
        </div>

        {/* Warning */}
        <div className="mx-5 mb-4 px-3 py-2 rounded-lg bg-secondary/60 border border-border text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
          Market orders fill instantly. Final price may differ slightly from displayed.
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all",
              isBuy ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600",
              isPending && "opacity-60 cursor-not-allowed"
            )}
          >
            {isPending ? "Executing..." : `Place ${isBuy ? "Buy" : "Sell"} Order`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Open Positions Panel ───────────────────────────────────────────────────
interface Holding {
  symbol: string;
  amount: number;
  avgBuyPrice: number;
  currentValue: number;
}

interface Market {
  symbol: string;
  name: string;
  icon: string;
  price: number;
  changePercent24h: number;
}

function OpenPositionsPanel({
  holdings,
  markets,
  onClose,
}: {
  holdings: Holding[];
  markets: Market[];
  onClose: (symbol: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const positions = holdings
    .filter(h => h.amount > 0)
    .map(h => {
      const mkt = markets.find(m => m.symbol === h.symbol);
      const currentPrice = mkt?.price ?? h.currentValue / h.amount;
      const pnl = (currentPrice - h.avgBuyPrice) * h.amount;
      const pnlPct = ((currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100;
      return { ...h, icon: mkt?.icon ?? "💰", name: mkt?.name ?? h.symbol, currentPrice, pnl, pnlPct };
    });

  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
      {/* Panel header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Open Positions</span>
        {positions.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            {positions.length}
          </span>
        )}
        {positions.length > 0 && (
          <span className={cn("text-sm font-bold ml-1", totalPnl >= 0 ? "text-green-400" : "text-red-400")}>
            {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {!collapsed && (
        positions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Wallet className="w-4 h-4 opacity-50" />
            No open positions. Buy a market above to open one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase bg-secondary/20 border-b border-border">
                  <th className="px-4 py-2.5 font-medium text-left">Symbol</th>
                  <th className="px-4 py-2.5 font-medium text-left">Side</th>
                  <th className="px-4 py-2.5 font-medium text-right">Volume</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">P&amp;L</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {positions.map(pos => (
                  <tr key={pos.symbol} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{pos.icon}</span>
                        <div>
                          <div className="font-bold text-foreground">{pos.symbol}</div>
                          <div className="text-xs text-muted-foreground">{pos.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/20">
                        BUY
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatCrypto(pos.amount, pos.symbol)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {formatCurrency(pos.avgBuyPrice, 2, 5)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {formatCurrency(pos.currentPrice, 2, 5)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={cn("font-bold", pos.pnl >= 0 ? "text-green-400" : "text-red-400")}>
                        {pos.pnl >= 0 ? "+" : ""}{formatCurrency(pos.pnl)}
                      </div>
                      <div className={cn("text-xs", pos.pnl >= 0 ? "text-green-500/70" : "text-red-500/70")}>
                        {pos.pnl >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onClose(pos.symbol)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function formatPct(p: number): string {
  const pct = p * 100;
  return `${Number.isInteger(pct) ? pct : parseFloat(pct.toFixed(2))}%`;
}

export default function InvestPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Admin-editable plan overrides (min/max/daily %) from site settings
  const [planSettings, setPlanSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setPlanSettings(data || {}))
      .catch(() => {});
  }, []);

  const plans: Plan[] = useMemo(() => {
    return INVESTMENT_PLANS.map((p) => {
      const g = (suffix: string) => (planSettings[`plan_${p.id}_${suffix}`] ?? "").trim();
      const minRaw = parseFloat(g("min"));
      const maxStr = g("max");
      const maxRaw = maxStr === "" ? NaN : parseFloat(maxStr);
      const pctRaw = parseFloat(g("daily_pct"));

      const minInvest = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : p.minInvest;
      const maxInvest =
        Object.keys(planSettings).length && maxStr === ""
          ? null
          : Number.isFinite(maxRaw) && maxRaw > 0
            ? maxRaw
            : p.maxInvest;
      const dailyPct = Number.isFinite(pctRaw) && pctRaw > 0 && pctRaw <= 100 ? pctRaw / 100 : p.dailyPct;

      return {
        ...p,
        minInvest,
        maxInvest,
        dailyPct,
        dailyReturn: formatPct(dailyPct),
        monthlyReturn: formatPct(dailyPct * 30),
      };
    });
  }, [planSettings]);
  const { data: cryptoMarkets } = useGetMarketPrices({
    query: { queryKey: ["/api/market/prices"], refetchInterval: 5000, refetchOnWindowFocus: true },
  });
  const { data: forexMarkets, isLoading: forexLoading } = useGetForexPrices({
    query: { queryKey: ["/api/market/forex"], refetchInterval: 15000, refetchOnWindowFocus: true },
  });
  const markets = forexMarkets;
  const isLoading = forexLoading;
  const { data: portfolio } = useGetPortfolio();

  const initialTab: "plans" | "trade" =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "trade"
      ? "trade"
      : "plans";
  const [activeTab, setActiveTab] = useState<"plans" | "trade">(initialTab);
  void cryptoMarkets;
  const [openPlan, setOpenPlan] = useState<Plan | null>(null);
  const { data: investments, refetch: refetchInvestments } = useGetInvestments({
    query: { queryKey: ["/api/investments"], refetchInterval: 60000 },
  });
  const activeInvestments = (investments ?? []).filter((i) => i.status === "active");
  const activePlans: Record<string, number> = {};
  for (const inv of activeInvestments) {
    activePlans[inv.planId] = (activePlans[inv.planId] || 0) + inv.amount;
  }

  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);

  const convertMutation = useConvertCrypto({
    mutation: {
      onSuccess: () => {
        const wasBuy = orderPreview?.tradeType === "buy";
        setTradeSuccess(
          wasBuy
            ? `Order filled — bought ${orderPreview?.symbol ?? selectedSymbol}`
            : `Position closed — sold ${orderPreview?.symbol ?? selectedSymbol}`
        );
        setOrderPreview(null);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        reset();
      },
      onError: (err: any) => {
        setTradeError(apiErrorMessage(err, "Failed to complete trade"));
        setOrderPreview(null);
      },
    }
  });

  // Forex-style form state
  const [lots, setLots] = useState("0.01");
  const [slPips, setSlPips] = useState("");
  const [tpPips, setTpPips] = useState("");

  const reset = () => {
    setLots("0.01");
    setSlPips("");
    setTpPips("");
  };

  const filteredMarkets = markets?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const selectedCoin = markets?.find(c => c.symbol === selectedSymbol);
  const holding = portfolio?.holdings.find(h => h.symbol === selectedSymbol);
  const usdtBalance = portfolio?.holdings.find(h => h.symbol === "USDT")?.amount || 0;
  const maxBuy = usdtBalance;

  const lotsNum = Math.max(0.01, parseFloat(lots) || 0.01);

  const openForexOrder = (side: "buy" | "sell") => {
    if (!selectedSymbol || !selectedCoin) return;
    setTradeSuccess(null);
    setTradeError(null);
    const pip = getPip(selectedSymbol);
    const halfSpread = pip.size * 2 / 2;
    const execPrice = side === "buy"
      ? selectedCoin.price + halfSpread
      : selectedCoin.price - halfSpread;
    const usdAmount = lotsNum * pip.lotUsd;
    const pipVal = pipValuePerLot(selectedSymbol) * lotsNum;
    setOrderPreview({
      tradeType: side,
      symbol: selectedSymbol,
      name: selectedCoin.name,
      icon: selectedCoin.icon,
      usdAmount,
      price: execPrice,
      coinAmount: usdAmount / execPrice,
      lots: lotsNum,
      slPips: slPips ? parseFloat(slPips) : null,
      tpPips: tpPips ? parseFloat(tpPips) : null,
      pipVal,
    });
  };

  const confirmOrder = () => {
    if (!orderPreview) return;
    if (orderPreview.tradeType === "buy") {
      // Spend USDT to acquire the asset (USDT ≈ USD)
      convertMutation.mutate({ data: { fromSymbol: "USDT", toSymbol: orderPreview.symbol, fromAmount: orderPreview.usdAmount } });
    } else {
      // Sell the asset back into USDT
      convertMutation.mutate({ data: { fromSymbol: orderPreview.symbol, toSymbol: "USDT", fromAmount: orderPreview.coinAmount } });
    }
  };

  const handleClosePosition = (sym: string) => {
    const h = portfolio?.holdings.find(p => p.symbol === sym);
    if (!h) return;
    const mkt = markets?.find(m => m.symbol === sym);
    setSelectedSymbol(sym);
    setTradeSuccess(null);
    setTradeError(null);
    const pip = getPip(sym);
    // Close at max available
    setOrderPreview({
      tradeType: "sell",
      symbol: sym,
      name: mkt?.name ?? sym,
      icon: mkt?.icon ?? "💰",
      usdAmount: h.currentValue,
      price: mkt?.price ?? h.currentValue / h.amount,
      coinAmount: h.amount,
      lots: Math.max(0.01, parseFloat((h.currentValue / pip.lotUsd).toFixed(2))),
      slPips: null,
      tpPips: null,
      pipVal: pipValuePerLot(sym),
    });
  };

  const isPending = convertMutation.isPending;

  return (
    <DashboardLayout>
      {/* Plan Purchase Modal */}
      {openPlan && (
        <PlanModal
          plan={openPlan}
          userBalance={usdtBalance}
          onClose={() => setOpenPlan(null)}
          onSuccess={() => {
            void refetchInvestments();
          }}
        />
      )}

      {/* Order Preview Modal */}
      {orderPreview && (
        <OrderPreviewModal
          preview={orderPreview}
          onConfirm={confirmOrder}
          onCancel={() => setOrderPreview(null)}
          isPending={isPending}
        />
      )}

      <div className="space-y-6">
        {/* Tab Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex bg-card border border-border p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("plans")}
              className={cn(
                "px-6 py-2.5 text-sm font-semibold rounded-lg transition-all",
                activeTab === "plans" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Investment Plans
            </button>
            <button
              onClick={() => setActiveTab("trade")}
              className={cn(
                "px-6 py-2.5 text-sm font-semibold rounded-lg transition-all",
                activeTab === "trade" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Forex & Gold
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            Balance: <span className="text-foreground font-semibold">{formatCurrency(usdtBalance)} <span className="text-muted-foreground font-normal">USDT</span></span>
          </span>
        </div>

        {/* Investment Plans */}
        {activeTab === "plans" && (
          <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative rounded-2xl overflow-hidden border border-border bg-card px-8 py-10">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-48 bg-yellow-400/10 blur-[80px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-80 h-40 bg-purple-500/10 blur-[80px] rounded-full" />
              </div>
              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4 border border-primary/20">
                  <Zap className="w-3 h-3" /> Earn while you sleep
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Choose Your Investment Plan</h1>
                <p className="text-muted-foreground text-base">
                  Deposit once, earn daily returns automatically. All plans include auto-compounding and are fully managed by our trading algorithms.
                </p>
              </div>
            </div>

            {/* My Investments */}
            {(investments?.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-foreground">My Investments</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(investments ?? []).map((inv: Investment) => {
                    const planMeta = INVESTMENT_PLANS.find((p) => p.id === inv.planId);
                    const color = planMeta?.color ?? "text-primary";
                    const started = new Date(inv.startedAt).getTime();
                    const ends = new Date(inv.endsAt).getTime();
                    const now = Date.now();
                    const totalDays = Math.max(1, Math.round((ends - started) / 86400000));
                    const daysLeft = Math.max(0, Math.ceil((ends - now) / 86400000));
                    const progress = inv.status === "completed" ? 100 : Math.min(100, Math.max(0, ((now - started) / (ends - started)) * 100));
                    return (
                      <Card key={inv.id} className={cn("p-5 space-y-3 border", planMeta?.borderColor)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("font-bold", color)}>{inv.planName} Plan</span>
                          <span className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                            inv.status === "active"
                              ? "text-green-400 border-green-500/30 bg-green-500/10"
                              : "text-muted-foreground border-border bg-secondary"
                          )}>
                            {inv.status === "active" ? "Active" : "Completed"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Capital (locked {totalDays} days)</p>
                            <p className="font-bold text-foreground mono-nums">{formatCurrency(inv.amount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Earned so far</p>
                            <p className={cn("font-bold mono-nums", color)}>+{formatCurrency(inv.earned)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Daily return</p>
                            <p className="font-semibold text-foreground">{(inv.dailyPct * 100).toFixed(2)}% / 24h</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{inv.status === "active" ? "Unlocks in" : "Completed"}</p>
                            <p className="font-semibold text-foreground">
                              {inv.status === "active"
                                ? `${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                                : new Date(inv.completedAt ?? inv.endsAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={cn("h-full rounded-full", planMeta?.bgGlow ?? "bg-primary")} style={{ width: `${progress}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                            <span>{inv.daysAccrued}/{totalDays} daily payouts credited</span>
                            <span>Unlocks {new Date(inv.endsAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {inv.status === "active" && (
                          <p className="text-[11px] text-muted-foreground">
                            Profits are added to your USDT balance every 24 hours. Your capital is released automatically when the plan matures.
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4 Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isActive = !!activePlans[plan.id];

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-2xl border overflow-hidden group transition-all duration-200",
                      isActive ? `${plan.borderColor} ring-1 ring-current` : "border-border hover:border-border/80 hover:scale-[1.01]"
                    )}
                  >
                    <div className={cn("absolute inset-0 bg-gradient-to-b opacity-60", plan.gradientFrom, plan.gradientTo)} />
                    <div className={cn("absolute -top-8 -right-8 w-32 h-32 blur-3xl rounded-full opacity-20 group-hover:opacity-30 transition-opacity", plan.bgGlow)} />

                    {/* Badge */}
                    {plan.badge && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          plan.badge === "Most Popular" && "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30",
                          plan.badge === "Best Value" && "bg-purple-400/20 text-purple-400 border border-purple-400/30",
                          plan.badge === "VIP" && "bg-orange-400/20 text-orange-400 border border-orange-400/30",
                        )}>
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    <div className="relative z-10 p-6 flex flex-col h-full">
                      {/* Icon + Name */}
                      <div className="flex items-center gap-3 mb-5">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-card/80 border border-border", plan.color)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Min: {formatCurrency(plan.minInvest)}{plan.maxInvest ? ` – ${formatCurrency(plan.maxInvest)}` : "+"}
                          </p>
                        </div>
                      </div>

                      {/* Returns */}
                      <div className="bg-card/60 rounded-xl p-4 mb-5 space-y-2 border border-border/50">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Daily Return</span>
                          <span className={cn("text-sm font-bold", plan.color)}>{plan.dailyReturn}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Monthly Return</span>
                          <span className={cn("text-lg font-extrabold", plan.color)}>{plan.monthlyReturn}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Duration</span>
                          <span className="text-sm font-medium text-foreground">{plan.duration}</span>
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="space-y-2 mb-6 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className={cn("w-3.5 h-3.5 shrink-0", plan.color)} />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* Active plan info */}
                      {isActive && (
                        <div className={cn("mb-3 rounded-lg p-2.5 border text-xs text-center", plan.borderColor, `bg-gradient-to-br ${plan.gradientFrom} ${plan.gradientTo}`)}>
                          <span className="text-muted-foreground">Invested: </span>
                          <span className={cn("font-bold", plan.color)}>{formatCurrency(activePlans[plan.id])}</span>
                        </div>
                      )}

                      {/* CTA Button */}
                      <button
                        onClick={() => setOpenPlan(plan)}
                        className={cn(
                          "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 text-white",
                          plan.btnBg
                        )}
                      >
                        {isActive ? (
                          <><ChevronRight className="w-4 h-4" /> Add More</>
                        ) : (
                          <><ChevronRight className="w-4 h-4" /> Buy Plan</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Spot Trade Tab */}
        {activeTab === "trade" && (
          <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-8" style={{ height: "calc(100vh - 310px)" }}>
            {/* Markets List */}
            <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Forex, Gold & Stocks</h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search pair (XAUUSD, EURUSD, AAPL...)"
                    className="pl-10 h-10"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/20 sticky top-0 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Asset</th>
                      <th className="px-4 py-3 font-medium text-right">Price</th>
                      <th className="px-4 py-3 font-medium text-right">24h</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading && (
                      <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">Loading markets...</td></tr>
                    )}
                    {filteredMarkets.map((coin) => {
                      const isSelected = selectedSymbol === coin.symbol;
                      const isPos = coin.changePercent24h >= 0;
                      return (
                        <tr
                          key={coin.symbol}
                          onClick={() => { setSelectedSymbol(coin.symbol); setTradeSuccess(null); setTradeError(null); }}
                          className={cn(
                            "cursor-pointer transition-colors border-l-2",
                            isSelected ? "bg-secondary/50 border-primary" : "hover:bg-secondary/30 border-transparent"
                          )}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{coin.icon}</span>
                              <div>
                                <div className="font-bold text-foreground">{coin.symbol}</div>
                                <div className="text-xs text-muted-foreground">{coin.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(coin.price, 2, 6)}</td>
                          <td className={cn("px-4 py-4 text-right", isPos ? "text-green-400" : "text-red-400")}>
                            {isPos ? "+" : ""}{formatPercent(Math.abs(coin.changePercent24h))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trade Panel */}
            <div className="w-full lg:w-[400px] shrink-0">
              {selectedCoin ? (() => {
                const pip = getPip(selectedCoin.symbol);
                const halfSpread = pip.size;
                const bidPrice = selectedCoin.price - halfSpread;
                const askPrice = selectedCoin.price + halfSpread;
                const spreadPips = 2;
                const marginRequired = lotsNum * pip.lotUsd;
                const pipVal = pipValuePerLot(selectedCoin.symbol) * lotsNum;
                const canTrade = marginRequired <= maxBuy;
                const slNum = parseFloat(slPips) || 0;
                const tpNum = parseFloat(tpPips) || 0;

                return (
                  <Card className="h-full flex flex-col overflow-hidden p-0">

                    {/* ── TOP BAR: balance + symbol ─────────────────────── */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{selectedCoin.icon}</span>
                          <span className="font-bold text-sm">{selectedCoin.symbol}</span>
                          <span className={cn("text-xs font-semibold", selectedCoin.changePercent24h >= 0 ? "text-green-400" : "text-red-400")}>
                            {selectedCoin.changePercent24h >= 0 ? "▲" : "▼"}{formatPercent(Math.abs(selectedCoin.changePercent24h))}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{selectedCoin.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Balance</div>
                        <div className="font-mono font-bold text-base text-foreground">{formatCurrency(maxBuy)}</div>
                      </div>
                    </div>

                    {/* ── CHART (flex-1, fullscreen only — no trading controls) ── */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <TradingViewChart
                        symbol={selectedCoin.symbol}
                        fillHeight
                      />
                    </div>

                    {/* ── CONTROLS: volume + SL/TP (normal view) ────────── */}
                    <div className="shrink-0 px-3 pt-3 pb-2 border-t border-border space-y-2 bg-card">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-0.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Volume (Lots)</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setLots(v => Math.max(0.01, parseFloat(v) - 0.01).toFixed(2))} className="w-8 h-8 rounded bg-secondary hover:bg-border font-bold text-base transition-colors flex items-center justify-center shrink-0">−</button>
                            <Input value={lots} onChange={e => setLots(e.target.value)} className="text-center font-mono font-bold text-sm h-8 px-1" type="number" step="0.01" min="0.01" />
                            <button type="button" onClick={() => setLots(v => (parseFloat(v) + 0.01).toFixed(2))} className="w-8 h-8 rounded bg-secondary hover:bg-border font-bold text-base transition-colors flex items-center justify-center shrink-0">+</button>
                          </div>
                        </div>
                        <div className="shrink-0 text-right space-y-0.5">
                          <div className="text-[10px] text-muted-foreground">Margin</div>
                          <div className={cn("text-xs font-bold", canTrade ? "text-foreground" : "text-red-400")}>{formatCurrency(marginRequired)}</div>
                          <div className="text-[10px] text-muted-foreground">{formatCurrency(pipVal)}/pip</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-0.5">SL (pips)</label>
                          <Input value={slPips} onChange={e => setSlPips(e.target.value)} placeholder="0" className="h-8 text-sm font-mono px-2" type="number" min="0" />
                          {slNum > 0 && <p className="text-[10px] text-red-400 mt-0.5">Risk: {formatCurrency(slNum * pipVal)}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-green-400 uppercase tracking-wider block mb-0.5">TP (pips)</label>
                          <Input value={tpPips} onChange={e => setTpPips(e.target.value)} placeholder="0" className="h-8 text-sm font-mono px-2" type="number" min="0" />
                          {tpNum > 0 && <p className="text-[10px] text-green-400 mt-0.5">Reward: {formatCurrency(tpNum * pipVal)}</p>}
                        </div>
                      </div>
                      {tradeSuccess && (
                        <div className="text-green-400 text-[11px] text-center py-1.5 bg-green-500/10 rounded-lg font-medium flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" /> {tradeSuccess}
                        </div>
                      )}
                      {tradeError && (
                        <div className="text-red-400 text-[11px] text-center py-1.5 bg-red-500/10 rounded-lg font-medium flex items-center justify-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {tradeError}
                        </div>
                      )}
                    </div>

                    {/* ── SELL / BUY — pinned footer (normal view) ─────── */}
                    <div className="shrink-0 grid grid-cols-2 border-t border-border">
                      <button onClick={() => openForexOrder("sell")} disabled={isPending || !canTrade} className="flex flex-col items-center py-3.5 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                        <span className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80">Sell</span>
                        <span className="font-mono font-extrabold text-xl leading-tight">{bidPrice.toFixed(pip.decimals)}</span>
                        <span className="text-[10px] opacity-60 mt-0.5">{spreadPips} pips spread</span>
                      </button>
                      <div className="relative col-span-0">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-full px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{spreadPips}</div>
                      </div>
                      <button onClick={() => openForexOrder("buy")} disabled={isPending || !canTrade} className="flex flex-col items-center py-3.5 bg-[#1565C0] hover:bg-[#1976D2] active:bg-[#0D47A1] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                        <span className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80">Buy</span>
                        <span className="font-mono font-extrabold text-xl leading-tight">{askPrice.toFixed(pip.decimals)}</span>
                        <span className="text-[10px] opacity-60 mt-0.5">{formatCurrency(marginRequired)} margin</span>
                      </button>
                    </div>
                    {!canTrade && (
                      <div className="shrink-0 text-[11px] text-red-400 text-center py-1.5 bg-red-500/10 border-t border-red-500/20">
                        Insufficient balance — reduce lot size
                      </div>
                    )}
                  </Card>
                );
              })() : (
                <Card className="h-full flex items-center justify-center p-6 border-dashed bg-transparent shadow-none">
                  <div className="text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Select a market to start trading</p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          <OpenPositionsPanel
            holdings={(portfolio?.holdings ?? []) as Holding[]}
            markets={(markets ?? []) as Market[]}
            onClose={handleClosePosition}
          />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
