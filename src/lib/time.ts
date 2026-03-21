import type { WorkRecord } from "@/lib/types";

const clockFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const heroDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const rangeTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatClock(date: Date) {
  return clockFormatter.format(date);
}

export function formatHeroDate(date: Date) {
  return heroDateFormatter.format(date);
}

export function formatRecordDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatTimeRange(startedAt: string, endedAt: string) {
  return `${rangeTimeFormatter.format(new Date(startedAt))} - ${rangeTimeFormatter.format(
    new Date(endedAt),
  )}`;
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function sortRecords(records: WorkRecord[]) {
  return [...records].sort((left, right) => {
    const difference = new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();

    if (difference !== 0) {
      return difference;
    }

    return right.id.localeCompare(left.id);
  });
}

export function dedupeRecords(records: WorkRecord[]) {
  const uniqueRecords = new Map<string, WorkRecord>();

  for (const record of records) {
    uniqueRecords.set(record.id, record);
  }

  return sortRecords(Array.from(uniqueRecords.values()));
}

export function getTodaySummary(records: WorkRecord[], currentTime: Date) {
  let workMs = 0;
  let breakMs = 0;

  for (const record of records) {
    if (!sameLocalDay(new Date(record.startedAt), currentTime)) {
      continue;
    }

    if (record.type === "work") {
      workMs += record.durationMs;
      continue;
    }

    breakMs += record.durationMs;
  }

  return { workMs, breakMs };
}
