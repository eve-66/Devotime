import { NextResponse } from "next/server";

import { createPasswordHash, normalizeName, validateCredentials } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: { name?: string; password?: string };

  try {
    payload = (await request.json()) as { name?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "入力内容を読み取れませんでした。" }, { status: 400 });
  }

  const name = payload.name ?? "";
  const password = payload.password ?? "";

  try {
    validateCredentials(name, password);

    const username = name.trim();
    const normalizedName = normalizeName(username);
    const existingUser = await prisma.user.findUnique({
      where: {
        normalizedName,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "そのユーザー名はすでに使われています。" },
        { status: 409 },
      );
    }

    const { passwordHash, salt } = createPasswordHash(password);
    const user = await prisma.user.create({
      data: {
        name: username,
        username,
        normalizedName,
        passwordHash,
        passwordSalt: salt,
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name ?? user.username,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "アカウントを作成できませんでした。",
      },
      { status: 400 },
    );
  }
}
