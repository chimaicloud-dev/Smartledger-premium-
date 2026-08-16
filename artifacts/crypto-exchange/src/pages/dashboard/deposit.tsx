import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useDeposit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Copy, CheckCircle2, ArrowDownToLine, Clock, ShieldCheck,
  AlertTriangle, ChevronRight, Info, RefreshCw, Loader2, ExternalLink
} from "lucide-react";
import { CoinLogo } from "@/components/ui/CoinLogo";

const CRYPTO_NETWORKS = [
  {
    id: "btc",
    label: "Bitcoin",
    symbol: "BTC",
    icon: "₿",
    network: "Bitcoin Network",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    btnBg: "bg-orange-500/15 hover:bg-orange-500/25",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    minDeposit: 0.0001,
    minUsd: "$5",
    confirmations: 3,
    time: "~30 min",
    memo: false,
  },
  {
    id: "eth",
    label: "Ethereum",
    symbol: "ETH",
    icon: "Ξ",
    network: "ERC-20",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    btnBg: "bg-blue-500/15 hover:bg-blue-500/25",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    minDeposit: 0.001,
    minUsd: "$3",
    confirmations: 12,
    time: "~5 min",
    memo: false,
  },
  {
    id: "usdt_trc20",
    label: "USDT TRC-20",
    symbol: "USDT",
    icon: "₮",
    network: "Tron (TRC-20)",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    btnBg: "bg-green-500/15 hover:bg-green-500/25",
    address: "TDsG7ND7s5e4oCKAE1kcHmzJEknxnUFAHY",
    minDeposit: 1,
    minUsd: "$1",
    confirmations: 20,
    time: "~2 min",
    memo: false,
  },
  {
    id: "usdt_erc20",
    label: "USDT ERC-20",
    symbol: "USDT",
    icon: "₮",
    network: "Ethereum (ERC-20)",
    color: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    btnBg: "bg-emerald-400/15 hover:bg-emerald-400/25",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    minDeposit: 1,
    minUsd: "$1",
    confirmations: 12,
    time: "~5 min",
    memo: false,
  },
  {
    id: "bnb",
    label: "BNB",
    symbol: "BNB",
    icon: "⬡",
    network: "BNB Smart Chain",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    btnBg: "bg-yellow-500/15 hover:bg-yellow-500/25",
    address: "bnb136ns6lfw4zs5hg4n85vdthaad7hq5m4gtkgf23",
    minDeposit: 0.01,
    minUsd: "$2",
    confirmations: 15,
    time: "~1 min",
    memo: false,
  },
  {
    id: "sol",
    label: "Solana",
    symbol: "SOL",
    icon: "◎",
    network: "Solana Network",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    btnBg: "bg-purple-500/15 hover:bg-purple-500/25",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    minDeposit: 0.01,
    minUsd: "$1",
    confirmations: 32,
    time: "~30 sec",
    memo: false,
  },
  {
    id: "xrp",
    label: "XRP",
    symbol: "XRP",
    icon: "✕",
    network: "XRP Ledger",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    btnBg: "bg-sky-500/15 hover:bg-sky-500/25",
    address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    minDeposit: 10,
    minUsd: "$5",
    confirmations: 1,
    time: "~5 sec",
    memo: true,
    memoValue: "104857600",
  },
  {
    id: "ltc",
    label: "Litecoin",
    symbol: "LTC",
    icon: "Ł",
    network: "Litecoin Network",
    color: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    btnBg: "bg-slate-500/15 hover:bg-slate-500/25",
    address: "LTdsVS8VDw6syvfQADdhf2PHAm3rMGJvPX",
    minDeposit: 0.01,
    minUsd: "$1",
    confirmations: 6,
    time: "~10 min",
    memo: false,
  },
  {
    id: "trx",
    label: "TRON",
    symbol: "TRX",
    icon: "⬤",
    network: "Tron Network",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    btnBg: "bg-red-500/15 hover:bg-red-500/25",
    address: "TDsG7ND7s5e4oCKAE1kcHmzJEknxnUFAHY",
    minDeposit: 100,
    minUsd: "$2",
    confirmations: 20,
    time: "~1 min",
    memo: false,
  },
  {
    id: "doge",
    label: "Dogecoin",
    symbol: "DOGE",
    icon: "Ð",
    network: "Dogecoin Network",
    color: "text-amber-300",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    btnBg: "bg-amber-400/15 hover:bg-amber-400/25",
    address: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
    minDeposit: 50,
    minUsd: "$3",
    confirmations: 6,
    time: "~5 min",
    memo: false,
  },
];

