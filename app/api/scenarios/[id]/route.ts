import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { id: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  try {
    const item = await prisma.scenario.findUnique({ where: { id } });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));

    const data: any = {};
    if (body?.name !== undefined) data.name = String(body.name);
    if (body?.kind !== undefined) data.kind = String(body.kind);
    if (body?.currency !== undefined) data.currency = String(body.currency);
    if (body?.inputs !== undefined) data.inputs = body.inputs;

    const item = await prisma.scenario.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    // Prisma throws if record doesn't exist
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}