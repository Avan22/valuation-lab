"use client";
import ScenarioLibrary from "@/components/ScenarioLibrary";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Calculator,
  Sparkles,
  TrendingUp,
  Shield,
  Briefcase,
  Building2,
  Sigma,
  Sun,
  Moon,
  Info,
  Activity,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";

/**
 * Valuation Lab — single-file app page
 *
 * ✅ Fully client-side DCF + LBO + Risk tools
 * ✅ Smooth UI transitions + animated KPIs
 * ✅ Live-ish market strip via /api/markets (you add the route file)
 *
 * IMPORTANT:
 * - The valuation math is consistent.
 * - “Accuracy” depends on your inputs and data quality.
 * - “True real-time” index feeds usually require a paid provider / API key.
 */

// -------------------------
// Helpers (math/finance)
// -------------------------

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

const fmt = (n: number, dp = 2) => {
  if (!isFinite(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(dp)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(dp)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(dp)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(dp)}K`;
  return n.toFixed(dp);
};

const pct = (n: number, dp = 2) =>
  isFinite(n) ? `${(n * 100).toFixed(dp)}%` : "–";

type CF = { t: number; cf: number };

function irr(cashflows: CF[], guess = 0.2) {
  // Newton-Raphson on NPV = 0
  let r = guess;
  for (let i = 0; i < 60; i++) {
    let f = 0;
    let df = 0;
    for (const x of cashflows) {
      const denom = Math.pow(1 + r, x.t);
      f += x.cf / denom;
      df += (-x.t * x.cf) / (denom * (1 + r));
    }
    if (Math.abs(f) < 1e-8) return r;
    const step = f / (df || 1e-12);
    r = r - step;
    if (!isFinite(r)) return NaN;
    r = clamp(r, -0.95, 5);
  }
  return r;
}

function expSmooth(series: number[], alpha = 0.35) {
  if (!series.length) return [] as number[];
  const out: number[] = [series[0]];
  for (let i = 1; i < series.length; i++) {
    out[i] = alpha * series[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function logNormalMonteCarlo({
  s0,
  mu,
  sigma,
  years,
  steps = 1,
  n = 2000,
}: {
  s0: number;
  mu: number;
  sigma: number;
  years: number;
  steps?: number;
  n?: number;
}) {
  const dt = years / steps;
  const paths: number[] = [];

  for (let k = 0; k < n; k++) {
    let s = s0;
    for (let i = 0; i < steps; i++) {
      const u1 = Math.random() || 1e-12;
      const u2 = Math.random();
      const z =
        Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      s =
        s *
        Math.exp(
          (mu - 0.5 * sigma * sigma) * dt +
            sigma * Math.sqrt(dt) * z
        );
    }
    paths.push(s);
  }

  paths.sort((a, b) => a - b);
  const q = (p: number) =>
    paths[Math.floor(clamp(p, 0, 0.9999) * paths.length)];

  return {
    mean: paths.reduce((s, v) => s + v, 0) / paths.length,
    p05: q(0.05),
    p50: q(0.5),
    p95: q(0.95),
  };
}

// -------------------------
// Hooks
// -------------------------

function useInterval(callback: () => void, delayMs: number | null) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => cbRef.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

// -------------------------
// UI atoms
// -------------------------

function NumField({
  label,
  value,
  onChange,
  step = 0.01,
  suffix,
  prefix,
  hint,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  prefix?: string;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        {hint ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {prefix ? (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        ) : null}
        <Input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {suffix ? (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function AnimatedNumber({
  value,
  format,
  springMs = 350,
}: {
  value: number;
  format: (x: number) => string;
  springMs?: number;
}) {
  const [txt, setTxt] = useState(() => format(value));
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (!isFinite(from) || !isFinite(to)) {
      setTxt(format(value));
      return;
    }

    const controls = animate(from, to, {
      duration: springMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setTxt(format(v)),
    });
    return () => controls.stop();
  }, [value, format, springMs]);

  return <>{txt}</>;
}

function Kpi({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad" | "info";
}) {
  const toneMap: Record<string, string> = {
    default: "bg-muted",
    good: "bg-emerald-500/15",
    warn: "bg-amber-500/15",
    bad: "bg-rose-500/15",
    info: "bg-sky-500/15",
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`rounded-2xl p-4 ${toneMap[tone]} border border-border/60`}
    >
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </motion.div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-10 w-10 rounded-2xl bg-foreground/5 border border-border/60 flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-lg font-semibold tracking-tight">{title}</div>
        {desc ? <div className="text-sm text-muted-foreground">{desc}</div> : null}
      </div>
    </div>
  );
}

// -------------------------
// Market types
// -------------------------

type MarketPoint = { d: string; c: number };

type MarketIndex = {
  id: string;
  name: string;
  symbol: string;
  currency?: string;
  last: number;
  prev?: number;
  chg?: number;
  chgPct?: number;
  asOf?: string;
  series?: MarketPoint[];
};

// -------------------------
// App
// -------------------------

export default function ValuationLabApp() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<"dcf" | "lbo" | "risk" | "markets">(
    "dcf"
  );

  // -------------------------
  // Market data (poll)
  // -------------------------

  const [markets, setMarkets] = useState<MarketIndex[]>([]);
  const [marketsStatus, setMarketsStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [marketsUpdatedAt, setMarketsUpdatedAt] = useState<string>("");

  const fetchMarkets = async () => {
    try {
      setMarketsStatus((s) => (s === "ok" ? "ok" : "loading"));
      const res = await fetch("/api/markets", { cache: "no-store" });
      if (!res.ok) throw new Error("Market API failed");
      const data = (await res.json()) as {
        updatedAt: string;
        indices: MarketIndex[];
      };
      setMarkets(data.indices || []);
      setMarketsUpdatedAt(data.updatedAt || "");
      setMarketsStatus("ok");
    } catch {
      setMarketsStatus("error");
    }
  };

  useEffect(() => {
    fetchMarkets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 15s
  useInterval(fetchMarkets, 15000);

  // -------------------------
  // DCF inputs
  // -------------------------

  const [dcf, setDcf] = useState({
    company: "Company",
    currency: "USD",
    years: 5,

    // Base year (FY0)
    revenue0: 1000,
    ebitdaMargin0: 0.22,
    daPctRev: 0.03,
    capexPctRev: 0.04,
    nwcPctRev: 0.1,
    taxRate: 0.25,

    // Forecast drivers
    revGrowth: 0.1,
    ebitdaMarginT: 0.24,

    // WACC inputs
    rf: 0.04,
    beta: 1.2,
    mrp: 0.05,
    preTaxKd: 0.065,
    targetDebtPct: 0.3,

    // Terminal
    terminalMethod: "gordon" as "gordon" | "exit",
    tg: 0.03,
    exitMultiple: 10,

    // Equity bridge
    netDebt: 300,
    shares: 100,

    // Mid-year
    midYear: true,

    // Forecast assistant
    mlMode: "trend" as "trend" | "smoothing",
    smoothAlpha: 0.35,
  });

  // -------------------------
  // LBO inputs
  // -------------------------

  const [lbo, setLbo] = useState({
    company: "Target",
    currency: "USD",
    holdYears: 5,

    // Entry
    revenue0: 1000,
    ebitdaMargin0: 0.22,
    entryMultiple: 10,

    // Operating
    revCagr: 0.08,
    marginTo: 0.25,

    // Cash flow
    daPctRev: 0.03,
    capexPctRev: 0.04,
    nwcPctRev: 0.1,
    taxRate: 0.25,

    // Debt (single tranche)
    debtPctEV: 0.65,
    debtRate: 0.085,
    mandatoryAmortPct: 0.05,

    // Exit
    exitMultiple: 10,

    // Fees
    txnFeesPctEV: 0.02,
  });

  // -------------------------
  // Risk inputs
  // -------------------------

  const [risk, setRisk] = useState({
    capital: 1_000_000,
    price: 100,
    volatility: 0.25,
    expReturn: 0.1,
    horizonYears: 1,
    confidence: 0.95,
    kellyFraction: 0.25,
  });

  const rootClass = dark ? "dark" : "";

  // -------------------------
  // DCF model
  // -------------------------

  const dcfModel = useMemo(() => {
    const N = clamp(Math.round(dcf.years), 1, 15);
    const years = Array.from({ length: N }, (_, i) => i + 1);

    const revs = years.map((t) => dcf.revenue0 * Math.pow(1 + dcf.revGrowth, t));

    const margin = years.map((t) => {
      const w = N === 1 ? 1 : t / N;
      return dcf.ebitdaMargin0 + (dcf.ebitdaMarginT - dcf.ebitdaMargin0) * w;
    });

    const ebitda = revs.map((r, i) => r * margin[i]);
    const da = revs.map((r) => r * dcf.daPctRev);
    const ebit = ebitda.map((x, i) => x - da[i]);

    // Conservative tax: tax on positive EBIT only
    const taxes = ebit.map((x) => Math.max(0, x) * dcf.taxRate);
    const nopat = ebit.map((x, i) => x - taxes[i]);

    const nwc = [dcf.revenue0 * dcf.nwcPctRev, ...revs.map((r) => r * dcf.nwcPctRev)];
    const dNwc = years.map((_, i) => nwc[i + 1] - nwc[i]);

    const capex = revs.map((r) => r * dcf.capexPctRev);
    const ufcf = years.map((_, i) => nopat[i] + da[i] - capex[i] - dNwc[i]);

    // WACC
    const ke = dcf.rf + dcf.beta * dcf.mrp;
    const kd = dcf.preTaxKd * (1 - dcf.taxRate);
    const wd = clamp(dcf.targetDebtPct, 0, 0.95);
    const we = 1 - wd;
    const wacc = we * ke + wd * kd;

    // Terminal value
    const lastUfcf = ufcf[ufcf.length - 1] ?? 0;
    const lastEbitda = ebitda[ebitda.length - 1] ?? 0;

    let tv: number;
    if (dcf.terminalMethod === "exit") {
      tv = lastEbitda * dcf.exitMultiple;
    } else {
      const g = dcf.tg;
      const denom = wacc - g;
      tv = denom <= 0 ? NaN : (lastUfcf * (1 + g)) / denom;
    }

    const discountFactor = years.map((t) => {
      const exp = dcf.midYear ? t - 0.5 : t;
      return 1 / Math.pow(1 + wacc, exp);
    });

    const pvUfcf = ufcf.map((cf, i) => cf * discountFactor[i]);
    const pvTv = tv * (discountFactor[discountFactor.length - 1] ?? 0);

    const enterpriseValue = pvUfcf.reduce((s, v) => s + v, 0) + pvTv;
    const equityValue = enterpriseValue - dcf.netDebt;
    const pricePerShare = equityValue / (dcf.shares || NaN);

    // Sensitivity grid (Gordon intuition)
    const waccGrid = [wacc - 0.02, wacc - 0.01, wacc, wacc + 0.01, wacc + 0.02].map((x) =>
      clamp(x, 0.01, 0.5)
    );
    const gGrid = [dcf.tg - 0.01, dcf.tg, dcf.tg + 0.01].map((x) => clamp(x, 0, 0.08));

    const sensWG = gGrid.map((g) =>
      waccGrid.map((w) => {
        const denom = w - g;
        if (denom <= 0) return NaN;
        const tv2 = (lastUfcf * (1 + g)) / denom;
        const pvTv2 = tv2 * (discountFactor[discountFactor.length - 1] ?? 0);
        const ev2 = pvUfcf.reduce((s, v) => s + v, 0) + pvTv2;
        const eq2 = ev2 - dcf.netDebt;
        return eq2 / (dcf.shares || NaN);
      })
    );

    const timeline = years.map((t, i) => ({
      year: `Y${t}`,
      Revenue: revs[i],
      EBITDA: ebitda[i],
      UFCF: ufcf[i],
    }));

    const mlRevenue = (() => {
      if (dcf.mlMode === "smoothing") {
        const sm = expSmooth([dcf.revenue0, ...revs], clamp(dcf.smoothAlpha, 0.05, 0.95));
        return sm.slice(1);
      }
      return revs;
    })();

    const mlTimeline = years.map((t, i) => ({
      year: `Y${t}`,
      Revenue_Base: revs[i],
      Revenue_Forecast: mlRevenue[i],
    }));

    return {
      N,
      ke,
      kd,
      we,
      wd,
      wacc,
      tv,
      pvTv,
      enterpriseValue,
      equityValue,
      pricePerShare,
      timeline,
      mlTimeline,
      waccGrid,
      gGrid,
      sensWG,
    };
  }, [dcf]);

  // -------------------------
  // LBO model
  // -------------------------

  const lboModel = useMemo(() => {
    const N = clamp(Math.round(lbo.holdYears), 1, 10);
    const years = Array.from({ length: N }, (_, i) => i + 1);

    const revs = years.map((t) => lbo.revenue0 * Math.pow(1 + lbo.revCagr, t));
    const margin = years.map((t) => {
      const w = N === 1 ? 1 : t / N;
      return lbo.ebitdaMargin0 + (lbo.marginTo - lbo.ebitdaMargin0) * w;
    });
    const ebitda = revs.map((r, i) => r * margin[i]);

    const entryEBITDA = lbo.revenue0 * lbo.ebitdaMargin0;
    const entryEV = entryEBITDA * lbo.entryMultiple;
    const fees = entryEV * lbo.txnFeesPctEV;

    const debt0 = entryEV * clamp(lbo.debtPctEV, 0, 0.95);
    const equity0 = entryEV + fees - debt0;

    let debt = debt0;
    const nwc = [lbo.revenue0 * lbo.nwcPctRev, ...revs.map((r) => r * lbo.nwcPctRev)];

    const rows = years.map((t, i) => {
      const da = revs[i] * lbo.daPctRev;
      const ebit = ebitda[i] - da;
      const tax = Math.max(0, ebit) * lbo.taxRate;

      const capex = revs[i] * lbo.capexPctRev;
      const dNwc = nwc[i + 1] - nwc[i];

      const interest = debt * lbo.debtRate;
      const mandatory = debt * clamp(lbo.mandatoryAmortPct, 0, 0.5);

      // Simple sweep: EBITDA → tax, capex, ΔNWC, interest, mandatory, then sweep
      const cashAfter = ebitda[i] - tax - capex - dNwc - interest;
      const sweep = Math.max(0, cashAfter - mandatory);

      const totalPaydown = clamp(mandatory + sweep, 0, debt);
      const endDebt = debt - totalPaydown;

      debt = endDebt;

      return {
        year: `Y${t}`,
        Revenue: revs[i],
        EBITDA: ebitda[i],
        Interest: interest,
        Paydown: totalPaydown,
        EndDebt: endDebt,
      };
    });

    const exitEBITDA = ebitda[ebitda.length - 1] ?? 0;
    const exitEV = exitEBITDA * lbo.exitMultiple;
    const exitDebt = debt;
    const exitEquity = exitEV - exitDebt;

    const cashflows: CF[] = [{ t: 0, cf: -equity0 }, { t: N, cf: exitEquity }];
    const irrEq = irr(cashflows, 0.25);
    const moic = equity0 === 0 ? NaN : exitEquity / equity0;

    const entryLeverage = entryEBITDA === 0 ? NaN : debt0 / entryEBITDA;
    const exitLeverage = exitEBITDA === 0 ? NaN : exitDebt / exitEBITDA;

    return {
      entryEV,
      fees,
      debt0,
      equity0,
      exitEV,
      exitDebt,
      exitEquity,
      irrEq,
      moic,
      entryLeverage,
      exitLeverage,
      rows,
    };
  }, [lbo]);

  // -------------------------
  // Risk tools
  // -------------------------

  const riskModel = useMemo(() => {
    const { capital, price, volatility, expReturn, horizonYears, confidence } = risk;

    const z = (() => {
      if (confidence >= 0.99) return 2.326;
      if (confidence >= 0.975) return 1.96;
      if (confidence >= 0.95) return 1.645;
      if (confidence >= 0.9) return 1.282;
      return 1.0;
    })();

    const position = capital;
    const varAmt = z * volatility * Math.sqrt(horizonYears) * position;

    const kellyRaw = volatility === 0 ? NaN : expReturn / (volatility * volatility);
    const kelly = clamp(kellyRaw * risk.kellyFraction, 0, 2);
    const shares = price > 0 ? (capital * kelly) / price : NaN;

    const mc = logNormalMonteCarlo({
      s0: capital,
      mu: expReturn,
      sigma: volatility,
      years: horizonYears,
      steps: Math.max(1, Math.round(horizonYears)),
      n: 2500,
    });

    const dist = [
      { k: "P05", v: mc.p05 },
      { k: "P50", v: mc.p50 },
      { k: "P95", v: mc.p95 },
      { k: "Mean", v: mc.mean },
    ];

    return { z, varAmt, kellyRaw, kelly, shares, mc, dist };
  }, [risk]);

  // -------------------------
  // Layout
  // -------------------------

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className={rootClass}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-foreground/5 to-transparent pointer-events-none" />
          {children}
        </div>
      </div>
    </div>
  );

  const MarketStrip = () => {
    const top = (markets || []).slice(0, 6);
    return (
      <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-medium">Markets</div>
            <Badge variant="secondary" className="rounded-xl">
              {marketsStatus === "ok" ? "Live" : marketsStatus === "loading" ? "Loading" : "Offline"}
            </Badge>
            {marketsUpdatedAt ? (
              <div className="text-xs text-muted-foreground">Updated: {marketsUpdatedAt}</div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="rounded-2xl"
              onClick={fetchMarkets}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {top.length ? (
            top.map((x) => {
              const up = (x.chg || 0) >= 0;
              return (
                <div
                  key={x.id}
                  className="min-w-[220px] rounded-2xl border border-border/60 bg-background/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">{x.name}</div>
                    <div className="flex items-center gap-1 text-xs">
                      {up ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      <span className={up ? "text-emerald-600" : "text-rose-600"}>
                        {isFinite(x.chgPct || NaN) ? `${(x.chgPct || 0).toFixed(2)}%` : "–"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {isFinite(x.last) ? x.last.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {x.symbol} {x.asOf ? `• ${x.asOf}` : ""}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No data yet.</div>
          )}
        </div>
      </div>
    );
  };

  const Header = () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-foreground/5 to-foreground/10 border border-border/60 flex items-center justify-center">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Valuation Lab
              </h1>
              <Badge variant="secondary" className="rounded-xl">
                Pro
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              DCF • LBO • Risk • Markets — fast, transparent, editable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 px-3 py-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch checked={dark} onCheckedChange={setDark} />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => {
              // Keep values; this is a "soft refresh" for recalcs
              setDcf((s) => ({ ...s }));
              setLbo((s) => ({ ...s }));
              setRisk((s) => ({ ...s }));
            }}
          >
            Recalculate
          </Button>
        </div>
      </div>

      <MarketStrip />

      <div className="rounded-3xl border border-border/60 bg-card/50 backdrop-blur px-4 py-3">
        <Tabs value={active} onValueChange={(v) => setActive(v as any)}>
          <TabsList className="grid w-full grid-cols-4 rounded-2xl">
            <TabsTrigger value="dcf" className="rounded-2xl">
              DCF
            </TabsTrigger>
            <TabsTrigger value="lbo" className="rounded-2xl">
              LBO
            </TabsTrigger>
            <TabsTrigger value="risk" className="rounded-2xl">
              Risk
            </TabsTrigger>
            <TabsTrigger value="markets" className="rounded-2xl">
              Markets
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  // -------------------------
  // Pages
  // -------------------------

  const DcfPage = () => {
    const m = dcfModel;

    const headlineTone: "default" | "good" | "warn" | "bad" | "info" = (() => {
      if (!isFinite(m.wacc) || !isFinite(m.pricePerShare)) return "warn";
      if (m.wacc <= dcf.tg) return "bad";
      return "good";
    })();

    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
  <CardTitle className="flex items-center gap-2">
    <Sparkles className="h-5 w-5" /> Inputs
  </CardTitle>

  <div className="mt-3">
    <ScenarioLibrary
      kind="DCF"
      currentInputs={dcf}
      onLoad={(inputs) =>
        setDcf((s) => ({
          ...s,
          ...inputs,
        }))
      }
    />
  </div>

  <CardDescription>Change values; outputs update instantly.</CardDescription>
</CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Company</Label>
                  <Input
                    value={dcf.company}
                    onChange={(e) =>
                      setDcf((s) => ({ ...s, company: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Currency</Label>
                  <Input
                    value={dcf.currency}
                    onChange={(e) =>
                      setDcf((s) => ({ ...s, currency: e.target.value }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Forecast Years"
                  value={dcf.years}
                  step={1}
                  min={1}
                  max={15}
                  onChange={(v) => setDcf((s) => ({ ...s, years: v }))}
                />
                <div className="space-y-1">
                  <Label className="text-sm">Mid-year convention</Label>
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      {dcf.midYear ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={dcf.midYear}
                      onCheckedChange={(v) =>
                        setDcf((s) => ({ ...s, midYear: v }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <SectionTitle
                icon={Building2}
                title="Base year (FY0)"
                desc="Set a clean base; the model just scales this forward."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Revenue (FY0)"
                  value={dcf.revenue0}
                  step={1}
                  prefix={dcf.currency}
                  onChange={(v) => setDcf((s) => ({ ...s, revenue0: v }))}
                />
                <NumField
                  label="EBITDA margin (FY0)"
                  value={dcf.ebitdaMargin0}
                  step={0.005}
                  suffix="(decimal)"
                  hint="0.25 = 25%"
                  onChange={(v) =>
                    setDcf((s) => ({ ...s, ebitdaMargin0: v }))
                  }
                />
                <NumField
                  label="D&A % of revenue"
                  value={dcf.daPctRev}
                  step={0.002}
                  onChange={(v) => setDcf((s) => ({ ...s, daPctRev: v }))}
                />
                <NumField
                  label="Capex % of revenue"
                  value={dcf.capexPctRev}
                  step={0.002}
                  onChange={(v) =>
                    setDcf((s) => ({ ...s, capexPctRev: v }))
                  }
                />
                <NumField
                  label="NWC % of revenue"
                  value={dcf.nwcPctRev}
                  step={0.005}
                  onChange={(v) => setDcf((s) => ({ ...s, nwcPctRev: v }))}
                />
                <NumField
                  label="Tax rate"
                  value={dcf.taxRate}
                  step={0.005}
                  onChange={(v) => setDcf((s) => ({ ...s, taxRate: v }))}
                />
              </div>

              <Separator />

              <SectionTitle
                icon={TrendingUp}
                title="Forecast drivers"
                desc="Simple & explainable: growth + margin to terminal year."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Revenue growth"
                  value={dcf.revGrowth}
                  step={0.005}
                  onChange={(v) => setDcf((s) => ({ ...s, revGrowth: v }))}
                />
                <NumField
                  label="EBITDA margin (terminal year)"
                  value={dcf.ebitdaMarginT}
                  step={0.005}
                  onChange={(v) =>
                    setDcf((s) => ({ ...s, ebitdaMarginT: v }))
                  }
                />
              </div>

              <Separator />

              <SectionTitle
                icon={Sigma}
                title="WACC"
                desc="CAPM + after-tax cost of debt (simple)."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Risk-free rate (Rf)"
                  value={dcf.rf}
                  step={0.0025}
                  onChange={(v) => setDcf((s) => ({ ...s, rf: v }))}
                />
                <NumField
                  label="Equity beta (β)"
                  value={dcf.beta}
                  step={0.05}
                  onChange={(v) => setDcf((s) => ({ ...s, beta: v }))}
                />
                <NumField
                  label="Market risk premium (MRP)"
                  value={dcf.mrp}
                  step={0.005}
                  onChange={(v) => setDcf((s) => ({ ...s, mrp: v }))}
                />
                <NumField
                  label="Pre-tax cost of debt"
                  value={dcf.preTaxKd}
                  step={0.0025}
                  onChange={(v) =>
                    setDcf((s) => ({ ...s, preTaxKd: v }))
                  }
                />
                <NumField
                  label="Target debt weight"
                  value={dcf.targetDebtPct}
                  step={0.02}
                  hint="D/(D+E)"
                  onChange={(v) =>
                    setDcf((s) => ({ ...s, targetDebtPct: v }))
                  }
                />
              </div>

              <Separator />

              <SectionTitle
                icon={Briefcase}
                title="Terminal + Equity"
                desc="Bridge EV to equity value / price per share."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Terminal method</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={dcf.terminalMethod === "gordon" ? "default" : "secondary"}
                      className="rounded-2xl"
                      onClick={() =>
                        setDcf((s) => ({ ...s, terminalMethod: "gordon" }))
                      }
                    >
                      Gordon
                    </Button>
                    <Button
                      variant={dcf.terminalMethod === "exit" ? "default" : "secondary"}
                      className="rounded-2xl"
                      onClick={() =>
                        setDcf((s) => ({ ...s, terminalMethod: "exit" }))
                      }
                    >
                      Exit mult.
                    </Button>
                  </div>
                </div>

                {dcf.terminalMethod === "exit" ? (
                  <NumField
                    label="Exit multiple (EV/EBITDA)"
                    value={dcf.exitMultiple}
                    step={0.25}
                    onChange={(v) =>
                      setDcf((s) => ({ ...s, exitMultiple: v }))
                    }
                  />
                ) : (
                  <NumField
                    label="Terminal growth (g)"
                    value={dcf.tg}
                    step={0.0025}
                    onChange={(v) => setDcf((s) => ({ ...s, tg: v }))}
                  />
                )}

                <NumField
                  label="Net debt"
                  value={dcf.netDebt}
                  step={1}
                  prefix={dcf.currency}
                  onChange={(v) => setDcf((s) => ({ ...s, netDebt: v }))}
                />
                <NumField
                  label="Shares outstanding"
                  value={dcf.shares}
                  step={1}
                  onChange={(v) => setDcf((s) => ({ ...s, shares: v }))}
                />
              </div>

              <Separator />

              <SectionTitle
                icon={Sparkles}
                title="Forecast assistant (ML-lite)"
                desc="Trend vs smoothing (in-browser)."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Mode</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={dcf.mlMode === "trend" ? "default" : "secondary"}
                      className="rounded-2xl"
                      onClick={() => setDcf((s) => ({ ...s, mlMode: "trend" }))}
                    >
                      Trend
                    </Button>
                    <Button
                      variant={dcf.mlMode === "smoothing" ? "default" : "secondary"}
                      className="rounded-2xl"
                      onClick={() =>
                        setDcf((s) => ({ ...s, mlMode: "smoothing" }))
                      }
                    >
                      Smoothing
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Alpha (smoothing)</Label>
                    <span className="text-xs text-muted-foreground">
                      {dcf.smoothAlpha.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[dcf.smoothAlpha]}
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    onValueChange={(v) =>
                      setDcf((s) => ({ ...s, smoothAlpha: v[0] }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">Accuracy note</div>
                    This is a transparent model. It won’t auto-pull filings, comps, or live betas.
                    Banker-grade accuracy = banker-grade inputs.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>DCF Output</CardTitle>
              <CardDescription>
                {dcf.company} — implied valuation from unlevered FCF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  title="WACC"
                  value={<AnimatedNumber value={m.wacc} format={(x) => pct(x)} />}
                  sub={`Ke ${pct(m.ke)} | Kd(after) ${pct(m.kd)} | D% ${pct(m.wd)}`}
                  tone={headlineTone}
                />
                <Kpi
                  title="Terminal Value"
                  value={
                    <>
                      {dcf.currency} <AnimatedNumber value={m.tv} format={(x) => fmt(x)} />
                    </>
                  }
                  sub={
                    dcf.terminalMethod === "exit"
                      ? `Exit Y${m.N} EBITDA × ${dcf.exitMultiple.toFixed(1)}x`
                      : `Gordon @ g=${pct(dcf.tg)}`
                  }
                  tone="info"
                />
                <Kpi
                  title="Enterprise Value"
                  value={
                    <>
                      {dcf.currency}{" "}
                      <AnimatedNumber value={m.enterpriseValue} format={(x) => fmt(x)} />
                    </>
                  }
                  sub={`PV(TV) ${dcf.currency} ${fmt(m.pvTv)}`}
                />
                <Kpi
                  title="Implied Price / Share"
                  value={
                    <>
                      {dcf.currency}{" "}
                      <AnimatedNumber
                        value={m.pricePerShare}
                        format={(x) => fmt(x, 2)}
                      />
                    </>
                  }
                  sub={`Equity ${dcf.currency} ${fmt(m.equityValue)}`}
                  tone={headlineTone}
                />
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Forecast (Revenue, EBITDA, UFCF)
                    </CardTitle>
                    <CardDescription>Computed from your drivers.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={m.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <RTooltip
                          formatter={(v) => `${dcf.currency} ${fmt(Number(v), 2)}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Revenue" dot={false} />
                        <Line type="monotone" dataKey="EBITDA" dot={false} />
                        <Line type="monotone" dataKey="UFCF" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Forecast Assistant (ML-lite)
                    </CardTitle>
                    <CardDescription>Trend vs smoothing.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={m.mlTimeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <RTooltip
                          formatter={(v) => `${dcf.currency} ${fmt(Number(v), 2)}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Revenue_Base" dot={false} />
                        <Line type="monotone" dataKey="Revenue_Forecast" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <Card className="rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-base">
                    Sensitivity (Price/Share): WACC × g
                  </CardTitle>
                  <CardDescription>
                    Grid around current assumptions (Gordon intuition).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left">g \ WACC</th>
                          {m.waccGrid.map((w, i) => (
                            <th key={i} className="p-3 text-right">
                              {pct(w, 2)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.gGrid.map((g, r) => (
                          <tr key={r} className="border-t border-border/60">
                            <td className="p-3 font-medium">{pct(g, 2)}</td>
                            {m.sensWG[r].map((v, c) => {
                              const base = m.pricePerShare;
                              const diff =
                                isFinite(v) && isFinite(base)
                                  ? (v - base) / (Math.abs(base) || 1)
                                  : 0;
                              const heat = clamp(Math.abs(diff) * 12, 0, 1);
                              const bg =
                                diff >= 0
                                  ? `rgba(16, 185, 129, ${0.14 * heat})`
                                  : `rgba(244, 63, 94, ${0.12 * heat})`;
                              return (
                                <td
                                  key={c}
                                  className="p-3 text-right"
                                  style={{ background: bg }}
                                >
                                  {isFinite(v)
                                    ? `${dcf.currency} ${v.toFixed(2)}`
                                    : "–"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {dcf.terminalMethod !== "gordon" ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      You’re on Exit Multiple. This sensitivity grid is Gordon-based for intuition.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const LboPage = () => {
    const m = lboModel;
    const tone: "default" | "good" | "warn" | "bad" | "info" = isFinite(m.irrEq)
      ? m.irrEq >= 0.25
        ? "good"
        : m.irrEq >= 0.15
          ? "warn"
          : "bad"
      : "warn";

    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
  <CardTitle className="flex items-center gap-2">
    <Sparkles className="h-5 w-5" /> Inputs
  </CardTitle>

  <div className="mt-3">
    <ScenarioLibrary
      kind="LBO"
      currentInputs={lbo}
      onLoad={(inputs) =>
        setLbo((s) => ({
          ...s,
          ...inputs,
        }))
      }
    />
  </div>

  <CardDescription>Simple LBO mechanics with deleveraging.</CardDescription>
</CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Company</Label>
                  <Input
                    value={lbo.company}
                    onChange={(e) =>
                      setLbo((s) => ({ ...s, company: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Currency</Label>
                  <Input
                    value={lbo.currency}
                    onChange={(e) =>
                      setLbo((s) => ({ ...s, currency: e.target.value }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Hold years"
                  value={lbo.holdYears}
                  step={1}
                  min={1}
                  max={10}
                  onChange={(v) => setLbo((s) => ({ ...s, holdYears: v }))}
                />
                <NumField
                  label="Revenue (FY0)"
                  value={lbo.revenue0}
                  step={1}
                  prefix={lbo.currency}
                  onChange={(v) => setLbo((s) => ({ ...s, revenue0: v }))}
                />
                <NumField
                  label="EBITDA margin (FY0)"
                  value={lbo.ebitdaMargin0}
                  step={0.005}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, ebitdaMargin0: v }))
                  }
                />
                <NumField
                  label="Entry multiple (EV/EBITDA)"
                  value={lbo.entryMultiple}
                  step={0.25}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, entryMultiple: v }))
                  }
                />
              </div>

              <Separator />

              <SectionTitle
                icon={TrendingUp}
                title="Operating plan"
                desc="CAGR + margin expansion."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Revenue CAGR"
                  value={lbo.revCagr}
                  step={0.005}
                  onChange={(v) => setLbo((s) => ({ ...s, revCagr: v }))}
                />
                <NumField
                  label="Margin to (exit year)"
                  value={lbo.marginTo}
                  step={0.005}
                  onChange={(v) => setLbo((s) => ({ ...s, marginTo: v }))}
                />
              </div>

              <Separator />

              <SectionTitle
                icon={Sigma}
                title="Cash flow"
                desc="Used for debt paydown."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="D&A % revenue"
                  value={lbo.daPctRev}
                  step={0.002}
                  onChange={(v) => setLbo((s) => ({ ...s, daPctRev: v }))}
                />
                <NumField
                  label="Capex % revenue"
                  value={lbo.capexPctRev}
                  step={0.002}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, capexPctRev: v }))
                  }
                />
                <NumField
                  label="NWC % revenue"
                  value={lbo.nwcPctRev}
                  step={0.005}
                  onChange={(v) => setLbo((s) => ({ ...s, nwcPctRev: v }))}
                />
                <NumField
                  label="Tax rate"
                  value={lbo.taxRate}
                  step={0.005}
                  onChange={(v) => setLbo((s) => ({ ...s, taxRate: v }))}
                />
              </div>

              <Separator />

              <SectionTitle
                icon={Briefcase}
                title="Debt & exit"
                desc="One-tranche schedule (clean MVP)."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumField
                  label="Debt % of EV"
                  value={lbo.debtPctEV}
                  step={0.02}
                  onChange={(v) => setLbo((s) => ({ ...s, debtPctEV: v }))}
                />
                <NumField
                  label="Debt interest rate"
                  value={lbo.debtRate}
                  step={0.0025}
                  onChange={(v) => setLbo((s) => ({ ...s, debtRate: v }))}
                />
                <NumField
                  label="Mandatory amort %"
                  value={lbo.mandatoryAmortPct}
                  step={0.01}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, mandatoryAmortPct: v }))
                  }
                />
                <NumField
                  label="Exit multiple"
                  value={lbo.exitMultiple}
                  step={0.25}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, exitMultiple: v }))
                  }
                />
                <NumField
                  label="Txn fees % EV"
                  value={lbo.txnFeesPctEV}
                  step={0.0025}
                  onChange={(v) =>
                    setLbo((s) => ({ ...s, txnFeesPctEV: v }))
                  }
                />
              </div>

              <div className="rounded-2xl border border-border/60 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">Model scope</div>
                    This is a clean quick-draft LBO. Production LBOs add multiple tranches, fees by tranche, revolver, covenants, and a detailed sources/uses.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>LBO Output</CardTitle>
              <CardDescription>
                {lbo.company} — equity IRR from entry → exit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  title="Entry EV"
                  value={
                    <>
                      {lbo.currency}{" "}
                      <AnimatedNumber value={m.entryEV} format={(x) => fmt(x)} />
                    </>
                  }
                  sub={`Fees ${lbo.currency} ${fmt(m.fees)}`}
                />
                <Kpi
                  title="Debt / Equity"
                  value={`${lbo.currency} ${fmt(m.debt0)} / ${fmt(m.equity0)}`}
                  sub={`Entry leverage ${isFinite(m.entryLeverage) ? m.entryLeverage.toFixed(2) : "–"}x`}
                />
                <Kpi
                  title="Exit Equity"
                  value={`${lbo.currency} ${fmt(m.exitEquity)}`}
                  sub={`Exit leverage ${isFinite(m.exitLeverage) ? m.exitLeverage.toFixed(2) : "–"}x`}
                />
                <Kpi
                  title="Equity IRR"
                  value={<AnimatedNumber value={m.irrEq} format={(x) => pct(x)} />}
                  sub={`MOIC ${isFinite(m.moic) ? m.moic.toFixed(2) : "–"}x`}
                  tone={tone}
                />
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Debt paydown</CardTitle>
                    <CardDescription>End-of-year debt balance.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={m.rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <RTooltip
                          formatter={(v) => `${lbo.currency} ${fmt(Number(v), 2)}`}
                        />
                        <Legend />
                        <Bar dataKey="EndDebt" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Ops (Revenue, EBITDA)</CardTitle>
                    <CardDescription>Growth + margin trajectory.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={m.rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <RTooltip
                          formatter={(v) => `${lbo.currency} ${fmt(Number(v), 2)}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Revenue" dot={false} />
                        <Line type="monotone" dataKey="EBITDA" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <Card className="rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-base">Year-by-year schedule</CardTitle>
                  <CardDescription>Transparent mechanics.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {[
                            "Year",
                            "Revenue",
                            "EBITDA",
                            "Interest",
                            "Paydown",
                            "End Debt",
                          ].map((h) => (
                            <th key={h} className="p-3 text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.rows.map((r) => (
                          <tr key={r.year} className="border-t border-border/60">
                            <td className="p-3 font-medium">{r.year}</td>
                            <td className="p-3">{lbo.currency} {fmt(r.Revenue)}</td>
                            <td className="p-3">{lbo.currency} {fmt(r.EBITDA)}</td>
                            <td className="p-3">{lbo.currency} {fmt(r.Interest)}</td>
                            <td className="p-3">{lbo.currency} {fmt(r.Paydown)}</td>
                            <td className="p-3">{lbo.currency} {fmt(r.EndDebt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const RiskPage = () => {
    const m = riskModel;

    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> Inputs
              </CardTitle>
              <CardDescription>Quick risk / sizing utilities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <NumField
                label="Capital"
                value={risk.capital}
                step={1000}
                onChange={(v) => setRisk((s) => ({ ...s, capital: v }))}
              />
              <NumField
                label="Price"
                value={risk.price}
                step={0.1}
                onChange={(v) => setRisk((s) => ({ ...s, price: v }))}
              />
              <NumField
                label="Volatility (σ)"
                value={risk.volatility}
                step={0.01}
                hint="Annualized; 0.25 = 25%"
                onChange={(v) => setRisk((s) => ({ ...s, volatility: v }))}
              />
              <NumField
                label="Expected return (μ)"
                value={risk.expReturn}
                step={0.01}
                onChange={(v) => setRisk((s) => ({ ...s, expReturn: v }))}
              />
              <NumField
                label="Horizon (years)"
                value={risk.horizonYears}
                step={0.25}
                onChange={(v) => setRisk((s) => ({ ...s, horizonYears: v }))}
              />
              <NumField
                label="Confidence"
                value={risk.confidence}
                step={0.01}
                hint="0.95 = 95%"
                onChange={(v) =>
                  setRisk((s) => ({ ...s, confidence: clamp(v, 0.5, 0.999) }))
                }
              />

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Kelly fraction (scale)</Label>
                  <span className="text-xs text-muted-foreground">
                    {risk.kellyFraction.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[risk.kellyFraction]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) =>
                    setRisk((s) => ({ ...s, kellyFraction: v[0] }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Risk Output</CardTitle>
              <CardDescription>VaR, Kelly sizing, and a Monte Carlo distribution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  title="z-score"
                  value={<AnimatedNumber value={m.z} format={(x) => x.toFixed(3)} />}
                  sub={`Confidence ${(risk.confidence * 100).toFixed(1)}%`}
                />
                <Kpi
                  title="Parametric VaR"
                  value={<AnimatedNumber value={m.varAmt} format={(x) => fmt(x)} />}
                  sub={`σ ${pct(risk.volatility)} • Horizon ${risk.horizonYears}y`}
                  tone="warn"
                />
                <Kpi
                  title="Kelly (raw)"
                  value={<AnimatedNumber value={m.kellyRaw} format={(x) => x.toFixed(2)} />}
                  sub="μ / σ²"
                />
                <Kpi
                  title="Suggested shares"
                  value={<AnimatedNumber value={m.shares} format={(x) => fmt(x, 0)} />}
                  sub={`Scaled Kelly ${(m.kelly * 100).toFixed(0)}% of capital`}
                  tone="info"
                />
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Monte Carlo distribution</CardTitle>
                    <CardDescription>Portfolio value after horizon.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {m.dist.map((x) => (
                        <div
                          key={x.k}
                          className="rounded-2xl border border-border/60 p-3"
                        >
                          <div className="text-xs text-muted-foreground">{x.k}</div>
                          <div className="text-lg font-semibold">
                            {fmt(x.v)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Note: this sim is lognormal (GBM). Use with judgment.
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base">How to read this</CardTitle>
                    <CardDescription>Fast interpretation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div>
                      <span className="text-foreground font-medium">VaR</span> = rough worst-case loss at your confidence.
                    </div>
                    <div>
                      <span className="text-foreground font-medium">Kelly</span> is aggressive and unstable. Scaling it is standard.
                    </div>
                    <div>
                      For hedge-fund grade risk, you’d add factor models, fat tails, stress tests, liquidity haircuts.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const MarketsPage = () => {
    const rows = (markets || []).slice(0, 12);

    return (
      <div className="space-y-6">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Global Indices</CardTitle>
            <CardDescription>
              Updates every 15s via your /api/markets route. (Often delayed / EOD depending on source.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-3">
              {rows.map((x) => {
                const up = (x.chg || 0) >= 0;
                const tone = up ? "good" : "bad";
                return (
                  <motion.div
                    key={x.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card className="rounded-3xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{x.name}</CardTitle>
                            <CardDescription>{x.symbol}</CardDescription>
                          </div>
                          <Badge variant="secondary" className="rounded-xl">
                            {x.asOf ? x.asOf : "–"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Kpi
                            title="Last"
                            value={
                              <AnimatedNumber
                                value={x.last}
                                format={(v) =>
                                  isFinite(v)
                                    ? v.toLocaleString(undefined, {
                                        maximumFractionDigits: 2,
                                      })
                                    : "–"
                                }
                              />
                            }
                            sub={x.currency || ""}
                            tone="info"
                          />
                          <Kpi
                            title="Change"
                            value={
                              <div className="flex items-center gap-1">
                                {up ? (
                                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                                )}
                                <span>
                                  {isFinite(x.chg || NaN)
                                    ? (x.chg || 0).toFixed(2)
                                    : "–"}
                                </span>
                              </div>
                            }
                            sub={
                              isFinite(x.chgPct || NaN)
                                ? `${(x.chgPct || 0).toFixed(2)}%`
                                : "–"
                            }
                            tone={tone as any}
                          />
                        </div>

                        {x.series && x.series.length >= 5 ? (
                          <div className="h-28">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={x.series.map((p) => ({
                                  d: p.d,
                                  c: p.c,
                                }))}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="d" hide />
                                <YAxis hide domain={["auto", "auto"]} />
                                <RTooltip
                                  formatter={(v) =>
                                    (Number(v) || 0).toLocaleString(undefined, {
                                      maximumFractionDigits: 2,
                                    })
                                  }
                                  labelFormatter={(l) => `Date ${l}`}
                                />
                                <Line type="monotone" dataKey="c" dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            No history returned (optional). Add it in the API.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {marketsStatus === "error" ? (
              <div className="mt-4 rounded-2xl border border-border/60 p-3 text-sm text-muted-foreground">
                Market feed is offline. Add the /api/markets route from my instructions.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  };

  const Page = () => (
    <AnimatePresence mode="wait">
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {active === "dcf" ? <DcfPage /> : null}
        {active === "lbo" ? <LboPage /> : null}
        {active === "risk" ? <RiskPage /> : null}
        {active === "markets" ? <MarketsPage /> : null}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <Shell>
      <Header />
      <div className="mt-6">
        <Page />
      </div>

      <div className="mt-10 text-xs text-muted-foreground">
        Built for clarity. If you want a real Bloomberg-style terminal (live ticks, fundamentals, comps pulls, consensus estimates), you’ll need API keys + a backend.
      </div>
    </Shell>
  );
}
