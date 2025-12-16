export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, kind, currency, inputs } = body || {};

    if (!name || !kind || !inputs) {
      return NextResponse.json(
        { ok: false, error: "name, kind, inputs are required" },
        { status: 400 }
      );
    }

    const item = await prisma.scenario.create({
      data: {
        name: String(name),
        kind: String(kind),
        currency: currency ? String(currency) : "USD",
        inputs,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}