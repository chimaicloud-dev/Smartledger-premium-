import { apiErrorMessage } from "@/lib/api-error";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import {
  getGetWithdrawalAddressesQueryKey,
  useDeleteWithdrawalAddress,
  useGetPortfolio,
  useGetWithdrawalAddresses,
  useWithdraw,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2, AlertCircle, ChevronRight, Clock,
  ArrowUpFromLine, Copy, Info, Loader2, ExternalLink, ShieldCheck, Trash2
} from "lucide-react";

// fee is denominated in the coin itself
const CRYPTO_METHODS = [
  { id: "btc",        label: "Bitcoin",       symbol: "BTC", icon: "₿",  network: "Bitcoin Network",   fee: 0.0005, time: "~30 min",  color: "text-orange-400",  bg: "bg-orange-500/10", border: "border-orange-500/30" },
  { id: "eth",        label: "Ethereum",      symbol: "ETH", icon: "Ξ",  network: "ERC-20",            fee: 0.002,  time: "~5 min",   color: "text-blue-400",    bg: "bg-blue-500/10",   border: "border-blue-500/30"   },
  { id: "usdt_trc20", label: "USDT TRC-20",   symbol: "USDT",icon: "₮",  network: "Tron (TRC-20)",     fee: 1,      time: "~2 min",   color: "text-green-400",   bg: "bg-green-500/10",  border: "border-green-500/30"  },
  { id: "usdt_erc20", label: "USDT ERC-20",   symbol: "USDT",icon: "₮",  network: "Ethereum (ERC-20)", fee: 5,      time: "~5 min",   color: "text-green-300",   bg: "bg-green-400/10",  border: "border-green-400/30"  },
  { id: "bnb",        label: "BNB",           symbol: "BNB", icon: "⬡",  network: "BNB Smart Chain",   fee: 0.001,  time: "~1 min",   color: "text-yellow-400",  bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  { id: "sol",        label: "Solana",        symbol: "SOL", icon: "◎",  network: "Solana Network",    fee: 0.01,   time: "~30 sec",  color: "text-purple-400",  bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { id: "xrp",        label: "XRP",           symbol: "XRP", icon: "✕",  network: "XRP Ledger",        fee: 0.2,    time: "~5 sec",   color: "text-sky-400",     bg: "bg-sky-500/10",    border: "border-sky-500/30"    },
  { id: "ltc",        label: "Litecoin",      symbol: "LTC", icon: "Ł",  network: "Litecoin Network",  fee: 0.001,  time: "~10 min",  color: "text-slate-300",   bg: "bg-slate-500/10",  border: "border-slate-500/30"  },
  { id: "trx",        label: "TRON",          symbol: "TRX", icon: "⬤",  network: "Tron Network",      fee: 1,      time: "~1 min",   color: "text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/30"    },
  { id: "doge",       label: "Dogecoin",      symbol: "DOGE",icon: "Ð",  network: "Dogecoin Network",  fee: 5,      time: "~5 min",   color: "text-amber-300",   bg: "bg-amber-400/10",  border: "border-amber-400/30"  },
];

function fmtCoin(n: number, sym: string) {
  const s = n.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return `${s} ${sym}`;
}

export default function WithdrawPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: portfolio } = useGetPortfolio();
  const { data: savedAddresses = [] } = useGetWithdrawalAddresses();
  const kycVerified = user?.kycStatus === "verified";
  const [selectedCrypto, setSelectedCrypto] = useState(CRYPTO_METHODS[0]);
  const [amount, setAmount] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [copied, setCopied] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);
  const [submittedMethod, setSubmittedMethod] = useState("");
  const [submittedTime, setSubmittedTime] = useState("");
  const [submittedReceive, setSubmittedReceive] = useState(0);
  const [submittedFeeLabel, setSubmittedFeeLabel] = useState("");
  const [submittedAddress, setSubmittedAddress] = useState("");
  const [submittedSymbol, setSubmittedSymbol] = useState("");
  const [submittedIcon, setSubmittedIcon] = useState("");
  const [submittedNetwork, setSubmittedNetwork] = useState("");
  const [submittedTxId, setSubmittedTxId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedSentAddr, setCopiedSentAddr] = useState(false);
  const savedAddress = savedAddresses.find(item => item.method === selectedCrypto.id);

  useEffect(() => {
    setCryptoAddress(savedAddress?.address ?? "");
  }, [savedAddress?.address, selectedCrypto.id]);

  const deleteAddress = useDeleteWithdrawalAddress({
    mutation: {
      onSuccess: () => {
        setCryptoAddress("");
        queryClient.invalidateQueries({ queryKey: getGetWithdrawalAddressesQueryKey() });
      },
    },
  });

  const { mutate, isPending, error } = useWithdraw({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: getGetWithdrawalAddressesQueryKey() });
        setAmount("");
      }
    }
  });

  // Available balance for the selected coin
  const coinHolding = portfolio?.holdings.find(h => h.symbol === selectedCrypto.symbol);
  const maxAvailable = coinHolding?.amount ?? 0;
  const numAmount = parseFloat(amount) || 0;
  const fee = selectedCrypto.fee;
  const feeLabel = fmtCoin(fee, selectedCrypto.symbol);
  const receive = numAmount > fee ? numAmount - fee : 0;
  const overBalance = numAmount > maxAvailable;

  const handleSubmit = () => {
    setFieldError("");
    if (!numAmount || numAmount <= 0) { setFieldError("Enter a valid amount."); return; }
    if (overBalance) { setFieldError(`Amount exceeds your available ${selectedCrypto.symbol} balance.`); return; }
    if (numAmount <= fee) { setFieldError(`Amount must be greater than the fee (${feeLabel}).`); return; }
    if (!cryptoAddress.trim()) { setFieldError("Enter a valid wallet address."); return; }

    const txId = "WD" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    setSubmittedAmount(numAmount);
    setSubmittedMethod(selectedCrypto.label);
    setSubmittedNetwork(selectedCrypto.network);
    setSubmittedTime(selectedCrypto.time);
    setSubmittedReceive(numAmount > fee ? numAmount - fee : 0);
    setSubmittedFeeLabel(feeLabel);
    setSubmittedAddress(cryptoAddress.trim());
    setSubmittedSymbol(selectedCrypto.symbol);
    setSubmittedIcon(selectedCrypto.icon);
    setSubmittedTxId(txId);
    setSubmittedAt(timestamp);
    mutate({ data: { amount: numAmount, method: selectedCrypto.id, address: cryptoAddress.trim() } });
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyField = (text: string, which: "tx" | "addr") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "tx") { setCopiedTx(true); setTimeout(() => setCopiedTx(false), 1800); }
    else { setCopiedSentAddr(true); setTimeout(() => setCopiedSentAddr(false), 1800); }
  };

  const shortAddr = (a: string) => a.length > 20 ? `${a.slice(0, 10)}...${a.slice(-8)}` : a;

  if (success) {
    const steps = [
      { label: "Submitted",    done: true,  active: false },
      { label: "Verification", done: true,  active: false },
      { label: "Processing",   done: false, active: true  },
      { label: "Completed",    done: false, active: false },
    ];

    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-8 space-y-5">

          {/* Page title */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSuccess(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Withdrawal Record</h1>
          </div>

          {/* Status hero */}
          <div className="bg-card border border-border rounded-2xl px-6 py-7 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-yellow-400 animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-sm font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Processing
              </span>
            </div>
            {/* Big amount */}
            <div className="pt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                {submittedIcon} {fmtCoin(submittedAmount, submittedSymbol)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{submittedSymbol} · {submittedMethod}</p>
            </div>
            <p className="text-xs text-muted-foreground">{submittedAt}</p>
          </div>

          {/* Progress tracker */}
          <div className="bg-card border border-border rounded-2xl px-6 py-5">
            <div className="relative flex items-start justify-between">
              {/* Connecting line */}
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-border mx-6">
                <div className="h-full bg-green-500/60 w-[55%]" />
              </div>
              {steps.map((step) => (
                <div key={step.label} className="relative flex flex-col items-center gap-2 flex-1">
                  <div className={cn(
                    "w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 transition-all",
                    step.done  ? "bg-green-500/20 border-green-500/60" :
                    step.active? "bg-yellow-500/15 border-yellow-500/50 animate-pulse" :
                                 "bg-background border-border"
                  )}>
                    {step.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      : step.active
                        ? <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                        : <span className="w-2 h-2 rounded-full bg-border" />
                    }
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold text-center leading-tight",
                    step.done ? "text-green-400" : step.active ? "text-yellow-400" : "text-muted-foreground"
                  )}>{step.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Estimated arrival: <span className="text-foreground font-semibold">{submittedTime}</span>
            </p>
          </div>

          {/* Detail rows */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-sm font-bold text-foreground">Withdrawal Details</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Coin",               value: `${submittedIcon} ${submittedMethod}`,       mono: false, copy: null },
                { label: "Network",            value: submittedNetwork,                             mono: false, copy: null },
                { label: "Withdrawal Amount",  value: fmtCoin(submittedAmount, submittedSymbol),    mono: true,  copy: null },
                { label: "Withdrawal Fee",     value: submittedFeeLabel,                            mono: true,  copy: null },
                { label: "Amount Received",    value: fmtCoin(submittedReceive, submittedSymbol),   mono: true,  copy: null, highlight: true },
                { label: "Address",            value: shortAddr(submittedAddress),                  mono: true,  copy: "addr" as const },
                { label: "Withdraw ID",        value: submittedTxId,                                mono: true,  copy: "tx" as const  },
                { label: "Submission Time",    value: submittedAt,                                  mono: false, copy: null },
                { label: "Status",             value: "Processing",                                 mono: false, copy: null, status: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5 gap-4">
                  <span className="text-sm text-muted-foreground shrink-0 w-36">{row.label}</span>
                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className={cn(
                      "text-sm text-right truncate",
                      row.mono ? "font-mono" : "",
                      (row as any).highlight ? "font-bold text-primary" :
                      (row as any).status ? "text-yellow-400 font-semibold" : "text-foreground font-medium"
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
                        {copiedSentAddr ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
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
            Withdrawal is being processed on the blockchain. You will receive a notification once confirmed. Contact support if it has not arrived within 24 hours.
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setSuccess(false)}
              className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Withdraw Again
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

  if (!kycVerified) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Withdraw</h1>
              <p className="text-sm text-muted-foreground">Send crypto to an external wallet</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">Verify your identity to withdraw</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                For your security, withdrawals require a completed KYC verification.
                You can still deposit, invest, and trade in the meantime — only withdrawals are locked until you're verified.
              </p>
            </div>
            {user?.kycStatus === "pending" ? (
              <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <Clock className="w-4 h-4" /> Your KYC is under review — we'll notify you once it's approved.
              </div>
            ) : (
              <a
                href="/dashboard/settings"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" /> Complete KYC Verification
              </a>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-7">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ArrowUpFromLine className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Withdraw</h1>
            <p className="text-sm text-muted-foreground">
              Available: <span className="text-foreground font-mono font-semibold">{fmtCoin(maxAvailable, selectedCrypto.symbol)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: method selector */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Network</p>

            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border max-h-[480px] overflow-y-auto">
              {CRYPTO_METHODS.map(m => {
                const bal = portfolio?.holdings.find(h => h.symbol === m.symbol)?.amount ?? 0;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedCrypto(m); setFieldError(""); setAmount(""); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all",
                      selectedCrypto.id === m.id ? `${m.bg} ${m.border} border-l-4` : "hover:bg-secondary/30 border-l-4 border-transparent"
                    )}
                  >
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg border", m.bg, m.border, m.color)}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", selectedCrypto.id === m.id ? m.color : "text-foreground")}>{m.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.network}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-muted-foreground">{bal > 0 ? bal.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"}</p>
                      {selectedCrypto.id === m.id && <ChevronRight className={cn("w-4 h-4 ml-auto", m.color)} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

              {/* Selected method info banner */}
              <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm", selectedCrypto.bg, selectedCrypto.border)}>
                <span className={cn("text-xl font-bold", selectedCrypto.color)}>{selectedCrypto.icon}</span>
                <div>
                  <span className="font-semibold text-foreground">{selectedCrypto.label}</span>
                  <span className="text-muted-foreground"> · {selectedCrypto.network}</span>
                </div>
                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> {selectedCrypto.time}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex justify-between">
                  <span>Amount ({selectedCrypto.symbol})</span>
                  <button onClick={() => setAmount(String(maxAvailable))} className="text-primary hover:text-primary/80 font-bold transition-colors">MAX</button>
                </label>
                <div className="relative">
                  <span className={cn("absolute left-4 top-1/2 -translate-y-1/2 text-xl", selectedCrypto.color)}>{selectedCrypto.icon}</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setFieldError(""); }}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-4 text-xl font-semibold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>
                {overBalance && <p className="text-xs text-red-400">Amount exceeds your available {selectedCrypto.symbol} balance.</p>}
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount(String(+(maxAvailable * pct / 100).toFixed(8)))}
                      className="flex-1 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-border transition-all"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallet address */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between gap-3">
                  <span>{selectedCrypto.label} Wallet Address</span>
                  {savedAddress && (
                    <button
                      type="button"
                      onClick={() => deleteAddress.mutate({ method: selectedCrypto.id })}
                      disabled={deleteAddress.isPending}
                      className="normal-case tracking-normal inline-flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deleteAddress.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Delete saved address
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cryptoAddress}
                    onChange={e => { setCryptoAddress(e.target.value); setFieldError(""); }}
                     readOnly={Boolean(savedAddress)}
                    placeholder={`Paste your ${selectedCrypto.symbol} address here...`}
                     className={cn(
                       "w-full bg-background border border-border rounded-xl px-4 py-3.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all",
                       savedAddress && "bg-secondary/30 cursor-default"
                     )}
                  />
                  {cryptoAddress && (
                    <button onClick={() => handleCopyAddress(cryptoAddress)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    {savedAddress
                      ? "This address is saved for future withdrawals. Delete it above before using a different address."
                      : <>Your first successful withdrawal address will be saved for this network. Only use a <span className="font-semibold text-foreground">{selectedCrypto.network}</span> address.</>}
                  </span>
                </p>
              </div>

              {/* Fee breakdown */}
              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Withdrawal Amount</span>
                  <span className="font-mono">{numAmount > 0 ? fmtCoin(numAmount, selectedCrypto.symbol) : "—"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Network Fee</span>
                  <span className="font-mono text-red-400">− {feeLabel}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground border-t border-border pt-2">
                  <span>You Will Receive</span>
                  <span className="font-mono text-green-400">{receive > 0 ? fmtCoin(receive, selectedCrypto.symbol) : "—"}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                  <Clock className="w-3 h-3" />
                  Estimated: {selectedCrypto.time}
                </div>
              </div>

              {(error || fieldError) && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{fieldError || (error ? apiErrorMessage(error, "Withdrawal failed. Please try again.") : "Withdrawal failed. Please try again.")}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isPending || !numAmount || overBalance}
                className={cn(
                  "w-full py-4 rounded-xl text-sm font-bold transition-all",
                  isPending || !numAmount || overBalance
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isPending ? "Processing..." : `Withdraw ${numAmount > 0 ? fmtCoin(numAmount, selectedCrypto.symbol) : ""}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
