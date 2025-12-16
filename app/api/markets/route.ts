import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // always fresh
export const runtime = "nodejs";

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

const INDICES: Array<Pick<MarketIndex, "id" | "name" | "symbol" | "currency">> = [
  { id: "spx", name: "S&P 500", symbol: "^spx", currency: "USD" },
  { id: "dji", name: "Dow Jones", symbol: "^dji", currency: "USD" },
  { id: "dax", name: "DAX", symbol: "^dax", currency: "EUR" },
  { id: "hsi", name: "Hang Seng", symbol: "^hsi", currency: "HKD" },
  // Add more symbols you like (Stooq supports many via the same endpoint)
];

function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseStooqCsv(text: string) {
  // Expected header: Date,Open,High,Low,Close,Volume
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) return [];

  const out: Array<{ date: string; close: number }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;
    const date = cols[0];
    const close = Number(cols[4]);
    if (!date || !isFinite(close)) continue;
    out.push({ date, close });
  }
  return out;
}

async function fetchIndex(symbol: string) {
  // Use Stooq “download CSV” endpoint (daily). We request a bounded range for speed.
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 120);

  const d1 = yyyymmdd(start);
  const d2 = yyyymmdd(end);

  // Try range first (fast). If it fails, fall back to full download and slice.
  const urlRange = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d&d1=${d1}&d2=${d2}`;
  const urlFallback = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;

  const fetchCsv = async (u: string) => {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    return res.text();
  };

  let csv = "";
  try {
    csv = await fetchCsv(urlRange);
  } catch {
    csv = await fetchCsv(urlFallback);
  }

  const rows = parseStooqCsv(csv);
  if (rows.length < 2) return null;

  const lastRow = rows[rows.length - 1];
  const prevRow = rows[rows.length - 2];

  const last = lastRow.close;
  const prev = prevRow.close;
  const chg = last - prev;
  const chgPct = prev !== 0 ? chg / prev : undefined;

  const series = rows.slice(-30).map((r) => ({ d: r.date, c: r.close })) as MarketPoint[];

  return { last, prev, chg, chgPct, asOf: lastRow.date, series };
}

export async function GET() {
  const results = await Promise.all(
    INDICES.map(async (idx) => {
      try {
        const data = await fetchIndex(idx.symbol);
        if (!data) return { ...idx, last: NaN } as MarketIndex;
        return { ...idx, ...data } as MarketIndex;
      } catch {
        return { ...idx, last: NaN } as MarketIndex;
      }
    })
  );

  return NextResponse.json({
    updatedAt: new Date().toLocaleString(),
    indices: results,
  });
}