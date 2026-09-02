import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Landmark, CheckCircle2, AlertCircle, Clock, TrendingDown,
  ShieldCheck, Percent, Info, BadgeDollarSign, X, ChevronDown, Check, XCircle
} from "lucide-react";
import { useGetLoans, useCreateLoan, useRepayLoan } from "@workspace/api-client-react";
import { apiErrorMessage } from "@/lib/api-error";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLoansQueryKey } from "@workspace/api-client-react";

const LOAN_PLANS = [
  {
    id: "micro",
    label: "Micro Loan",
    range: [100, 2500],
    apr: 8.5,
    terms: [7, 14, 30],
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    badge: null,
    desc: "Quick small loans for short-term needs",
  },
  {
    id: "standard",
    label: "Standard Loan",
    range: [2500, 25000],
    apr: 12.0,
    terms: [30, 60, 90],
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    badge: "Most Popular",
    desc: "Flexible mid-range loans with competitive rates",
  },
  {
    id: "premium",
    label: "Premium Loan",
    range: [25000, 100000],
    apr: 6.5,
    terms: [90, 180, 365],
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    badge: "Best Rate",
    desc: "Large-scale financing at our lowest APR",
  },
  {
    id: "elite",
    label: "Elite Loan",
    range: [100000, 500000],
    apr: 4.9,
    terms: [180, 365, 730],
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "Institutional",
    desc: "Institutional-grade credit with dedicated support",
  },
];

const COLLATERAL = [
  { id: "btc",  label: "Bitcoin (BTC)",  ltv: 70, icon: "₿",  color: "text-orange-400" },
  { id: "eth",  label: "Ethereum (ETH)", ltv: 65, icon: "Ξ",  color: "text-blue-400"   },
  { id: "bnb",  label: "BNB",            ltv: 60, icon: "⬡",  color: "text-yellow-400" },
  { id: "usdt", label: "USDT",           ltv: 85, icon: "₮",  color: "text-green-400"  },
  { id: "sol",  label: "Solana (SOL)",   ltv: 55, icon: "◎",  color: "text-purple-400" },
];

type ActiveLoan = {
  id: string;
  plan: string;
  amount: number;
  apr: number;
  termDays: number;
  startDate: string;
  repayAmount: number;
  collateral: string;
  dueDate: string;
};

function calcRepay(amount: number, apr: number, days: number) {
  return +(amount + amount * (apr / 100) * (days / 365)).toFixed(2);
}

function calcSchedule(amount: number, apr: number, days: number) {
  const repay = calcRepay(amount, apr, days);
  const periods = Math.min(days <= 30 ? days : days <= 90 ? Math.ceil(days / 7) : Math.ceil(days / 30), 12);
  const perPeriod = +(repay / periods).toFixed(2);
  const label = days <= 14 ? "day" : days <= 90 ? "week" : "month";
  return { repay, perPeriod, periods, label };
}

