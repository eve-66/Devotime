import type { CSSProperties } from "react";

import {
  colorToRgb,
  DEFAULT_INNER_BACKGROUND,
  DEFAULT_OUTER_BACKGROUND,
  getDefaultThemePreferences,
  isHexColor,
  normalizeThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";
import { sortRecords } from "@/lib/time";
import type { ActiveSegment, RecordPayload, SegmentType, SessionUser, WorkRecord } from "@/lib/types";

export const LOCAL_STATE_KEY = "devotime-local-state";
export const GUEST_MODE_THEME: ThemePreferences = {
  outerBackgroundColor: "#08131f",
  innerBackgroundColor: "#08131f",
};

export type PersistedState = {
  guestRecords: WorkRecord[];
  activeSegment: ActiveSegment | null;
  guestTheme: ThemePreferences;
};

export function isSegmentType(value: unknown): value is SegmentType {
  return value === "work" || value === "break";
}

function isActiveSegment(value: unknown): value is ActiveSegment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ActiveSegment>;
  return isSegmentType(candidate.type) && typeof candidate.startedAt === "string";
}

export function normalizeRecord(
  record: Omit<WorkRecord, "source">,
  source: WorkRecord["source"],
): WorkRecord {
  return {
    ...record,
    source,
  };
}

export function parsePersistedState(raw: string | null): PersistedState {
  if (!raw) {
    return {
      guestRecords: [],
      activeSegment: null,
      guestTheme: getDefaultThemePreferences(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      guestRecords?: unknown;
      activeSegment?: unknown;
      backgroundColor?: unknown;
      outerBackgroundColor?: unknown;
      innerBackgroundColor?: unknown;
    };
    const guestRecords = Array.isArray(parsed.guestRecords)
      ? parsed.guestRecords
          .filter((record): record is WorkRecord => {
            if (!record || typeof record !== "object") {
              return false;
            }

            const candidate = record as Partial<WorkRecord>;
            return (
              typeof candidate.id === "string" &&
              isSegmentType(candidate.type) &&
              typeof candidate.startedAt === "string" &&
              typeof candidate.endedAt === "string" &&
              typeof candidate.durationMs === "number"
            );
          })
          .map((record) => ({ ...record, source: "guest" as const }))
      : [];

    const legacyOuterBackground =
      typeof parsed.backgroundColor === "string" && isHexColor(parsed.backgroundColor)
        ? parsed.backgroundColor
        : DEFAULT_OUTER_BACKGROUND;

    return {
      guestRecords,
      activeSegment: isActiveSegment(parsed.activeSegment) ? parsed.activeSegment : null,
      guestTheme: normalizeThemePreferences({
        outerBackgroundColor:
          typeof parsed.outerBackgroundColor === "string"
            ? parsed.outerBackgroundColor
            : legacyOuterBackground,
        innerBackgroundColor:
          typeof parsed.innerBackgroundColor === "string"
            ? parsed.innerBackgroundColor
            : DEFAULT_INNER_BACKGROUND,
      }),
    };
  } catch {
    return {
      guestRecords: [],
      activeSegment: null,
      guestTheme: getDefaultThemePreferences(),
    };
  }
}

export function buildThemeStyle(theme: ThemePreferences): CSSProperties {
  const outer = normalizeThemePreferences(theme);
  const outerRgb = colorToRgb(outer.outerBackgroundColor, DEFAULT_OUTER_BACKGROUND);
  const innerRgb = colorToRgb(outer.innerBackgroundColor, DEFAULT_INNER_BACKGROUND);

  return {
    ["--accent" as string]: outer.outerBackgroundColor,
    ["--accent-rgb" as string]: `${outerRgb.red} ${outerRgb.green} ${outerRgb.blue}`,
    ["--card-inner" as string]: outer.innerBackgroundColor,
    ["--card-inner-rgb" as string]: `${innerRgb.red} ${innerRgb.green} ${innerRgb.blue}`,
  };
}

export function normalizeAccountRecords(
  records: Array<Omit<WorkRecord, "source"> | WorkRecord>,
): WorkRecord[] {
  return sortRecords(
    records.map((record) =>
      normalizeRecord(
        {
          id: record.id,
          type: record.type,
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          durationMs: record.durationMs,
        },
        "account",
      ),
    ),
  );
}

export function createRecord(segment: ActiveSegment, endedAt: Date): RecordPayload {
  const startedAtDate = new Date(segment.startedAt);

  return {
    id: crypto.randomUUID(),
    type: segment.type,
    startedAt: startedAtDate.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: Math.max(1000, endedAt.getTime() - startedAtDate.getTime()),
  };
}

export function toRecordPayload(record: WorkRecord): RecordPayload {
  return {
    id: record.id,
    type: record.type,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationMs: record.durationMs,
  };
}

export function getStatusLabel(activeSegment: ActiveSegment | null) {
  if (!activeSegment) {
    return "待機中";
  }

  return activeSegment.type === "work" ? "作業中" : "休憩中";
}

export function getElapsedLabel(activeSegment: ActiveSegment | null) {
  if (!activeSegment) {
    return "現在の作業経過時間";
  }

  return activeSegment.type === "work" ? "現在の作業経過時間" : "現在の休憩時間";
}

export function getNextFeedback(segmentType: SegmentType | null) {
  if (segmentType === "work") {
    return "作業を再開しました。";
  }

  if (segmentType === "break") {
    return "休憩に切り替えました。";
  }

  return "打刻を終了しました。";
}

export function getSaveSourceText(session: SessionUser | null) {
  return session ? `${session.name} のアカウント保存` : "この端末にゲスト保存";
}
