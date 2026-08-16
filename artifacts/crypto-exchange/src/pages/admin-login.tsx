import { apiErrorMessage } from "@/lib/api-error";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((user) => {
        if (user?.role === "admin") setLocation("/admin");
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      if (data.user?.role !== "admin") {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        throw new Error("Access denied. This portal is for administrators only.");
      }
      setLocation("/admin");
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to login. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(240,185,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(240,185,11,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-4 mx-auto shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            Admin Portal
          </h1>
          <p className="text-sm text-zinc-500">
            Smartledger-premium · Restricted Access
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-full">
            <Lock className="w-2.5 h-2.5" />
            /admin/login
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@yourplatform.com"
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-black/40 border-t-black animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Access Admin Panel
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-6">
          Not an admin?{" "}
          <a href="/login" className="text-zinc-500 hover:text-zinc-400 underline transition-colors">
            Go to user login →
          </a>
        </p>
      </div>
    </div>
  );
}
