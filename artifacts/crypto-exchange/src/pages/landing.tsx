import { useState, useEffect } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout";
import { Button, Card } from "@/components/ui/shared";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, BarChart3 } from "lucide-react";

const DEFAULTS = {
  home_hero_title: "Invest, trade, and hold crypto securely.",
  home_hero_subtitle:
    "Smartledger-premium provides a professional, high-liquidity environment for both beginners and institutional traders. Choose your path to get started.",
  home_feature1_title: "Bank-grade Security",
  home_feature1_desc: "Your assets are protected by industry-leading protocols.",
  home_feature2_title: "Deep Liquidity",
  home_feature2_desc: "Execute large trades instantly with minimal slippage.",
};

export default function LandingPage() {
  const [cfg, setCfg] = useState(DEFAULTS);

  // Smartsupp live chat — only on the home page
  useEffect(() => {
    if (!(window as any)._smartsupp) {
      (window as any)._smartsupp = {};
    }
    (window as any)._smartsupp.key = "bbc8e7b9068b4286776dd813f1a59eca0f61a5c9";

    if (!document.getElementById("smartsupp-script")) {
      const script = document.createElement("script");
      script.id = "smartsupp-script";
      script.type = "text/javascript";
      script.charset = "utf-8";
      script.async = true;
      script.src = "https://www.smartsuppchat.com/loader.js?";
      document.head.appendChild(script);
    }

    return () => {
      // Hide the widget when navigating away; don't delete non-configurable globals
      try {
        const el = document.getElementById("smartsupp-script");
        el?.parentNode?.removeChild(el);
        document.getElementById("smartsupp-widget-container")?.remove();
        document.getElementById("smartsupp-box")?.remove();
        if ((window as any).smartsupp) {
          (window as any).smartsupp("chat:hide");
        }
      } catch (_) {
        // ignore cleanup errors
      }
    };
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCfg((prev) => {
          const next = { ...prev };
          (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).forEach((k) => {
            if (data[k]) next[k] = data[k];
          });
          return next;
        });
      })
      .catch(() => {});
  }, []);

  return (
    <PublicLayout>
      <div className="flex-1 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 py-12 lg:py-0">
        
        {/* Left Copy */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex-1 max-w-2xl text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> Trusted by users worldwide
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-display leading-[1.1] mb-6">
            {cfg.home_hero_title.includes("crypto") ? (
              <>
                {cfg.home_hero_title.split("crypto")[0]}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">crypto</span>
                {cfg.home_hero_title.split("crypto")[1]}
              </>
            ) : (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{cfg.home_hero_title}</span>
            )}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto lg:mx-0">
            {cfg.home_hero_subtitle}
          </p>

          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto lg:mx-0 text-left">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-primary mt-1 shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">{cfg.home_feature1_title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cfg.home_feature1_desc}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-6 h-6 text-primary mt-1 shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">{cfg.home_feature2_title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cfg.home_feature2_desc}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Cards */}
        <div className="flex-1 w-full max-w-md flex flex-col gap-6 relative">
          <div className="absolute inset-0 -z-10 opacity-30 mix-blend-screen pointer-events-none overflow-hidden rounded-3xl">
            <img src={`${import.meta.env.BASE_URL}images/hero-abstract.png`} alt="Abstract crypto art" className="w-full h-full object-cover object-center scale-150" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link href="/register?level=beginner">
              <Card className="p-6 cursor-pointer group hover:-translate-y-1 transition-all duration-300 hover:shadow-primary/10 hover:border-primary/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="text-primary w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                </div>
                <div className="flex items-center gap-5 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center p-3">
                    <img src={`${import.meta.env.BASE_URL}images/beginner-icon.png`} alt="Beginner" className="w-full h-full object-contain drop-shadow-lg" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-display group-hover:text-primary transition-colors">I'm new to crypto</h3>
                    <p className="text-muted-foreground">Simple tools to invest in your first coin.</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground/80 mt-4">
                  <li className="flex items-center gap-2">✓ Guided investing process</li>
                  <li className="flex items-center gap-2">✓ Educational resources</li>
                  <li className="flex items-center gap-2">✓ Simplified portfolio view</li>
                </ul>
              </Card>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/register?level=experienced">
              <Card className="p-6 cursor-pointer group hover:-translate-y-1 transition-all duration-300 hover:shadow-accent/10 hover:border-accent/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="text-accent w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                </div>
                <div className="flex items-center gap-5 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center p-3">
                    <img src={`${import.meta.env.BASE_URL}images/pro-icon.png`} alt="Experienced" className="w-full h-full object-contain drop-shadow-lg" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-display group-hover:text-accent transition-colors">I'm experienced</h3>
                    <p className="text-muted-foreground">Advanced trading & analytics.</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground/80 mt-4">
                  <li className="flex items-center gap-2">✓ Advanced charting tools</li>
                  <li className="flex items-center gap-2">✓ Lower trading fees</li>
                  <li className="flex items-center gap-2">✓ Full order book access</li>
                </ul>
              </Card>
            </Link>
          </motion.div>
        </div>
      </div>
    </PublicLayout>
  );
}
