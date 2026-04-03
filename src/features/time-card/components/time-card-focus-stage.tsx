"use client";

import { useTimeCardApp } from "@/features/time-card/context/time-card-app-context";
import { formatClock, formatDuration, formatHeroDate } from "@/lib/time";

export function TimeCardFocusStage() {
  const {
    now,
    statusLabel,
    elapsedLabel,
    currentElapsedMs,
    todaySummary,
    activeSegment,
    isRecordSaving,
    startWork,
    startBreak,
    finishSegment,
  } = useTimeCardApp();

  return (
    <>
      <span className="date-chip date-chip--center">{formatHeroDate(now)}</span>
      <div className="clock-display clock-display--hero">{formatClock(now)}</div>

      <div className="status-line">現在の状態: {statusLabel}</div>

      {activeSegment ? (
        <div className="elapsed-card">
          <span className="elapsed-label">{elapsedLabel}</span>
          <strong className="elapsed-value">{formatDuration(currentElapsedMs)}</strong>
        </div>
      ) : (
        <p className="stage-note">作業開始を押すと、この画面のまま打刻を始められます。</p>
      )}

      <div className="summary-strip">
        <div className="summary-item">
          <span>今日の作業時間</span>
          <strong>{formatDuration(todaySummary.workMs)}</strong>
        </div>
        <div className="summary-item">
          <span>今日の休憩時間</span>
          <strong>{formatDuration(todaySummary.breakMs)}</strong>
        </div>
      </div>

      <div className="control-row">
        <button
          className="action-button"
          data-variant="primary"
          disabled={isRecordSaving || activeSegment?.type === "work"}
          type="button"
          onClick={startWork}
        >
          作業開始
          <span className="button-caption">
            {activeSegment?.type === "break" ? "休憩から復帰" : "新しい作業を開始"}
          </span>
        </button>

        <button
          className="action-button"
          data-variant="secondary"
          disabled={isRecordSaving || activeSegment?.type !== "work"}
          type="button"
          onClick={startBreak}
        >
          休憩
          <span className="button-caption">作業を区切って休憩を開始</span>
        </button>

        <button
          className="action-button"
          data-variant="danger"
          disabled={isRecordSaving || !activeSegment}
          type="button"
          onClick={finishSegment}
        >
          終了
          <span className="button-caption">現在の打刻を確定して終了</span>
        </button>
      </div>
    </>
  );
}
