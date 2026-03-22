"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createPasswordHash, normalizeName, validateCredentials } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { saveRecordsForUser } from "@/lib/record-store";
import { getAccountSnapshotForUser, toSessionUser } from "@/lib/time-card-data";
import {
  normalizeThemePreferences,
  parseThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";
import type {
  AccountSnapshot,
  RecordPayload,
  RegisterUserInput,
  SegmentType,
  SessionUser,
  WorkRecord,
} from "@/lib/types";

function isSegmentType(value: unknown): value is SegmentType {
  return value === "work" || value === "break";
}

function parseRecordPayload(value: unknown): RecordPayload | null {
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

function parseRecordPayloads(records: unknown[]): RecordPayload[] {
  const safeRecords = records
    .map((record) => parseRecordPayload(record))
    .filter((record): record is RecordPayload => record !== null);

  if (safeRecords.length === 0) {
    throw new Error("保存できる記録がありませんでした。");
  }

  return safeRecords;
}

async function requireSessionUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const sessionUser = toSessionUser(session);

  if (!sessionUser) {
    throw new Error("ログインが必要です。");
  }

  return sessionUser;
}

export async function getAccountSnapshotAction(): Promise<AccountSnapshot> {
  const sessionUser = await requireSessionUser();
  return getAccountSnapshotForUser(sessionUser);
}

export async function saveAccountRecordsAction(records: RecordPayload[]): Promise<WorkRecord[]> {
  const sessionUser = await requireSessionUser();
  const safeRecords = parseRecordPayloads(records);

  return saveRecordsForUser(sessionUser.id, safeRecords);
}

export async function syncGuestRecordsAction(records: RecordPayload[]): Promise<WorkRecord[]> {
  const sessionUser = await requireSessionUser();
  const safeRecords = parseRecordPayloads(records);

  return saveRecordsForUser(sessionUser.id, safeRecords);
}

export async function saveThemePreferencesAction(themeInput: ThemePreferences): Promise<ThemePreferences> {
  const sessionUser = await requireSessionUser();
  const preferences = parseThemePreferences(themeInput);

  if (!preferences) {
    throw new Error("背景カラーは #RRGGBB 形式で指定してください。");
  }

  const user = await prisma.user.update({
    where: {
      id: sessionUser.id,
    },
    data: preferences,
    select: {
      outerBackgroundColor: true,
      innerBackgroundColor: true,
    },
  });

  return normalizeThemePreferences(user);
}

export async function registerUserAction(input: RegisterUserInput): Promise<SessionUser> {
  const name = typeof input?.name === "string" ? input.name : "";
  const password = typeof input?.password === "string" ? input.password : "";

  validateCredentials(name, password);

  const username = name.trim();
  const normalizedName = normalizeName(username);
  const existingUser = await prisma.user.findUnique({
    where: {
      normalizedName,
    },
  });

  if (existingUser) {
    throw new Error("そのユーザー名はすでに使われています。");
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

  return {
    id: user.id,
    name: user.name ?? user.username,
    username: user.username,
  };
}
