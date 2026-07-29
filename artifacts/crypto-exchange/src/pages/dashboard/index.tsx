import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, Button } from "@/components/ui/shared";
import { useAuth } from "@/hooks/use-auth";
import { useGetPortfolio, useGetMarketPrices } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet, ExternalLink, Radio, ArrowUpFromLine, Repeat } from "lucide-react";
import { Link } from "wouter";

function LivePrice({ value }: { value: number }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      t = setTimeout(() => setFlash(null), 800);
    }
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [value]);
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded transition-colors duration-500",
        flash === "up" && "bg-success/20 text-success",
        flash === "down" && "bg-destructive/20 text-destructive",
      )}
    >
      {formatCurrency(value, 2, 6)}
    </span>
  );
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const { data: portfolio, isLoading: portfolioLoading } = useGetPortfolio();
  const { data: marketData, isLoading: marketLoading } = useGetMarketPrices({
    query: { queryKey: ["/api/market/prices"], refetchInterval: 5000, refetchOnWindowFocus: true },
  });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, {user.name}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link href="/dashboard/deposit">
              <Button variant="secondary" className="font-semibold gap-1.5">
                <Wallet className="w-4 h-4" /> Deposit
              </Button>
            </Link>
            <Link href="/dashboard/withdraw">
              <Button variant="secondary" className="font-semibold gap-1.5">
                <ArrowUpFromLine className="w-4 h-4" /> Withdraw
              </Button>
            </Link>
            <Link href="/dashboard/convert">
              <Button variant="secondary" className="font-semibold gap-1.5">
                <Repeat className="w-4 h-4" /> Convert
              </Button>
            </Link>
            <Link href="/dashboard/invest">
              <Button className="font-semibold gap-1.5">
                <ArrowRightLeft className="w-4 h-4" /> Trade
              </Button>
            </Link>
          </div>
        </header>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-2 bg-gradient-to-br from-secondary to-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Estimated Balance
            </h3>
            {portfolioLoading ? (
              <div className="h-12 w-48 bg-secondary animate-pulse rounded-lg mb-2" />
            ) : (
              <div className="text-4xl md:text-5xl font-display font-bold mono-nums mb-2">
                {formatCurrency(portfolio?.totalValue || 0)}
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Available USD: <span className="text-foreground mono-nums font-medium">{formatCurrency(user.usdBalance)}</span></span>
              {(portfolio?.pendingDeposits ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  Pending Deposit:&nbsp;
                  <span className="mono-nums font-medium text-yellow-400">{formatCurrency(portfolio!.pendingDeposits)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 font-semibold uppercase tracking-wide">Awaiting Approval</span>
                </span>
              )}
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-center">
            <h3 className="text-muted-foreground font-medium mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/portfolio">
                <Button variant="outline" className="w-full justify-between group">
                  Portfolio <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </Button>
              </Link>
              <Link href="/dashboard/transactions">
                <Button variant="outline" className="w-full justify-between group">
                  History <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </Button>
              </Link>
              <Link href="/dashboard/invest" className="col-span-2">
                <Button variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary justify-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" /> Go to Markets
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Market Highlights */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-display font-bold">Trending Markets</h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-[10px] font-bold uppercase tracking-wider">
                <Radio className="w-3 h-3 animate-pulse" /> Live
              </span>
            </div>
            <Link href="/dashboard/invest" className="text-sm font-medium text-primary hover:underline">View All</Link>
          </div>
          
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium text-right">Price</th>
                    <th className="px-6 py-4 font-medium text-right">24h Change</th>
                    <th className="px-6 py-4 font-medium text-right hidden md:table-cell">Market Cap</th>
                    <th className="px-6 py-4 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {marketLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><div className="h-6 w-24 bg-secondary animate-pulse rounded" /></td>
                        <td className="px-6 py-4"><div className="h-6 w-20 bg-secondary animate-pulse rounded ml-auto" /></td>
                        <td className="px-6 py-4"><div className="h-6 w-16 bg-secondary animate-pulse rounded ml-auto" /></td>
                        <td className="px-6 py-4 hidden md:table-cell"><div className="h-6 w-24 bg-secondary animate-pulse rounded ml-auto" /></td>
                        <td className="px-6 py-4"><div className="h-8 w-16 bg-secondary animate-pulse rounded mx-auto" /></td>
                      </tr>
                    ))
                  ) : marketData?.slice(0, 5).map((coin) => {
                    const isPositive = coin.changePercent24h >= 0;
                    return (
                      <tr key={coin.symbol} className="hover:bg-secondary/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{coin.icon}</span>
                            <div>
                              <div className="font-bold text-foreground">{coin.symbol}</div>
                              <div className="text-xs text-muted-foreground">{coin.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right mono-nums font-medium text-foreground">
                          <LivePrice value={coin.price} />
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-right mono-nums font-medium",
                          isPositive ? "text-success" : "text-destructive"
                        )}>
                          <div className="flex items-center justify-end gap-1">
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPercent(Math.abs(coin.changePercent24h))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right mono-nums text-muted-foreground hidden md:table-cell">
                          ${(coin.marketCap / 1e9).toFixed(2)}B
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link href={`/dashboard/invest?symbol=${coin.symbol}`}>
                            <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              Trade
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
