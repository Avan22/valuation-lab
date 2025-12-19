import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prisma needs Node runtime (NOT Edge)
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const item = await prisma.scenario.findUnique({
    where: { id: params.id },
  });

  if (!item) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item });
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const body = await req.json();
    const { name, currency, inputs } = body ?? {};

    const item = await prisma.scenario.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name: String(name) } : {}),
        ...(currency !== undefined ? { currency: String(currency) } : {}),
        ...(inputs !== undefined ? { inputs } : {}),
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Bad request" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await prisma.scenario.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ ok: true });
}