import { apiErrorMessage } from "@/lib/api-error";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, Button, Input } from "@/components/ui/shared";
import { useAuth } from "@/hooks/use-auth";
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon, Mail, Activity, X, Check, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";
import { useSubmitKyc, useChangePassword } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function KycModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fullName: "", dateOfBirth: "", country: "", idNumber: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useSubmitKyc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setSuccess(true);
        setTimeout(onClose, 1800);
      },
      onError: (err: any) => setError(apiErrorMessage(err, "Verification failed. Please try again.")),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName || !form.dateOfBirth || !form.country || !form.idNumber) {
      setError("Please fill in every field.");
      return;
    }
    mutation.mutate({ data: form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary border border-primary/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Identity Verification</h2>
              <p className="text-xs text-muted-foreground">Required to unlock full account features</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Verification Complete</h3>
                <p className="text-muted-foreground text-sm mt-1">Your account is now fully verified.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Full Legal Name</label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Government ID Number</label>
                <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full h-12 font-semibold" disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Submit Verification"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Your information is encrypted and used only for identity verification.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useChangePassword({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setSuccess(false), 4000);
      },
      onError: (err: any) => setError(apiErrorMessage(err, "Failed to change password. Please try again.")),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    mutation.mutate({ data: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-lg font-display font-bold">Security</h3>
      </div>
      <div className="p-6">
        <form onSubmit={submit} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current Password</label>
            <Input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">New Password</label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <X className="w-4 h-4 shrink-0" />{error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" />Password changed successfully.
            </p>
          )}

          <Button type="submit" className="font-semibold" disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : "Update Password"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [kycOpen, setKycOpen] = useState(false);

  if (!user) return null;

  const isVerified = user.kycStatus === "verified";

  return (
    <DashboardLayout>
      {kycOpen && <KycModal onClose={() => setKycOpen(false)} />}
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-4">
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-display font-bold text-4xl mb-4 shadow-lg shadow-primary/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>

              <div
                className={cn(
                  "mt-6 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
                  isVerified
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}
              >
                {isVerified ? (
                  <><Shield className="w-4 h-4" /> Account Verified</>
                ) : (
                  <><ShieldAlert className="w-4 h-4" /> Unverified Account</>
                )}
              </div>

              {!isVerified && (
                <Button onClick={() => setKycOpen(true)} className="mt-4 w-full font-semibold gap-2">
                  <ShieldCheck className="w-4 h-4" /> Complete KYC Verification
                </Button>
              )}
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-display font-bold">Profile Details</h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><UserIcon className="w-4 h-4"/> Full Name</label>
                    <Input readOnly value={user.name} className="bg-secondary/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4"/> Email Address</label>
                    <Input readOnly value={user.email} className="bg-secondary/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Activity className="w-4 h-4"/> Experience Level</label>
                    <Input readOnly value={user.experience.charAt(0).toUpperCase() + user.experience.slice(1)} className="bg-secondary/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">Member Since</label>
                    <Input readOnly value={format(new Date(user.createdAt), "MMMM d, yyyy")} className="bg-secondary/30 font-mono" />
                  </div>
                </div>
              </div>
            </Card>

            {!isVerified && (
              <Card className="overflow-hidden border-amber-500/30">
                <div className="p-6 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-display font-bold text-amber-400">Verify Your Identity</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Complete KYC verification to unlock higher withdrawal limits, fiat deposits, and full trading features.
                    Without verification your account remains in restricted mode.
                  </p>
                  <Button onClick={() => setKycOpen(true)} className="font-semibold gap-2">
                    <ShieldCheck className="w-4 h-4" /> Start Verification
                  </Button>
                </div>
              </Card>
            )}

            <ChangePasswordSection />

            <Card className="overflow-hidden border-destructive/20">
              <div className="p-6 border-b border-destructive/10 bg-destructive/5">
                <h3 className="text-lg font-display font-bold text-destructive">Danger Zone</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                <Button variant="destructive" disabled>Delete Account</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