export default function LoanPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: serverLoans, isLoading: loadingLoans } = useGetLoans();
  const createLoanMutation = useCreateLoan();
  const repayLoanMutation = useRepayLoan();

  const [selectedPlan, setSelectedPlan] = useState(LOAN_PLANS[1]);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [termDays, setTermDays] = useState(30);
  const [collateral, setCollateral] = useState(COLLATERAL[0]);
  const [success, setSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repayId, setRepayId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [appDetails, setAppDetails] = useState({
    fullName: user?.name || "",
    dateOfBirth: "",
    country: "",
    residentialAddress: "",
    phone: "",
    idType: "national_id" as "national_id" | "drivers_license" | "passport",
    idNumber: "",
    employmentStatus: "",
    monthlyIncome: "",
    purpose: "",
  });

  const { repay, perPeriod, periods, label } = calcSchedule(loanAmount, selectedPlan.apr, termDays);
  const dailyInterest = +(loanAmount * (selectedPlan.apr / 100) / 365).toFixed(4);
  const totalInterest = +(repay - loanAmount).toFixed(2);
  const [min, max] = selectedPlan.range;

  const clampedAmount = Math.min(Math.max(loanAmount, min), max);
  const sliderPct = ((clampedAmount - min) / (max - min)) * 100;

  const handleApply = () => {
    setError("");
    if (loanAmount < min || loanAmount > max) {
      setError(`Loan amount must be between ${formatCurrency(min)} and ${formatCurrency(max)}.`);
      return;
    }
    if (!appDetails.fullName || !appDetails.dateOfBirth || !appDetails.country ||
        !appDetails.residentialAddress || !appDetails.phone || !appDetails.idNumber ||
        !appDetails.employmentStatus || !appDetails.monthlyIncome || !appDetails.purpose) {
      setError("Please fill out all applicant details before confirming.");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    try {
      setError("");
      await createLoanMutation.mutateAsync({
        data: {
          planId: selectedPlan.id,
          amount: loanAmount,
          termDays,
          collateralSymbol: collateral.id,
          fullName: appDetails.fullName,
          dateOfBirth: appDetails.dateOfBirth,
          country: appDetails.country,
          residentialAddress: appDetails.residentialAddress,
          phone: appDetails.phone,
          idType: appDetails.idType,
          idNumber: appDetails.idNumber,
          employmentStatus: appDetails.employmentStatus,
          monthlyIncome: Number(appDetails.monthlyIncome),
          purpose: appDetails.purpose
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetLoansQueryKey() });
      setConfirmOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Reset form
      setAppDetails({
        fullName: user?.name || "",
        dateOfBirth: "",
        country: "",
        residentialAddress: "",
        phone: "",
        idType: "national_id",
        idNumber: "",
        employmentStatus: "",
        monthlyIncome: "",
        purpose: "",
      });
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to submit loan application"));
      setConfirmOpen(false);
    }
  };

  const handleRepay = async (id: number) => {
    try {
      await repayLoanMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetLoansQueryKey() });
      setRepayId(null);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to repay loan"));
    }
  };

  return (
    <DashboardLayout>
      {/* Confirm Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">Confirm Loan</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                ["Plan", selectedPlan.label],
                ["Loan Amount", formatCurrency(loanAmount)],
                ["APR", `${selectedPlan.apr}%`],
                ["Term", `${termDays} days`],
                ["Collateral", collateral.label],
                ["Total Repayment", formatCurrency(repay)],
                ["Estimated Due Date", `${termDays} days after approval`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-foreground">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              By confirming, you agree to the loan terms. Submitting an application does not guarantee approval. Funds will be disbursed upon successful review.
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmOpen(false)} disabled={createLoanMutation.isPending} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={createLoanMutation.isPending} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {createLoanMutation.isPending ? "Submitting..." : "Confirm Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {repayId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRepayId(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            {(() => {
              const loan = serverLoans?.find(l => l.id === repayId);
              if (!loan) return null;
              return (
                <>
                  <h3 className="font-bold text-foreground text-lg">Repay Loan #{loan.id}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Original Amount</span><span className="font-semibold">{formatCurrency(loan.amount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Repayment</span><span className="font-bold text-foreground">{formatCurrency(loan.repaymentAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-semibold">{loan.dueAt ? new Date(loan.dueAt).toLocaleDateString() : "N/A"}</span></div>
                  </div>
                  {error && (
                    <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setRepayId(null)} disabled={repayLoanMutation.isPending} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors">Cancel</button>
                    <button onClick={() => handleRepay(repayId)} disabled={repayLoanMutation.isPending} className="flex-1 py-3 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-500/90 transition-colors disabled:opacity-50">
                      {repayLoanMutation.isPending ? "Processing..." : "Repay Now"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="max-w-4xl space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Crypto Loans</h1>
            <p className="text-sm text-muted-foreground">Borrow against your crypto holdings — no credit check required</p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Application submitted successfully! It is currently pending admin review.
          </div>
        )}

        {/* Active Loans */}
        {loadingLoans ? (
          <div className="text-sm text-muted-foreground">Loading loans...</div>
        ) : serverLoans && serverLoans.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Landmark className="w-4 h-4" /> My Loan Applications
            </h2>
            <div className="space-y-3">
              {serverLoans.map(loan => (
                <div key={loan.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">#{loan.id}</span>
                      <span className="text-sm font-semibold text-foreground">{loan.planName}</span>
                      {loan.status === "pending" && (
                        <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}
                      {loan.status === "approved" && (
                        <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {loan.status === "rejected" && (
                        <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                      {loan.status === "repaid" && (
                        <span className="text-xs text-blue-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Repaid
                        </span>
                      )}
                    </div>
                    {loan.status === "rejected" && loan.rejectionReason && (
                      <div className="text-xs text-red-400/80 bg-red-500/10 p-2 rounded border border-red-500/20">
                        Reason: {loan.rejectionReason}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {[
                        ["Borrowed", formatCurrency(loan.amount)],
                        ["Repayment", formatCurrency(loan.repaymentAmount)],
                        ["APR", `${loan.apr}%`],
                        ["Due", loan.dueAt ? new Date(loan.dueAt).toLocaleDateString() : "Pending"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-muted-foreground">{k}</p>
                          <p className="font-semibold text-foreground">{v}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Collateral: <span className="text-foreground font-medium">{loan.collateralSymbol.toUpperCase()}</span></p>
                  </div>
                  {loan.status === "approved" && (
                    <button
                      onClick={() => setRepayId(loan.id)}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-bold hover:bg-green-500/20 transition-all"
                    >
                      Repay Loan
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan selector */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Loan Plan</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {LOAN_PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan);
                  setLoanAmount(plan.range[0]);
                  setTermDays(plan.terms[0]);
                  setError("");
                }}
                className={cn(
                  "relative text-left p-4 rounded-2xl border transition-all",
                  selectedPlan.id === plan.id ? `${plan.bg} ${plan.border}` : "border-border bg-card hover:border-border/60 hover:bg-secondary/20"
                )}
              >
                {plan.badge && (
                  <span className={cn("absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", plan.bg, plan.border, plan.color)}>
                    {plan.badge}
                  </span>
                )}
                <Percent className={cn("w-5 h-5 mb-2", selectedPlan.id === plan.id ? plan.color : "text-muted-foreground")} />
                <p className="text-sm font-bold text-foreground">{plan.label}</p>
                <p className={cn("text-xl font-extrabold", plan.color)}>{plan.apr}% <span className="text-xs font-semibold text-muted-foreground">APR</span></p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(plan.range[0])} – {formatCurrency(plan.range[1])}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: configurator */}
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 space-y-6">
            <h2 className="font-bold text-foreground">Configure Your Loan</h2>

            {/* Amount slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Loan Amount</span>
                <span className="font-mono font-bold text-primary text-lg">{formatCurrency(loanAmount)}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={min < 2500 ? 100 : min < 25000 ? 500 : 1000}
                value={loanAmount}
                onChange={e => { setLoanAmount(Number(e.target.value)); setError(""); }}
                className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(min)}</span>
                <span>{formatCurrency(max)}</span>
              </div>
              <div className="flex gap-2 mt-1">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setLoanAmount(Math.round(min + (max - min) * pct / 100))}
                    className="flex-1 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-border transition-all"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Term selector */}
            <div className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Loan Term</span>
              <div className="grid grid-cols-3 gap-2">
                {selectedPlan.terms.map(t => (
                  <button
                    key={t}
                    onClick={() => setTermDays(t)}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                      termDays === t ? `${selectedPlan.bg} ${selectedPlan.border} ${selectedPlan.color}` : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t >= 365 ? `${t / 365}yr` : t >= 30 ? `${t / 30}mo` : `${t}d`}
                  </button>
                ))}
              </div>
            </div>

            {/* Collateral */}
            <div className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Collateral Asset</span>
              <div className="grid grid-cols-5 gap-2">
                {COLLATERAL.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCollateral(c)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold transition-all",
                      collateral.id === c.id ? "border-primary/50 bg-primary/5 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("text-xl", c.color)}>{c.icon}</span>
                    <span>{c.id.toUpperCase()}</span>
                    <span className="text-[10px] text-muted-foreground">{c.ltv}% LTV</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-bold text-sm text-foreground">Applicant Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Full Legal Name</label>
                  <input
                    type="text"
                    value={appDetails.fullName}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date of Birth</label>
                  <input
                    type="date"
                    value={appDetails.dateOfBirth}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Country</label>
                  <input
                    type="text"
                    value={appDetails.country}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="United States"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={appDetails.phone}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="+1 555-0123"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Residential Address</label>
                  <input
                    type="text"
                    value={appDetails.residentialAddress}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, residentialAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="123 Main St, City, State, ZIP"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">ID Type</label>
                  <div className="relative">
                    <select
                      value={appDetails.idType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "national_id" || val === "drivers_license" || val === "passport") {
                          setAppDetails(prev => ({ ...prev, idType: val }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm appearance-none focus:outline-none focus:border-primary/50"
                    >
                      <option value="national_id">National ID</option>
                      <option value="drivers_license">Driver's License</option>
                      <option value="passport">Passport</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">ID Number</label>
                  <input
                    type="text"
                    value={appDetails.idNumber}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, idNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="Document Number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Employment Status</label>
                  <input
                    type="text"
                    value={appDetails.employmentStatus}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, employmentStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="Employed, Self-employed, etc."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Monthly Income (USD)</label>
                  <input
                    type="number"
                    value={appDetails.monthlyIncome}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, monthlyIncome: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    placeholder="5000"
                    min="0"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Loan Purpose</label>
                  <textarea
                    value={appDetails.purpose}
                    onChange={(e) => setAppDetails(prev => ({ ...prev, purpose: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                    placeholder="Briefly describe what you will use this loan for..."
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <button
              onClick={handleApply}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
            >
              Apply for Loan
            </button>
          </div>

          {/* Right: summary */}
          <div className="lg:col-span-2 space-y-4">
            {/* Loan summary */}
            <div className={cn("rounded-2xl border p-5 space-y-3", selectedPlan.bg, selectedPlan.border)}>
              <h3 className="font-bold text-foreground text-sm">Loan Summary</h3>
              {[
                ["Principal", formatCurrency(loanAmount)],
                ["APR", `${selectedPlan.apr}%`],
                ["Term", `${termDays} days`],
                ["Interest", formatCurrency(totalInterest)],
                ["Total Repayment", formatCurrency(repay)],
                [`Per ${label}`, formatCurrency(perPeriod)],
              ].map(([k, v], i) => (
                <div key={k} className={cn("flex justify-between text-sm", i === 4 ? "border-t border-border pt-2 font-bold" : "")}>
                  <span className={i === 4 ? "text-foreground" : "text-muted-foreground"}>{k}</span>
                  <span className={cn("font-mono", i === 4 ? `font-extrabold ${selectedPlan.color}` : "text-foreground")}>{v}</span>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Why Smartledger-premium Loans?</h3>
              {[
                { icon: ShieldCheck, text: "No credit check — collateral based" },
                { icon: BadgeDollarSign, text: "Funds disbursed instantly upon approval" },
                { icon: Clock, text: "Flexible repayment — early repay with no penalty" },
                { icon: TrendingDown, text: "Competitive rates starting at 4.9% APR" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Repayment schedule preview */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Repayment Preview</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {Array.from({ length: Math.min(periods, 6) }).map((_, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label.charAt(0).toUpperCase() + label.slice(1)} {i + 1}</span>
                    <span className="font-mono text-foreground font-semibold">{formatCurrency(perPeriod)}</span>
                  </div>
                ))}
                {periods > 6 && (
                  <p className="text-xs text-muted-foreground text-center">+{periods - 6} more payments...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
