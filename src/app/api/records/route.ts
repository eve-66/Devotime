import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { listRecordsForUser, saveRecordsForUser } from "@/lib/record-store";
import type { RecordPayload, SegmentType } from "@/lib/types";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSegmentType(value: unknown): value is SegmentType {
  return value === "work" || value === "break";
}

function parseRecord(value: unknown): RecordPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<RecordPayload>;

  if (
    typeof candidate.id !== "string" ||
    !isSegmentType(candidate.type) ||
    typeof candidate.startedAt !== "string" ||
    typeof candidate.endedAt !== "string" ||
    typeof candidate.durationMs !== "number"
  ) {
    return null;
  }

  const startedAt = new Date(candidate.startedAt);
  const endedAt = new Date(candidate.endedAt);

  if (
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(endedAt.getTime()) ||
    endedAt.getTime() < startedAt.getTime()
  ) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: Math.max(1000, Math.floor(candidate.durationMs)),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const records = await listRecordsForUser(session.user.id);
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let payload: { records?: unknown[]; record?: unknown };

  try {
    payload = (await request.json()) as { records?: unknown[]; record?: unknown };
  } catch {
    return NextResponse.json({ error: "入力内容を読み取れませんでした。" }, { status: 400 });
  }

  const inputRecords = Array.isArray(payload.records)
    ? payload.records
    : payload.record
      ? [payload.record]
      : [];

  const records = inputRecords
    .map((record) => parseRecord(record))
    .filter((record): record is RecordPayload => record !== null);

  if (records.length === 0) {
    return NextResponse.json({ error: "保存できる記録がありませんでした。" }, { status: 400 });
  }

  const savedRecords = await saveRecordsForUser(session.user.id, records);
  return NextResponse.json({ records: savedRecords });
}
