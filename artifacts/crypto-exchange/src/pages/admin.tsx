import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/shared";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  Search,
  TrendingUp,
  DollarSign,
  Clock,
  Trash2,
  Edit,
  AlertTriangle,
  Wallet,
  UserPlus,
  FileCheck,
  Crown,
  UserX,
  RefreshCw,
  Settings,
} from "lucide-react";
import {
  useGetAdminStats,
  useGetAdminUsers,
  useGetAdminTransactions,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useApproveAdminTransaction,
  useRejectAdminTransaction,
  useGetAdminKycQueue,
  useApproveAdminKyc,
  useRejectAdminKyc,
  useAdminCreateAdmin,
} from "@workspace/api-client-react";
import type { User, AdminTransaction } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "overview" | "approvals" | "kyc" | "users" | "transactions" | "settings";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl md:text-3xl font-display font-bold">Admin Control Panel</h1>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Full control: approve deposits & withdrawals, verify KYC, manage users, create admins, and audit all transactions.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-semibold text-amber-300">{user.name}</div>
            <div>{user.email}</div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "approvals", label: "Pending", icon: Clock },
            { id: "kyc", label: "KYC Queue", icon: FileCheck },
            { id: "users", label: "Users", icon: Users },
            { id: "transactions", label: "Transactions", icon: TrendingUp },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                tab === t.id
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab onChangeTab={setTab} />}
        {tab === "approvals" && <ApprovalsTab />}
        {tab === "kyc" && <KycTab />}
        {tab === "users" && <UsersTab />}
        {tab === "transactions" && <TransactionsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent, onClick }: {
  icon: any; label: string; value: string; hint?: string; accent?: string; onClick?: () => void;
}) {
  return (
    <div
      className={cn("p-4 rounded-xl bg-card border border-border", onClick && "cursor-pointer hover:border-amber-500/50 transition-colors")}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent ?? "bg-primary/15")}>
          <Icon className={cn("w-4 h-4", accent ? "text-amber-400" : "text-primary")} />
        </div>
        {hint && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{hint}</span>}
      </div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-display font-bold">{value}</div>
    </div>
  );
}

