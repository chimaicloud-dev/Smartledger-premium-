import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardOverview from "@/pages/dashboard/index";
import InvestPage from "@/pages/dashboard/invest";
import PortfolioPage from "@/pages/dashboard/portfolio";
import DepositPage from "@/pages/dashboard/deposit";
import WithdrawPage from "@/pages/dashboard/withdraw";
import TransactionsPage from "@/pages/dashboard/transactions";
import SettingsPage from "@/pages/dashboard/settings";
import LoanPage from "@/pages/dashboard/loan";
import ConvertPage from "@/pages/dashboard/convert";
import AdminPage from "@/pages/admin";
import AdminLoginPage from "@/pages/admin-login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import { useEffect } from "react";

declare global {
  interface Window {
    smartsupp?: (...args: unknown[]) => void;
  }
}

function SmartSuppController() {
  const [location] = useLocation();
  useEffect(() => {
    const showChat = location === "/";

    const apply = () => {
      const fn = window.smartsupp;
      if (typeof fn === "function") {
        fn(showChat ? "chat:show" : "chat:hide");
      }
      // Belt and braces: the widget can ignore commands queued before its
      // loader finishes, so also toggle the rendered container directly.
      const el = document.getElementById("smartsupp-widget-container");
      if (el) el.style.display = showChat ? "" : "none";
    };

    apply();
    // Re-apply until the widget has actually loaded (loader is async and
    // can land after this effect runs, e.g. on a hard refresh of /dashboard).
    const interval = window.setInterval(apply, 500);
    const stop = window.setTimeout(() => window.clearInterval(interval), 15000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [location]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground font-medium animate-pulse">Authenticating...</p>
      </div>
    );
  }

  return user ? <Component /> : null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Protected Dashboard Routes */}
      <Route path="/dashboard"><ProtectedRoute component={DashboardOverview} /></Route>
      <Route path="/dashboard/invest"><ProtectedRoute component={InvestPage} /></Route>
      <Route path="/dashboard/portfolio"><ProtectedRoute component={PortfolioPage} /></Route>
      <Route path="/dashboard/deposit"><ProtectedRoute component={DepositPage} /></Route>
      <Route path="/dashboard/withdraw"><ProtectedRoute component={WithdrawPage} /></Route>
      <Route path="/dashboard/convert"><ProtectedRoute component={ConvertPage} /></Route>
      <Route path="/dashboard/transactions"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/dashboard/settings"><ProtectedRoute component={SettingsPage} /></Route>
      <Route path="/dashboard/loan"><ProtectedRoute component={LoanPage} /></Route>

      {/* Admin Panel */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin"><ProtectedRoute component={AdminPage} /></Route>

      <Route>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground mb-6">The page you are looking for doesn't exist or has been moved.</p>
            <a href="/" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors">
              Return Home
            </a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <SmartSuppController />
          <Router />
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
