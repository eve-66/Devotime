import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import type { RecordPayload, WorkRecord } from "@/lib/types";

const LEGACY_STORE_PATH = path.join(process.cwd(), "data", "timecard-store.json");

type StoredRecord = RecordPayload & {
  userId: string;
  createdAt: string;
};

type LegacyStore = {
  records: StoredRecord[];
};

let legacyImportPromise: Promise<void> | null = null;

async function readLegacyStore(): Promise<LegacyStore> {
  const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
  const parsed = raw.trim() ? (JSON.parse(raw) as Partial<{ records: StoredRecord[] }>) : {};

  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
  };
}

function toWorkRecord(record: {
  recordId: string;
  type: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
}): WorkRecord {
  return {
    id: record.recordId,
    type: record.type === "break" ? "break" : "work",
    startedAt: record.startedAt.toISOString(),
    endedAt: record.endedAt.toISOString(),
    durationMs: record.durationMs,
    source: "account",
  };
}

async function ensureLegacyRecordsImported() {
  if (!legacyImportPromise) {
    legacyImportPromise = (async () => {
      try {
        await fs.access(LEGACY_STORE_PATH);
      } catch {
        return;
      }

      try {
        const store = await readLegacyStore();

        if (store.records.length === 0) {
          return;
        }

        const userIds = [...new Set(store.records.map((record) => record.userId))];
        const existingUsers = await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
          },
        });
        const validUserIds = new Set(existingUsers.map((user) => user.id));
        const importableRecords = store.records.filter((record) => validUserIds.has(record.userId));

        if (importableRecords.length === 0) {
          return;
        }

        await prisma.workRecord.createMany({
          data: importableRecords.map((record) => ({
            userId: record.userId,
            recordId: record.id,
            type: record.type,
            startedAt: new Date(record.startedAt),
            endedAt: new Date(record.endedAt),
            durationMs: record.durationMs,
            createdAt: new Date(record.createdAt),
          })),
          skipDuplicates: true,
        });
      } catch (error) {
        console.error("Failed to import legacy work records.", error);
      }
    })();
  }

  await legacyImportPromise;
}

export async function listRecordsForUser(userId: string) {
  await ensureLegacyRecordsImported();

  const records = await prisma.workRecord.findMany({
    where: {
      userId,
    },
    orderBy: {
      startedAt: "desc",
    },
    select: {
      recordId: true,
      type: true,
      startedAt: true,
      endedAt: true,
      durationMs: true,
    },
  });

  return records.map(toWorkRecord);
}

export async function saveRecordsForUser(userId: string, records: RecordPayload[]) {
  await ensureLegacyRecordsImported();

  if (records.length > 0) {
    await prisma.workRecord.createMany({
      data: records.map((record) => ({
        userId,
        recordId: record.id,
        type: record.type,
        startedAt: new Date(record.startedAt),
        endedAt: new Date(record.endedAt),
        durationMs: record.durationMs,
      })),
      skipDuplicates: true,
    });
  }

  return listRecordsForUser(userId);
}
