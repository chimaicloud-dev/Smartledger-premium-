import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  History, 
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Landmark,
  Facebook,
  BadgeCheck,
  Repeat,
  Info,
  ShieldCheck,
  Globe2,
  Zap,
  TrendingUp,
  Lock,
  Headphones,
  Calendar,
  ArrowDownToLine as DepositIcon,
  Rocket
} from "lucide-react";
import { Button } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type AboutGuide = {
  id: string;
  question: string;
  icon: React.ComponentType<{ className?: string }>;
  short: string;
  body: React.ReactNode;
};

const ABOUT_GUIDES: AboutGuide[] = [
  {
    id: "why",
    question: "Why do investors choose Smartledger-premium?",
    icon: TrendingUp,
    short: "Built for investors who value security, speed and dependable access.",
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Smartledger-premium has become the destination of choice for both first-time investors
          and seasoned institutional traders. The platform combines a Tier-1 security stack with a
          lightning-fast matching engine and transparent, daily-payout investment plans — a
          combination very few exchanges in the industry can match.
        </p>
        <ul className="grid sm:grid-cols-2 gap-3">
          <li className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
            <Lock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Bank-grade security</div>
              <div className="text-xs">Cold storage, MPC custody and 24/7 risk monitoring keep your assets safe.</div>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
            <Zap className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Daily payouts</div>
              <div className="text-xs">Auto-compounding plans pay out every 24 hours straight to your wallet.</div>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
            <Globe2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Global liquidity</div>
              <div className="text-xs">Deep order books across crypto, forex, gold and equities for tight spreads.</div>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
            <Headphones className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-foreground">24/7 dedicated support</div>
              <div className="text-xs">Real humans on chat, email and WhatsApp — no bots, no waiting rooms.</div>
            </div>
          </li>
        </ul>
        <p>
          Most importantly, every account is fully insured against platform-side breaches and
          backed by our published Certificate of Incorporation, giving investors complete
          peace of mind.
        </p>
      </div>
    ),
  },
  {
    id: "invest",
    question: "How do I invest in Smartledger-premium?",
    icon: Rocket,
    short: "Sign up, fund your account, pick a plan — start earning daily in under 5 minutes.",
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>Getting started is fast and beginner-friendly. Just follow these four steps:</p>
        <ol className="space-y-3">
          {[
            { t: "Create your free account", d: "Click Sign Up, enter your email and a secure password. No credit card required." },
            { t: "Verify your identity (KYC)", d: "Submit your government-issued ID through Settings → Verify Identity. It's processed instantly in our demo environment." },
            { t: "Deposit funds", d: "Use crypto or a wallet address from the Deposit page to top up your balance — minimum is just $50." },
            { t: "Choose an investment plan", d: "Open Invest & Trade and pick one of our five plans (Starter, Balanced, Upgrade, Pro Trader, or Professional). Confirm the amount, and your daily returns start automatically." },
          ].map((step, i) => (
            <li key={i} className="flex gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-foreground">{step.t}</div>
                <div className="text-xs">{step.d}</div>
              </div>
            </li>
          ))}
        </ol>
        <p>
          You can withdraw your earnings at any time from the Withdraw page — there are no
          lock-in periods on your daily payouts.
        </p>
      </div>
    ),
  },
  {
    id: "launch",
    question: "When was Smartledger-premium launched?",
    icon: Calendar,
    short: "Founded in 2018 — eight years of consistent uptime, growth and investor trust.",
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Smartledger-premium was founded in <span className="text-foreground font-semibold">2018</span>{" "}
          by a small team of veteran traders and security engineers who shared a single conviction:
          retail investors deserve the same tools, speed and safeguards as Wall Street institutions.
        </p>
        <p>
          What started as a private trading desk for a handful of clients grew into a global
          investment platform serving people across many countries. Smartledger-premium provides
          access to crypto, forex, gold and equity markets from one account.
        </p>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
            <div className="text-2xl font-display font-bold text-primary">2018</div>
            <div className="text-[11px] uppercase tracking-wide">Founded</div>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
            <div className="text-2xl font-display font-bold text-primary">Global</div>
            <div className="text-[11px] uppercase tracking-wide">Community</div>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
            <div className="text-2xl font-display font-bold text-primary">150+</div>
            <div className="text-[11px] uppercase tracking-wide">Countries</div>
          </div>
        </div>
        <p>
          Through every market cycle since launch — bull runs, bear markets and global volatility —
          Smartledger-premium has maintained <span className="text-foreground font-semibold">100% uptime on
          payouts</span> and never lost a single client deposit. That's the track record we're built on.
        </p>
      </div>
    ),
  },
  {
    id: "deposit",
    question: "How do I deposit in Smartledger-premium?",
    icon: DepositIcon,
    short: "Choose a coin, copy your unique address, send any amount — funds credit instantly.",
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Depositing is fully self-serve and works 24/7. Smartledger-premium accepts the major
          cryptocurrencies, with no minimum and no platform deposit fee.
        </p>
        <ol className="space-y-3">
          {[
            { t: "Log in and open the Deposit page", d: "From your dashboard, click the Deposit button at the top — or select Deposit from the left-hand menu." },
            { t: "Pick the coin you want to deposit", d: "We support BTC, ETH, USDT (TRC-20 / ERC-20), BNB and more. Each network gets its own dedicated address." },
            { t: "Copy your unique deposit address or scan the QR", d: "Send the funds from your external wallet or exchange. Always double-check the network matches." },
            { t: "Wait for network confirmations", d: "Most deposits credit within 2–10 minutes depending on the chain. You'll see the transaction appear in your History as soon as it lands." },
          ].map((step, i) => (
            <li key={i} className="flex gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-foreground">{step.t}</div>
                <div className="text-xs">{step.d}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/90">
            Always send the right asset on the right network. Cross-network transfers
            (e.g. ERC-20 sent to a TRC-20 address) cannot be recovered. When in doubt,
            send a small test deposit first or message us on WhatsApp.
          </p>
        </div>
      </div>
    ),
  },
];

function AboutModal({ onClose }: { onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(ABOUT_GUIDES[0].id);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">About Smartledger-premium</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-sm text-muted-foreground">
            A trusted global investment platform since 2018. Click any question below to read the full guide.
          </p>
          {ABOUT_GUIDES.map((g) => {
            const open = openId === g.id;
            const Icon = g.icon;
            return (
              <div
                key={g.id}
                className={cn(
                  "border rounded-xl overflow-hidden transition-colors",
                  open ? "border-primary/40 bg-secondary/30" : "border-border bg-card hover:border-border/80"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : g.id)}
                  className="w-full flex items-start gap-3 text-left px-4 py-3"
                >
                  <span className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                    open ? "bg-primary/15 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border"
                  )}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{g.question}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{g.short}</span>
                  </span>
                  <span className={cn(
                    "text-xs font-bold mt-2 transition-transform",
                    open ? "rotate-180 text-primary" : "text-muted-foreground"
                  )}>
                    ▾
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-5 pt-1 border-t border-border/60">
                    {g.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [showCert, setShowCert] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute -top-[300px] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <header className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Smartledger-premium" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-display font-bold text-xl tracking-wide">Smartledger-premium</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
            Log In
          </Link>
          <Link href="/register">
            <Button size="sm" className="font-semibold">Sign Up</Button>
          </Link>
        </nav>
      </header>
      <main className="flex-1 relative z-10 flex flex-col">
        {children}
      </main>

      <footer className="relative z-10 border-t border-border/60 mt-12">
        <div className="container mx-auto px-3 sm:px-6 py-5 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-nowrap">
            <button
              type="button"
              onClick={() => setShowCert(true)}
              className="group flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-secondary border border-border hover:border-primary/50 transition-colors shrink-0"
              aria-label="View certificate of incorporation"
            >
              <span className="w-5 h-5 rounded-full overflow-hidden border border-border bg-white flex-shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}images/certificate.jpg`}
                  alt="Certificate of Incorporation"
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Certificate
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary border border-border hover:border-primary/50 hover:text-foreground transition-colors text-[10px] sm:text-xs font-medium text-muted-foreground shrink-0"
            >
              <Info className="w-3 h-3" /> About Us
            </button>
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">Follow us</span>
            <a
              href="https://www.facebook.com/share/1HxbpsHXFA/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors shrink-0"
            >
              <Facebook className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://wa.me/447478989390"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp +44 7478 989390"
              title="+44 7478 989390"
              className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-[#25D366] hover:border-[#25D366]/50 transition-colors shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.42 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.465 3.488"/>
              </svg>
            </a>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground pt-3 border-t border-border/40 w-full justify-center">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Smartledger-premium" className="w-5 h-5 object-contain opacity-80" />
            <span>© {new Date().getFullYear()} Smartledger-premium. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {showCert && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowCert(false)}
        >
          <div
            className="relative max-w-4xl w-full bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Certificate of Incorporation</span>
              </div>
              <button
                onClick={() => setShowCert(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-white">
              <img
                src={`${import.meta.env.BASE_URL}images/certificate.jpg`}
                alt="Smartledger-premium Certificate of Incorporation"
                className="w-full h-auto rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/invest", icon: ArrowRightLeft, label: "Invest & Trade" },
  { href: "/dashboard/portfolio", icon: Wallet, label: "Portfolio" },
  { href: "/dashboard/deposit", icon: ArrowDownToLine, label: "Deposit" },
  { href: "/dashboard/withdraw", icon: ArrowUpFromLine, label: "Withdraw" },
  { href: "/dashboard/convert", icon: Repeat, label: "Convert" },
  { href: "/dashboard/loan", icon: Landmark, label: "Loans" },
  { href: "/dashboard/transactions", icon: History, label: "Transactions" },
];

const SECURITY_ITEMS = [
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

const ADMIN_ITEM = { href: "/admin", icon: ShieldCheck, label: "Admin Panel" };

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => { setIsMobileMenuOpen(false); }, [location]);

  if (!user) return null; // Handled by App router logic

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Smartledger-premium" className="w-8 h-8" />
          <span className="font-display font-bold text-lg">Smartledger-premium</span>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(isMobileMenuOpen || window.innerWidth >= 768) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={cn(
              "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col",
              "md:static md:translate-x-0",
              isMobileMenuOpen ? "top-[73px]" : "hidden md:flex"
            )}
          >
            <div className="p-6 hidden md:block">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Smartledger-premium" className="w-5 h-5 object-contain" />
                </div>
                <span className="font-display font-bold text-xl">Smartledger-premium</span>
              </Link>
            </div>

            <div className="flex-1 px-4 py-6 md:py-2 flex flex-col gap-2 overflow-y-auto">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Menu</div>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <span className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all group cursor-pointer",
                      isActive 
                        ? "bg-secondary text-foreground" 
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}>
                      <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              
              <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                <Shield className="w-3 h-3" /> Security
              </div>
              {SECURITY_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <span className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all group cursor-pointer",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}>
                      <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                      <span className="flex-1">{item.label}</span>
                    </span>
                  </Link>
                );
              })}

              {user.role === "admin" && (
                <>
                  <div className="mt-8 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </div>
                  <Link href={ADMIN_ITEM.href}>
                    <span className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all group cursor-pointer border",
                      location.startsWith("/admin")
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                        : "border-amber-500/20 text-amber-300/90 hover:bg-amber-500/10 hover:text-amber-200"
                    )}>
                      <ADMIN_ITEM.icon className="w-5 h-5 text-amber-400" />
                      <span className="flex-1">{ADMIN_ITEM.label}</span>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                        ADMIN
                      </span>
                    </span>
                  </Link>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border mt-auto">
              <div className="flex items-center gap-3 px-2 py-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold font-display">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.experience} Trader</p>
                </div>
              </div>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
