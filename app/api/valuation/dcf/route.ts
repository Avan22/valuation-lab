import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

type DcfInput = {
  years: number;
  revenue0: number;
  ebitdaMargin0: number;
  ebitdaMarginT: number;
  revGrowth: number;

  daPctRev: number;
  capexPctRev: number;
  nwcPctRev: number;
  taxRate: number;

  rf: number;
  beta: number;
  mrp: number;
  preTaxKd: number;
  targetDebtPct: number;

  terminalMethod: "gordon" | "exit";
  tg: number;
  exitMultiple: number;

  netDebt: number;
  shares: number;

  midYear: boolean;
};

function computeDcf(i: DcfInput) {
  const N = clamp(Math.round(i.years), 1, 15);
  const years = Array.from({ length: N }, (_, k) => k + 1);

  const revs = years.map((t) => i.revenue0 * Math.pow(1 + i.revGrowth, t));

  const margin = years.map((t) => {
    const w = N === 1 ? 1 : t / N;
    return i.ebitdaMargin0 + (i.ebitdaMarginT - i.ebitdaMargin0) * w;
  });

  const ebitda = revs.map((r, idx) => r * margin[idx]);
  const da = revs.map((r) => r * i.daPctRev);
  const ebit = ebitda.map((x, idx) => x - da[idx]);

  const taxes = ebit.map((x) => Math.max(0, x) * i.taxRate);
  const nopat = ebit.map((x, idx) => x - taxes[idx]);

  const nwc = [i.revenue0 * i.nwcPctRev, ...revs.map((r) => r * i.nwcPctRev)];
  const dNwc = years.map((_, idx) => nwc[idx + 1] - nwc[idx]);

  const capex = revs.map((r) => r * i.capexPctRev);

  const ufcf = years.map((_, idx) => nopat[idx] + da[idx] - capex[idx] - dNwc[idx]);

  const ke = i.rf + i.beta * i.mrp;
  const kd = i.preTaxKd * (1 - i.taxRate);
  const wd = clamp(i.targetDebtPct, 0, 0.95);
  const we = 1 - wd;
  const wacc = we * ke + wd * kd;

  const lastUfcf = ufcf[ufcf.length - 1] ?? 0;
  const lastEbitda = ebitda[ebitda.length - 1] ?? 0;

  let tv: number;
  if (i.terminalMethod === "exit") {
    tv = lastEbitda * i.exitMultiple;
  } else {
    const denom = wacc - i.tg;
    tv = denom <= 0 ? NaN : (lastUfcf * (1 + i.tg)) / denom;
  }

  const df = years.map((t) => {
    const exp = i.midYear ? t - 0.5 : t;
    return 1 / Math.pow(1 + wacc, exp);
  });

  const pvUfcf = ufcf.map((cf, idx) => cf * df[idx]);
  const pvTv = tv * (df[df.length - 1] ?? 0);

  const ev = pvUfcf.reduce((s, v) => s + v, 0) + pvTv;
  const eq = ev - i.netDebt;
  const px = eq / (i.shares || NaN);

  const table = years.map((t, idx) => ({
    year: t,
    revenue: revs[idx],
    ebitda: ebitda[idx],
    ufcf: ufcf[idx],
    discountFactor: df[idx],
    pvUfcf: pvUfcf[idx],
  }));

  return { N, ke, kd, we, wd, wacc, tv, pvTv, enterpriseValue: ev, equityValue: eq, pricePerShare: px, table };
}

function validate(i: DcfInput) {
  const errs: string[] = [];
  if (!(i.years >= 1 && i.years <= 15)) errs.push("years must be 1–15");
  if (!(i.revenue0 > 0)) errs.push("revenue0 must be > 0");
  if (!(i.shares > 0)) errs.push("shares must be > 0");
  if (!(i.taxRate >= 0 && i.taxRate <= 0.6)) errs.push("taxRate must be 0–0.6");
  if (!(i.targetDebtPct >= 0 && i.targetDebtPct <= 0.95)) errs.push("targetDebtPct must be 0–0.95");
  return errs;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DcfInput;
    const errs = validate(body);
    if (errs.length) return NextResponse.json({ ok: false, errors: errs }, { status: 400 });

    const out = computeDcf(body);
    if (body.terminalMethod === "gordon" && out.wacc <= body.tg) {
      return NextResponse.json(
        { ok: false, errors: ["Invalid terminal: WACC must be > terminal growth (g) for Gordon."] },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, result: out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}