function OverviewTab({ onChangeTab }: { onChangeTab: (t: Tab) => void }) {
  const { data: stats, isLoading, refetch } = useGetAdminStats();
  const { data: admins } = useGetAdminUsers({});
  const adminList = useMemo(() => (admins ?? []).filter((u) => u.role === "admin"), [admins]);

  if (isLoading || !stats) {
    return <div className="text-muted-foreground text-sm">Loading stats...</div>;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={String(stats.totalUsers)} hint={`${stats.totalAdmins} admin`} />
        <StatCard icon={ShieldCheck} label="KYC Verified" value={String(stats.verifiedUsers)} />
        <StatCard icon={Wallet} label="Total Crypto" value={`$${stats.totalCryptoValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Pending Deposits" value={String(stats.pendingDeposits)} accent="bg-amber-500/15" onClick={() => onChangeTab("approvals")} />
        <StatCard icon={Clock} label="Pending Withdrawals" value={String(stats.pendingWithdrawals)} accent="bg-amber-500/15" onClick={() => onChangeTab("approvals")} />
        <StatCard icon={FileCheck} label="Pending KYC" value={String(stats.totalUsers - stats.verifiedUsers - stats.suspendedUsers)} accent="bg-amber-500/15" onClick={() => onChangeTab("kyc")} />
        <StatCard icon={TrendingUp} label="Total Volume" value={`$${stats.totalVolumeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
      </div>

      {(stats.pendingDeposits > 0 || stats.pendingWithdrawals > 0) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-200 mb-1">Action required</div>
            <div className="text-amber-200/80">
              {stats.pendingDeposits} deposit{stats.pendingDeposits !== 1 ? "s" : ""} and{" "}
              {stats.pendingWithdrawals} withdrawal{stats.pendingWithdrawals !== 1 ? "s" : ""} are waiting for your approval.{" "}
              <button className="underline hover:text-amber-200" onClick={() => onChangeTab("approvals")}>Review now →</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <h2 className="font-display font-bold">Admin Accounts</h2>
            <span className="text-xs text-muted-foreground">({adminList.length})</span>
          </div>
          <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {adminList.length === 0 && (
            <div className="px-5 py-4 text-sm text-muted-foreground">No admins found.</div>
          )}
          {adminList.map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">ADMIN</span>
                <KycChip status={a.kycStatus} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    completed: "bg-green-500/15 text-green-400 border-green-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider", styles[status] ?? "bg-secondary border-border text-muted-foreground")}>
      {status}
    </span>
  );
}

function TxRow({ tx, showActions, onChange }: { tx: AdminTransaction; showActions?: boolean; onChange: () => void }) {
  const queryClient = useQueryClient();
  const approve = useApproveAdminTransaction({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); onChange(); } },
  });
  const reject = useRejectAdminTransaction({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); onChange(); } },
  });
  const isBusy = approve.isPending || reject.isPending;

  return (
    <div className="p-3 md:p-4 rounded-xl bg-card border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm capitalize">{tx.type}</span>
            <StatusBadge status={tx.status} />
            {tx.symbol && <span className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground">{tx.symbol}</span>}
            <span className="text-xs text-muted-foreground">#{tx.id}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{tx.userName} · {tx.userEmail}</div>
          <div className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-base">${tx.usdAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          {tx.amount != null && tx.symbol && (
            <div className="text-xs text-muted-foreground">{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {tx.symbol}</div>
          )}
          {tx.coin && <div className="text-[11px] text-muted-foreground">{tx.coin}</div>}
        </div>
      </div>
      {showActions && tx.status === "pending" && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <Button size="sm" variant="success" disabled={isBusy} onClick={() => approve.mutate({ id: tx.id })} className="flex-1">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => reject.mutate({ id: tx.id })} className="flex-1">
            <XCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function ApprovalsTab() {
  const { data: txs, isLoading, refetch } = useGetAdminTransactions({ status: "pending" });
  if (isLoading) return <div className="text-muted-foreground text-sm">Loading...</div>;
  if (!txs || txs.length === 0) {
    return (
      <div className="p-12 rounded-xl bg-card border border-border text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 className="font-semibold mb-1">All clear</h3>
        <p className="text-sm text-muted-foreground">No pending deposits or withdrawals.</p>
      </div>
    );
  }
  const deposits = txs.filter((t) => t.type === "deposit");
  const withdraws = txs.filter((t) => t.type === "withdraw");
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Pending Deposits ({deposits.length})
        </h2>
        <div className="space-y-2">
          {deposits.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 rounded-xl bg-card border border-border">No pending deposits.</div>
          ) : (
            deposits.map((tx) => <TxRow key={tx.id} tx={tx} showActions onChange={() => refetch()} />)
          )}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Pending Withdrawals ({withdraws.length})
        </h2>
        <div className="space-y-2">
          {withdraws.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 rounded-xl bg-card border border-border">No pending withdrawals.</div>
          ) : (
            withdraws.map((tx) => <TxRow key={tx.id} tx={tx} showActions onChange={() => refetch()} />)
          )}
        </div>
      </section>
    </div>
  );
}

