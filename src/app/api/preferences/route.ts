import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeThemePreferences,
  parseThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      outerBackgroundColor: true,
      innerBackgroundColor: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザが見つかりませんでした。" }, { status: 404 });
  }

  return NextResponse.json({
    preferences: normalizeThemePreferences(user),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let payload: { preferences?: unknown } | ThemePreferences | null = null;

  try {
    const rawBody = await request.text();
    payload = rawBody
      ? ((JSON.parse(rawBody) as { preferences?: unknown } | ThemePreferences))
      : null;
  } catch {
    return NextResponse.json({ error: "入力内容を読み取れませんでした。" }, { status: 400 });
  }

  const preferences = parseThemePreferences(
    payload && typeof payload === "object" && "preferences" in payload ? payload.preferences : payload,
  );

  if (!preferences) {
    return NextResponse.json(
      { error: "背景カラーは #RRGGBB 形式で指定してください。" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: preferences,
    select: {
      outerBackgroundColor: true,
      innerBackgroundColor: true,
    },
  });

  return NextResponse.json({
    preferences: normalizeThemePreferences(user),
  });
}
