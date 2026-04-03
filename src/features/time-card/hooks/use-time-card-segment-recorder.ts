"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { saveAccountRecordsAction, syncGuestRecordsAction } from "@/app/actions/time-card";
import type { Feedback } from "@/features/time-card/context/time-card-app-context";
import {
  createRecord,
  getNextFeedback,
  getSaveSourceText,
  normalizeAccountRecords,
  normalizeRecord,
  toRecordPayload,
} from "@/features/time-card/lib/time-card-client-helpers";
import { sortRecords } from "@/lib/time";
import type { ActiveSegment, SegmentType, SessionUser, WorkRecord } from "@/lib/types";

type UseTimeCardSegmentRecorderParams = {
  initialAccountRecords: WorkRecord[];
  session: SessionUser | null;
  guestRecords: WorkRecord[];
  setGuestRecords: Dispatch<SetStateAction<WorkRecord[]>>;
  activeSegment: ActiveSegment | null;
  setActiveSegment: Dispatch<SetStateAction<ActiveSegment | null>>;
  setFeedback: Dispatch<SetStateAction<Feedback | null>>;
};

export function useTimeCardSegmentRecorder({
  initialAccountRecords,
  session,
  guestRecords,
  setGuestRecords,
  activeSegment,
  setActiveSegment,
  setFeedback,
}: UseTimeCardSegmentRecorderParams) {
  const [accountRecords, setAccountRecords] = useState<WorkRecord[]>(() =>
    normalizeAccountRecords(initialAccountRecords),
  );
  const [isRecordSaving, setIsRecordSaving] = useState(false);
  const [isGuestSyncing, setIsGuestSyncing] = useState(false);

  async function persistAccountRecords(records: ReturnType<typeof toRecordPayload>[]) {
    try {
      const nextRecords = await saveAccountRecordsAction(records);
      setAccountRecords(normalizeAccountRecords(nextRecords));
      return true;
    } catch {
      return false;
    }
  }

  // change segment type or finish segment
  async function transitionSegment(nextType: SegmentType | null) {
    if (!activeSegment || isRecordSaving) {
      return;
    }

    const endedAt = new Date();
    const record = createRecord(activeSegment, endedAt);

    setActiveSegment(nextType ? { type: nextType, startedAt: endedAt.toISOString() } : null);

    if (!session) {
      setGuestRecords((currentRecords) =>
        sortRecords([normalizeRecord(record, "guest"), ...currentRecords]),
      );
      setFeedback({
        tone: "success",
        text: `${getNextFeedback(nextType)} ${getSaveSourceText(null)}しました。`,
      });
      return;
    }

    setIsRecordSaving(true);
    const saved = await persistAccountRecords([record]);
    setIsRecordSaving(false);

    if (saved) {
      setFeedback({
        tone: "success",
        text: `${getNextFeedback(nextType)} ${getSaveSourceText(session)}しました。`,
      });
      return;
    }

    setGuestRecords((currentRecords) =>
      sortRecords([normalizeRecord(record, "guest"), ...currentRecords]),
    );
    setFeedback({
      tone: "error",
      text: "アカウント保存に失敗したため、この端末のゲスト記録として保持しました。",
    });
  }

  // button handlers
  function startWork() {
    if (isRecordSaving) {
      return;
    }

    if (!activeSegment) {
      setActiveSegment({ type: "work", startedAt: new Date().toISOString() });
      setFeedback({
        tone: "success",
        text: `作業を開始しました。${getSaveSourceText(session)}されます。`,
      });
      return;
    }

    if (activeSegment.type === "break") {
      void transitionSegment("work");
    }
  }

  function startBreak() {
    if (activeSegment?.type !== "work" || isRecordSaving) {
      return;
    }

    void transitionSegment("break");
  }

  function finishSegment() {
    if (!activeSegment || isRecordSaving) {
      return;
    }

    void transitionSegment(null);
  }

  async function syncGuestRecords() {
    if (!session || guestRecords.length === 0 || isGuestSyncing) {
      return;
    }

    setIsGuestSyncing(true);

    try {
      const nextRecords = await syncGuestRecordsAction(guestRecords.map(toRecordPayload));

      setGuestRecords([]);
      setAccountRecords(normalizeAccountRecords(nextRecords));
      setFeedback({
        tone: "success",
        text: "この端末のゲスト記録をアカウントに同期しました。",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "同期に失敗しました。",
      });
    } finally {
      setIsGuestSyncing(false);
    }
  }

  return {
    accountRecords,
    setAccountRecords,
    isRecordSaving,
    isGuestSyncing,
    startWork,
    startBreak,
    finishSegment,
    syncGuestRecords,
  };
}