type Coin = typeof CRYPTO_NETWORKS[0];

export default function DepositPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Coin>(CRYPTO_NETWORKS[0]);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);
  const [submittedCoin, setSubmittedCoin] = useState("");
  const [submittedNetwork, setSubmittedNetwork] = useState("");
  const [submittedIcon, setSubmittedIcon] = useState("");
  const [submittedSymbol, setSubmittedSymbol] = useState("");
  const [submittedAddress, setSubmittedAddress] = useState("");
  const [submittedConfirmations, setSubmittedConfirmations] = useState(0);
  const [submittedTime, setSubmittedTime] = useState("");
  const [submittedTxId, setSubmittedTxId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedDepAddr, setCopiedDepAddr] = useState(false);
  const [settingsAddrs, setSettingsAddrs] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<"crypto" | "bank">("crypto");
  const [bankAmount, setBankAmount] = useState("");
  const [bankConfirmed, setBankConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then(setSettingsAddrs)
      .catch(() => {});
  }, []);

  const ADDR_KEY: Record<string, string> = {
    btc: "payment_btc_address",
    eth: "payment_eth_address",
    usdt_trc20: "payment_usdt_trc20_address",
    usdt_erc20: "payment_usdt_erc20_address",
    bnb: "payment_bnb_address",
    sol: "payment_sol_address",
    xrp: "payment_xrp_address",
    ltc: "payment_ltc_address",
    trx: "payment_trx_address",
    doge: "payment_doge_address",
  };
  const currentAddr = (ADDR_KEY[selected.id] && settingsAddrs[ADDR_KEY[selected.id]]) || selected.address;
  const bankEnabled = settingsAddrs.payment_bank_enabled === "true";

  const handleBankSubmit = () => {
    const num = parseFloat(bankAmount);
    if (!num || num <= 0) return;
    const txId = "DP" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setSubmittedAmount(num);
    setSubmittedCoin("Bank Transfer");
    setSubmittedNetwork("Bank Transfer");
    setSubmittedIcon("");
    setSubmittedSymbol("USD");
    setSubmittedAddress(settingsAddrs.payment_bank_account_number || "");
    setSubmittedConfirmations(0);
    setSubmittedTime("1-3 business days");
    setSubmittedTxId(txId);
    setSubmittedAt(timestamp);
    mutate({ data: { amount: num, method: "bank", address: settingsAddrs.payment_bank_account_number || "", symbol: "USDT" } });
    setBankAmount("");
    setBankConfirmed(false);
  };

  const { mutate, isPending } = useDeposit({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        setAmount("");
        setConfirmed(false);
      }
    }
  });

  const handleCopy = (text: string, which: "addr" | "memo") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "addr") {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    } else {
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  const handleCopyField = (text: string, which: "tx" | "addr") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "tx") { setCopiedTx(true); setTimeout(() => setCopiedTx(false), 1800); }
    else { setCopiedDepAddr(true); setTimeout(() => setCopiedDepAddr(false), 1800); }
  };

  const shortAddr = (a: string) => a.length > 20 ? `${a.slice(0, 10)}...${a.slice(-8)}` : a;

  const handleConfirmSent = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    const txId = "DP" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setSubmittedAmount(num);
    setSubmittedCoin(selected.label);
    setSubmittedNetwork(selected.network);
    setSubmittedIcon(selected.icon);
    setSubmittedSymbol(selected.symbol);
    setSubmittedAddress(currentAddr);
    setSubmittedConfirmations(selected.confirmations);
    setSubmittedTime(selected.time);
    setSubmittedTxId(txId);
    setSubmittedAt(timestamp);
    mutate({ data: { amount: num, method: selected.id, address: currentAddr, symbol: selected.symbol } });
  };

  if (success) {
    const steps = [
      { label: "Pending",      done: true,  active: false },
      { label: "Confirming",   done: false, active: true  },
      { label: "Credited",     done: false, active: false },
    ];

    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-8 space-y-5">

          {/* Page title */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSuccess(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Deposit Record</h1>
          </div>

          {/* Status hero */}
          <div className="bg-card border border-border rounded-2xl px-6 py-7 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-sm font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Awaiting Confirmations
              </span>
            </div>
            {/* Big amount */}
            <div className="pt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                {submittedIcon} {formatCurrency(submittedAmount)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{submittedSymbol} · {submittedCoin}</p>
            </div>
            <p className="text-xs text-muted-foreground">{submittedAt}</p>
          </div>

          {/* Progress tracker */}
          <div className="bg-card border border-border rounded-2xl px-6 py-5">
            <div className="relative flex items-start justify-between">
              {/* Connecting line */}
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-border mx-8">
                <div className="h-full bg-green-500/60 w-[35%]" />
              </div>
              {steps.map((step) => (
                <div key={step.label} className="relative flex flex-col items-center gap-2 flex-1">
                  <div className={cn(
                    "w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 transition-all",
                    step.done   ? "bg-green-500/20 border-green-500/60" :
                    step.active ? "bg-blue-500/15 border-blue-500/50 animate-pulse" :
                                  "bg-background border-border"
                  )}>
                    {step.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      : step.active
                        ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        : <span className="w-2 h-2 rounded-full bg-border" />
                    }
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold text-center",
                    step.done ? "text-green-400" : step.active ? "text-blue-400" : "text-muted-foreground"
                  )}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                Confirmations required: <span className="text-foreground font-semibold">0 / {submittedConfirmations}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Estimated credit time: <span className="text-foreground font-semibold">{submittedTime}</span>
              </p>
            </div>
          </div>

          {/* Detail rows */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-sm font-bold text-foreground">Deposit Details</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Coin",              value: `${submittedIcon} ${submittedCoin}`,    mono: false, copy: null },
                { label: "Network",           value: submittedNetwork,                        mono: false, copy: null },
                { label: "Deposit Amount",    value: formatCurrency(submittedAmount),         mono: true,  copy: null, highlight: true },
                { label: "Deposit Address",   value: shortAddr(submittedAddress),             mono: true,  copy: "addr" as const },
                { label: "Deposit ID",        value: submittedTxId,                           mono: true,  copy: "tx"   as const },
                { label: "Confirmations",     value: `0 / ${submittedConfirmations}`,         mono: false, copy: null },
                { label: "Submission Time",   value: submittedAt,                             mono: false, copy: null },
                { label: "Status",            value: "Awaiting Confirmations",                mono: false, copy: null, status: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5 gap-4">
                  <span className="text-sm text-muted-foreground shrink-0 w-36">{row.label}</span>
                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className={cn(
                      "text-sm text-right truncate",
                      row.mono ? "font-mono" : "",
                      (row as any).highlight ? "font-bold text-primary" :
                      (row as any).status    ? "text-blue-400 font-semibold" : "text-foreground font-medium"
                    )}>
                      {row.value}
                    </span>
                    {row.copy === "tx" && (
                      <button onClick={() => handleCopyField(submittedTxId, "tx")} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        {copiedTx ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {row.copy === "addr" && (
                      <button onClick={() => handleCopyField(submittedAddress, "addr")} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        {copiedDepAddr ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notice */}
          <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            Your deposit will be credited automatically once the required confirmations are reached on-chain. Contact support if it has not arrived within 24 hours.
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setSuccess(false)}
              className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={() => setSuccess(false)}
              className="px-5 py-3.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> History
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-7">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deposit Crypto</h1>
            <p className="text-sm text-muted-foreground">Select a coin and send to your unique deposit address</p>
          </div>
        </div>

        {/* Method switcher (bank shows only when admin enables it) */}
        {bankEnabled && (
          <div className="flex bg-secondary p-1 rounded-xl gap-1 w-full max-w-sm">
            {([["crypto", "Crypto"], ["bank", "Bank Transfer"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setPayMode(m)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  payMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Bank transfer panel */}
        {bankEnabled && payMode === "bank" && (
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Account Details</p>
              {[
                ["Bank Name", settingsAddrs.payment_bank_name],
                ["Account Name", settingsAddrs.payment_bank_account_name],
                ["Account Number", settingsAddrs.payment_bank_account_number],
                ["Routing / Sort Code", settingsAddrs.payment_bank_routing],
                ["SWIFT / BIC", settingsAddrs.payment_bank_swift],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-border/60 last:border-0 pb-2.5 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground font-mono truncate">{value || "—"}</span>
                    {value && (
                      <button onClick={() => navigator.clipboard.writeText(value).catch(() => {})} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3.5 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              Send the exact amount from your bank to the account above, then confirm below. Bank deposits are credited manually after the transfer clears (1-3 business days).
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount Sent (USD)</label>
                <input
                  type="number"
                  value={bankAmount}
                  onChange={e => setBankAmount(e.target.value)}
                  placeholder="0.00"
                  step="any"
                  min="0"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-base font-semibold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setBankConfirmed(v => !v)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                    bankConfirmed ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                  )}
                >
                  {bankConfirmed && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I confirm I have sent the above amount via bank transfer to the account shown.
                </span>
              </label>

              <button
                onClick={handleBankSubmit}
                disabled={isPending || !bankAmount || !bankConfirmed || parseFloat(bankAmount) <= 0}
                className={cn(
                  "w-full py-3.5 rounded-xl text-sm font-bold transition-all",
                  isPending || !bankAmount || !bankConfirmed || parseFloat(bankAmount) <= 0
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isPending ? "Confirming..." : "Confirm Bank Deposit"}
              </button>
            </div>
          </div>
        )}

        {(!bankEnabled || payMode === "crypto") && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: coin list */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Coin</p>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border max-h-[520px] overflow-y-auto">
              {CRYPTO_NETWORKS.map(coin => (
                <button
                  key={coin.id}
                  onClick={() => { setSelected(coin); setCopiedAddr(false); setCopiedMemo(false); setConfirmed(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-l-4",
                    selected.id === coin.id
                      ? `${coin.bg} ${coin.border}`
                      : "border-transparent hover:bg-secondary/30"
                  )}
                >
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                    <CoinLogo symbol={coin.symbol} size={9} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", selected.id === coin.id ? coin.color : "text-foreground")}>{coin.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{coin.network}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{coin.time}</p>
                    <p className="text-xs text-muted-foreground">{coin.confirmations} conf.</p>
                  </div>
                  {selected.id === coin.id && <ChevronRight className={cn("w-4 h-4 shrink-0", coin.color)} />}
                </button>
              ))}
            </div>
          </div>

          {/* Right: address panel */}
          <div className="lg:col-span-3 space-y-4">

            {/* Coin header */}
            <div className={cn("flex items-center gap-3 px-5 py-4 rounded-2xl border", selected.bg, selected.border)}>
              <div className="w-12 h-12 flex items-center justify-center">
                <CoinLogo symbol={selected.symbol} size={12} />
              </div>
              <div>
                <p className="font-bold text-foreground">{selected.label}</p>
                <p className="text-sm text-muted-foreground">{selected.network}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selected.time}</span>
                <span>{selected.confirmations} confirmations</span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Only send <span className="text-foreground font-semibold">{selected.symbol}</span> on the <span className="text-foreground font-semibold">{selected.network}</span> network to this address. Sending any other coin or using a different network will result in permanent loss of funds.
              </p>
            </div>

            {/* Address card */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your {selected.symbol} Deposit Address</p>
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active
                </span>
              </div>

              {/* QR-style block */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* QR placeholder */}
                <div className={cn("w-28 h-28 shrink-0 rounded-xl border-2 flex items-center justify-center mx-auto sm:mx-0", selected.border, selected.bg)}>
                  <div className="grid grid-cols-5 gap-0.5 p-2 w-full h-full">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const seed = selected.id.charCodeAt(i % selected.id.length) + i;
                      const filled = seed % 3 !== 0;
                      return (
                        <div
                          key={i}
                          className={cn("rounded-sm", filled ? selected.bg.replace("/10", "/60") : "bg-transparent")}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className={cn("bg-background border rounded-xl px-4 py-3 font-mono text-xs text-foreground break-all leading-relaxed", selected.border)}>
                    {currentAddr}
                  </div>
                  <button
                    onClick={() => handleCopy(currentAddr, "addr")}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border",
                      copiedAddr
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : `${selected.btnBg} ${selected.border} ${selected.color}`
                    )}
                  >
                    {copiedAddr
                      ? <><CheckCircle2 className="w-4 h-4" /> Address Copied!</>
                      : <><Copy className="w-4 h-4" /> Copy Address</>
                    }
                  </button>
                </div>
              </div>

              {/* Memo / Destination Tag */}
              {selected.memo && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Memo / Destination Tag Required
                  </div>
                  <p className="text-xs text-muted-foreground">You MUST include this memo/tag when sending or your deposit will be lost.</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background border border-red-500/30 rounded-xl px-4 py-2.5 font-mono text-sm text-foreground font-bold">
                      {(selected as any).memoValue}
                    </div>
                    <button
                      onClick={() => handleCopy((selected as any).memoValue, "memo")}
                      className="p-2.5 rounded-xl border border-border bg-secondary hover:bg-border transition-colors"
                    >
                      {copiedMemo ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border text-center">
                {[
                  ["Min Deposit", selected.minUsd],
                  ["Confirmations", `${selected.confirmations}x`],
                  ["Est. Time", selected.time],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground mb-0.5">{k}</p>
                    <p className="text-sm font-bold text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* I've sent section */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Already sent? Confirm your deposit</p>
              </div>
              <p className="text-xs text-muted-foreground">After sending, enter the amount and click confirm. Your balance will be credited once the network confirms the transaction.</p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount Sent ({selected.symbol})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2"><CoinLogo symbol={selected.symbol} size={6} /></span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3.5 text-base font-semibold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setConfirmed(v => !v)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                    confirmed ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                  )}
                >
                  {confirmed && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I confirm I have sent <span className="text-foreground font-semibold">{selected.symbol}</span> on the <span className="text-foreground font-semibold">{selected.network}</span> network to the address above.
                </span>
              </label>

              <button
                onClick={handleConfirmSent}
                disabled={isPending || !amount || !confirmed || parseFloat(amount) <= 0}
                className={cn(
                  "w-full py-3.5 rounded-xl text-sm font-bold transition-all",
                  isPending || !amount || !confirmed || parseFloat(amount) <= 0
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isPending ? "Confirming..." : "Confirm Deposit"}
              </button>
            </div>

            {/* Security note */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ShieldCheck, text: "Addresses are unique to your account and fully secured." },
                { icon: Info, text: "Minimum deposits below the threshold will not be credited." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2 bg-card border border-border rounded-xl p-3.5">
                  <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}
