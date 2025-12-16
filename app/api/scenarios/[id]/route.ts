import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = await prisma.scenario.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, currency, inputs } = body || {};

    const item = await prisma.scenario.update({
      where: { id: params.id },
      data: {
        ...(name ? { name: String(name) } : {}),
        ...(currency ? { currency: String(currency) } : {}),
        ...(inputs ? { inputs } : {}),
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.scenario.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}