function KycTab() {
  const queryClient = useQueryClient();
  const { data: users, isLoading, refetch } = useGetAdminKycQueue();
  const approve = useApproveAdminKyc({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); refetch(); } },
  });
  const reject = useRejectAdminKyc({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); refetch(); } },
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading KYC queue...</div>;

  if (!users || users.length === 0) {
    return (
      <div className="p-12 rounded-xl bg-card border border-border text-center">
        <FileCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 className="font-semibold mb-1">KYC queue is empty</h3>
        <p className="text-sm text-muted-foreground">No pending KYC submissions to review.</p>
      </div>
    );
  }

  const isBusy = approve.isPending || reject.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Pending KYC Verifications ({users.length})
        </h2>
        <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{u.name}</span>
                  <KycChip status={u.kycStatus} />
                  {u.role === "admin" && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">ADMIN</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                <div className="text-xs text-muted-foreground">
                  User #{u.id} · Joined {new Date(u.createdAt).toLocaleDateString()} · {u.experience}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground mb-3">
              KYC submitted — waiting for manual review. Use the buttons below to approve or reject this user's identity verification.
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                className="flex-1"
                disabled={isBusy}
                onClick={() => approve.mutate({ userId: u.id })}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve KYC
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={isBusy}
                onClick={() => reject.mutate({ userId: u.id })}
              >
                <XCircle className="w-4 h-4 mr-1" /> Reject KYC
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading, refetch } = useGetAdminUsers({ search: search || undefined });
  const [editing, setEditing] = useState<User | null>(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading users...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateAdmin(true)} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" /> Add Admin
        </Button>
      </div>

      <div className="space-y-2">
        {users?.map((u) => (
          <div key={u.id} className="p-3 md:p-4 rounded-xl bg-card border border-border">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{u.name}</span>
                  {u.role === "admin" && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">ADMIN</span>
                  )}
                  {u.status === "suspended" && (
                    <span className="text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">SUSPENDED</span>
                  )}
                  <KycChip status={u.kycStatus} />
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="text-xs text-muted-foreground">
                  ID #{u.id} · Joined {new Date(u.createdAt).toLocaleDateString()} · {u.experience}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                <Edit className="w-3.5 h-3.5 mr-1" /> Manage
              </Button>
            </div>
          </div>
        ))}
        {users?.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground rounded-xl bg-card border border-border">
            No users found.
          </div>
        )}
      </div>

      {editing && (
        <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />
      )}
      {showCreateAdmin && (
        <CreateAdminModal onClose={() => setShowCreateAdmin(false)} onSaved={() => { setShowCreateAdmin(false); refetch(); }} />
      )}
    </div>
  );
}

function KycChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-green-500/15 text-green-400 border-green-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    unverified: "bg-secondary text-muted-foreground border-border",
  };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", map[status] ?? map.unverified)}>
      KYC: {status}
    </span>
  );
}

function UserEditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [adjustSymbol, setAdjustSymbol] = useState("USDT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [kycStatus, setKycStatus] = useState(user.kycStatus);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  const update = useUpdateAdminUser({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); onSaved(); } },
  });
  const del = useDeleteAdminUser({
    mutation: { onSuccess: () => { queryClient.invalidateQueries(); onSaved(); } },
  });

  const submit = () => {
    const data: any = {};
    if (kycStatus !== user.kycStatus) data.kycStatus = kycStatus;
    if (role !== user.role) data.role = role;
    if (status !== user.status) data.status = status;
    const adj = Number(adjustAmount);
    if (adjustAmount && !Number.isNaN(adj) && adj !== 0) {
      data.adjustSymbol = adjustSymbol;
      data.adjustAmount = adj;
    }
    update.mutate({ id: user.id, data });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg">Manage User #{user.id}</h3>
            <p className="text-xs text-muted-foreground">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Adjust coin balance (+/− amount in coin units, logs as transaction)">
            <div className="flex gap-2">
              <SelectField value={adjustSymbol} onChange={setAdjustSymbol} options={["USDT", "BTC", "ETH", "BNB", "SOL", "XRP", "LTC", "TRX", "DOGE"]} />
              <Input type="number" step="any" placeholder="e.g. +500 or -200" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
            </div>
          </Field>
          <Field label="KYC Status">
            <SelectField value={kycStatus} onChange={(v) => setKycStatus(v as any)} options={["unverified", "pending", "verified", "rejected"]} />
          </Field>
          <Field label="Role">
            <SelectField value={role} onChange={(v) => setRole(v as any)} options={["user", "admin"]} />
          </Field>
          <Field label="Account Status">
            <SelectField value={status} onChange={(v) => setStatus(v as any)} options={["active", "suspended"]} />
          </Field>
        </div>
        {update.isError && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            Failed to save. Please try again.
          </div>
        )}
        <div className="p-5 border-t border-border flex gap-2 flex-wrap">
          <Button onClick={submit} disabled={update.isPending} className="flex-1">
            {update.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="destructive"
            disabled={del.isPending}
            onClick={() => {
              if (confirm(`Permanently delete ${user.email}? This removes all their holdings and transactions.`)) {
                del.mutate({ id: user.id });
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateAdminModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const create = useAdminCreateAdmin({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries(); onSaved(); },
    },
  });

  const submit = () => {
    if (!email || !password || !name) return;
    create.mutate({ data: { email, password, name } });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Crown className="w-5 h-5 text-amber-400" />
              <h3 className="font-display font-bold text-lg">Create Admin Account</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              If the email already exists, the user is promoted to admin. Otherwise a new admin account is created.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4 shrink-0"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Admin Name">
            <Input placeholder="e.g. John Smith" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email Address">
            <Input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" placeholder="Strong password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        {create.isError && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {(create.error as any)?.message || "Failed to create admin. Check email and try again."}
          </div>
        )}
        {create.isSuccess && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400">
            Admin account created / promoted successfully.
          </div>
        )}
        <div className="p-5 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !email || !password || !name} className="flex-1">
            <UserPlus className="w-4 h-4 mr-2" />
            {create.isPending ? "Creating..." : "Create Admin"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-foreground capitalize"
    >
      {options.map((o) => (
        <option key={o} value={o} className="capitalize">{o}</option>
      ))}
    </select>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsField({
  label, value, onChange, placeholder, mono, area, type,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; area?: boolean; type?: string;
}) {
  const cls = cn(
    "w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors",
    mono && "font-mono text-xs"
  );
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cn(cls, "resize-y")} />
      ) : (
        <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}

function SettingsTab() {
  const [panel, setPanel] = useState<"payment" | "homepage" | "email">("payment");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setSettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const upd = (key: string, val: string) => setSettings((p) => ({ ...p, [key]: val }));
  const s = (key: string, def = "") => settings[key] ?? def;

  const saveSection = async (keys: string[]) => {
    setSaving(true);
    setSaveMsg(null);
    const body: Record<string, string> = {};
    keys.forEach((k) => { body[k] = settings[k] ?? ""; });
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      setSaveMsg("✓ Saved successfully");
    } catch {
      setSaveMsg("✗ Failed to save — please try again");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const PAYMENT_KEYS = ["payment_btc_address","payment_eth_address","payment_usdt_trc20_address","payment_usdt_erc20_address","payment_bnb_address","payment_sol_address","payment_xrp_address","payment_ltc_address","payment_trx_address","payment_doge_address","payment_bank_enabled","payment_bank_name","payment_bank_account_name","payment_bank_account_number","payment_bank_routing","payment_bank_swift"];
  const HOME_KEYS = ["home_hero_title","home_hero_subtitle","home_badge_text","home_feature1_title","home_feature1_desc","home_feature2_title","home_feature2_desc"];
  const EMAIL_KEYS = ["email_smtp_host","email_smtp_port","email_smtp_user","email_smtp_pass","email_from_name","email_from_address","email_support_address"];

  if (loading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading settings...</div>;

  return (
    <div className="space-y-4">
      {/* Sub-tab selector */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit">
        {(["payment", "homepage", "email"] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPanel(p); setSaveMsg(null); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              panel === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p === "payment" ? "💳 Payment Details" : p === "homepage" ? "🏠 Homepage" : "📧 Email"}
          </button>
        ))}
      </div>

      {saveMsg && (
        <div className={cn("p-3 rounded-xl text-sm text-center font-medium", saveMsg.startsWith("✓") ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400")}>
          {saveMsg}
        </div>
      )}

      {/* ── PAYMENT PANEL ── */}
      {panel === "payment" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-400" /> Crypto Wallet Addresses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Shown to users on the Deposit page. Change any address to redirect deposits.</p>
            </div>
            <div className="p-5 space-y-4">
              <SettingsField label="Bitcoin (BTC)" value={s("payment_btc_address")} onChange={(v) => upd("payment_btc_address", v)} placeholder="bc1q..." mono />
              <SettingsField label="Ethereum — ERC-20 (ETH)" value={s("payment_eth_address")} onChange={(v) => upd("payment_eth_address", v)} placeholder="0x..." mono />
              <SettingsField label="USDT — TRC-20 (Tron)" value={s("payment_usdt_trc20_address")} onChange={(v) => upd("payment_usdt_trc20_address", v)} placeholder="T..." mono />
              <SettingsField label="USDT — ERC-20 (Ethereum)" value={s("payment_usdt_erc20_address")} onChange={(v) => upd("payment_usdt_erc20_address", v)} placeholder="0x..." mono />
              <SettingsField label="BNB — BNB Smart Chain" value={s("payment_bnb_address")} onChange={(v) => upd("payment_bnb_address", v)} placeholder="bnb..." mono />
              <SettingsField label="Solana (SOL)" value={s("payment_sol_address")} onChange={(v) => upd("payment_sol_address", v)} placeholder="Solana address" mono />
              <SettingsField label="XRP — XRP Ledger" value={s("payment_xrp_address")} onChange={(v) => upd("payment_xrp_address", v)} placeholder="r..." mono />
              <SettingsField label="Litecoin (LTC)" value={s("payment_ltc_address")} onChange={(v) => upd("payment_ltc_address", v)} placeholder="L..." mono />
              <SettingsField label="Tron (TRX)" value={s("payment_trx_address")} onChange={(v) => upd("payment_trx_address", v)} placeholder="T..." mono />
              <SettingsField label="Dogecoin (DOGE)" value={s("payment_doge_address")} onChange={(v) => upd("payment_doge_address", v)} placeholder="D..." mono />
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> Bank Account Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Shown to users who choose fiat / bank transfer deposits.</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Bank transfer payments</p>
                  <p className="text-xs text-muted-foreground mt-0.5">When off, users won't see the bank transfer option on the Deposit page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => upd("payment_bank_enabled", s("payment_bank_enabled") === "true" ? "false" : "true")}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors shrink-0",
                    s("payment_bank_enabled") === "true" ? "bg-primary" : "bg-border"
                  )}
                  aria-pressed={s("payment_bank_enabled") === "true"}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    s("payment_bank_enabled") === "true" && "translate-x-6"
                  )} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsField label="Bank Name" value={s("payment_bank_name")} onChange={(v) => upd("payment_bank_name", v)} placeholder="First National Bank" />
                <SettingsField label="Account Name" value={s("payment_bank_account_name")} onChange={(v) => upd("payment_bank_account_name", v)} placeholder="Smartledger Premium LLC" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SettingsField label="Account Number" value={s("payment_bank_account_number")} onChange={(v) => upd("payment_bank_account_number", v)} placeholder="1234567890" mono />
                <SettingsField label="Routing / Sort Code" value={s("payment_bank_routing")} onChange={(v) => upd("payment_bank_routing", v)} placeholder="021000021" mono />
                <SettingsField label="SWIFT / BIC" value={s("payment_bank_swift")} onChange={(v) => upd("payment_bank_swift", v)} placeholder="FNBAUS33" mono />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveSection(PAYMENT_KEYS)} disabled={saving} className="min-w-[160px]">
              {saving ? "Saving..." : "Save Payment Settings"}
            </Button>
          </div>
        </div>
      )}

      {/* ── HOMEPAGE PANEL ── */}
      {panel === "homepage" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold">Hero Section</h3>
              <p className="text-xs text-muted-foreground mt-0.5">The main headline visitors see on the homepage.</p>
            </div>
            <div className="p-5 space-y-4">
              <SettingsField label="Badge Text" value={s("home_badge_text")} onChange={(v) => upd("home_badge_text", v)} placeholder="Trusted by 10M+ Users Worldwide" />
              <SettingsField label="Hero Title" value={s("home_hero_title")} onChange={(v) => upd("home_hero_title", v)} placeholder="Invest, trade, and hold crypto securely." />
              <SettingsField label="Hero Subtitle / Description" value={s("home_hero_subtitle")} onChange={(v) => upd("home_hero_subtitle", v)} placeholder="Platform description..." area />
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold">Feature Highlights</h3>
              <p className="text-xs text-muted-foreground mt-0.5">The two bullet points shown under the hero text.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-border">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Feature 1</p>
                  <SettingsField label="Title" value={s("home_feature1_title")} onChange={(v) => upd("home_feature1_title", v)} placeholder="Bank-grade Security" />
                  <SettingsField label="Description" value={s("home_feature1_desc")} onChange={(v) => upd("home_feature1_desc", v)} placeholder="Short description..." area />
                </div>
                <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-border">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Feature 2</p>
                  <SettingsField label="Title" value={s("home_feature2_title")} onChange={(v) => upd("home_feature2_title", v)} placeholder="Deep Liquidity" />
                  <SettingsField label="Description" value={s("home_feature2_desc")} onChange={(v) => upd("home_feature2_desc", v)} placeholder="Short description..." area />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveSection(HOME_KEYS)} disabled={saving} className="min-w-[160px]">
              {saving ? "Saving..." : "Save Homepage Settings"}
            </Button>
          </div>
        </div>
      )}

      {/* ── EMAIL PANEL ── */}
      {panel === "email" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold">SMTP Configuration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Used to send automated emails (deposit confirmations, KYC updates, alerts).</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <SettingsField label="SMTP Host" value={s("email_smtp_host")} onChange={(v) => upd("email_smtp_host", v)} placeholder="smtp.gmail.com" />
                </div>
                <SettingsField label="Port" value={s("email_smtp_port")} onChange={(v) => upd("email_smtp_port", v)} placeholder="587" />
              </div>
              <SettingsField label="SMTP Username" value={s("email_smtp_user")} onChange={(v) => upd("email_smtp_user", v)} placeholder="user@gmail.com" />
              <SettingsField label="SMTP Password" value={s("email_smtp_pass")} onChange={(v) => upd("email_smtp_pass", v)} placeholder="App password or API key" type="password" />
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold">Sender Identity</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsField label="From Name" value={s("email_from_name")} onChange={(v) => upd("email_from_name", v)} placeholder="Smartledger Premium" />
                <SettingsField label="From Email" value={s("email_from_address")} onChange={(v) => upd("email_from_address", v)} placeholder="noreply@smartledger.pro" />
              </div>
              <SettingsField label="Support Email" value={s("email_support_address")} onChange={(v) => upd("email_support_address", v)} placeholder="support@smartledger.pro" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveSection(EMAIL_KEYS)} disabled={saving} className="min-w-[160px]">
              {saving ? "Saving..." : "Save Email Settings"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: txs, isLoading, refetch } = useGetAdminTransactions({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });

  const filtered = useMemo(() => txs ?? [], [txs]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <SelectField value={statusFilter} onChange={setStatusFilter} options={["", "pending", "completed", "rejected"]} />
        <SelectField value={typeFilter} onChange={setTypeFilter} options={["", "deposit", "withdraw", "buy", "sell", "convert"]} />
        <button onClick={() => refetch()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} records</span>
      </div>
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading transactions...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground rounded-xl bg-card border border-border">No transactions match these filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <TxRow key={tx.id} tx={tx} showActions onChange={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
