"use client";

import type { CSSProperties, FocusEvent, FormEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";

import {
  colorToRgb,
  DEFAULT_INNER_BACKGROUND,
  DEFAULT_OUTER_BACKGROUND,
  getDefaultThemePreferences,
  isHexColor,
  normalizeThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";
import {
  dedupeRecords,
  formatClock,
  formatDuration,
  formatHeroDate,
  getTodaySummary,
  sameLocalDay,
  sortRecords,
} from "@/lib/time";
import type { ActiveSegment, RecordPayload, SegmentType, SessionUser, WorkRecord } from "@/lib/types";

const LOCAL_STATE_KEY = "devotime-local-state";
const GUEST_MODE_THEME: ThemePreferences = {
  outerBackgroundColor: "#08131f",
  innerBackgroundColor: "#08131f",
};

type FeedbackTone = "info" | "success" | "error";

type Feedback = {
  tone: FeedbackTone;
  text: string;
};

type PersistedState = {
  guestRecords: WorkRecord[];
  activeSegment: ActiveSegment | null;
  guestTheme: ThemePreferences;
};

type AuthMode = "login" | "signup";

type RecordsResponsePayload = {
  records?: Array<Omit<WorkRecord, "source"> | WorkRecord>;
  error?: string;
};

type PreferencesResponsePayload = {
  preferences?: ThemePreferences;
  error?: string;
};

function isSegmentType(value: unknown): value is SegmentType {
  return value === "work" || value === "break";
}

function isActiveSegment(value: unknown): value is ActiveSegment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ActiveSegment>;
  return isSegmentType(candidate.type) && typeof candidate.startedAt === "string";
}

function normalizeRecord(record: Omit<WorkRecord, "source">, source: WorkRecord["source"]): WorkRecord {
  return {
    ...record,
    source,
  };
}

function parsePersistedState(raw: string | null): PersistedState {
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

function buildThemeStyle(theme: ThemePreferences): CSSProperties {
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

async function readPreferencesPayload(response: Response) {
  const rawResponse = await response.text();

  if (!rawResponse) {
    return {} as PreferencesResponsePayload;
  }

  try {
    return JSON.parse(rawResponse) as PreferencesResponsePayload;
  } catch {
    throw new Error("設定レスポンスを読み取れませんでした。");
  }
}

function createRecord(segment: ActiveSegment, endedAt: Date): RecordPayload {
  const startedAtDate = new Date(segment.startedAt);

  return {
    id: crypto.randomUUID(),
    type: segment.type,
    startedAt: startedAtDate.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: Math.max(1000, endedAt.getTime() - startedAtDate.getTime()),
  };
}

function getStatusLabel(activeSegment: ActiveSegment | null) {
  if (!activeSegment) {
    return "待機中";
  }

  return activeSegment.type === "work" ? "作業中" : "休憩中";
}

function getElapsedLabel(activeSegment: ActiveSegment | null) {
  if (!activeSegment) {
    return "現在の作業経過時間";
  }

  return activeSegment.type === "work" ? "現在の作業経過時間" : "現在の休憩時間";
}

function getNextFeedback(segmentType: SegmentType | null) {
  if (segmentType === "work") {
    return "作業を再開しました。";
  }

  if (segmentType === "break") {
    return "休憩に切り替えました。";
  }

  return "打刻を終了しました。";
}

function getSaveSourceText(session: SessionUser | null) {
  return session ? `${session.name} のアカウント保存` : "この端末にゲスト保存";
}

export function TimeCardApp() {
  const [now, setNow] = useState(() => new Date());
  const [guestRecords, setGuestRecords] = useState<WorkRecord[]>([]);
  const [accountRecords, setAccountRecords] = useState<WorkRecord[]>([]);
  const [activeSegment, setActiveSegment] = useState<ActiveSegment | null>(null);
  const [guestTheme, setGuestTheme] = useState<ThemePreferences>(() => getDefaultThemePreferences());
  const [accountTheme, setAccountTheme] = useState<ThemePreferences>(() => getDefaultThemePreferences());
  const [settingsThemeDraft, setSettingsThemeDraft] = useState<ThemePreferences>(() =>
    getDefaultThemePreferences(),
  );
  const [session, setSession] = useState<SessionUser | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isRecordSaving, setIsRecordSaving] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isGuestSyncing, setIsGuestSyncing] = useState(false);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const accountThemeRef = useRef<ThemePreferences>(getDefaultThemePreferences());
  const settingsThemeDraftRef = useRef<ThemePreferences>(getDefaultThemePreferences());
  const isPreferencesSavingRef = useRef(false);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const persistedState = parsePersistedState(window.localStorage.getItem(LOCAL_STATE_KEY));

    setGuestRecords(persistedState.guestRecords);
    setActiveSegment(persistedState.activeSegment);
    setGuestTheme(persistedState.guestTheme);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      LOCAL_STATE_KEY,
      JSON.stringify({
        guestRecords,
        activeSegment,
        outerBackgroundColor: guestTheme.outerBackgroundColor,
        innerBackgroundColor: guestTheme.innerBackgroundColor,
      }),
    );
  }, [activeSegment, guestRecords, guestTheme, isHydrated]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    accountThemeRef.current = accountTheme;
  }, [accountTheme]);

  useEffect(() => {
    settingsThemeDraftRef.current = settingsThemeDraft;
  }, [settingsThemeDraft]);

  useEffect(() => {
    isPreferencesSavingRef.current = isPreferencesSaving;
  }, [isPreferencesSaving]);

  const handleSettingsDismiss = useEffectEvent(() => {
    void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
  });

  useEffect(() => {
    async function restoreSession() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.user?.id) {
          const defaultTheme = getDefaultThemePreferences();
          setSession(null);
          setAccountRecords([]);
          setAccountTheme(defaultTheme);
          setSettingsThemeDraft(defaultTheme);
          return;
        }

        const username = currentSession.user.username ?? currentSession.user.name ?? "User";
        setSession({
          id: currentSession.user.id,
          name: currentSession.user.name ?? username,
          username,
        });
        const recordsResponse = await fetch("/api/records", { cache: "no-store" });
        const recordsPayload = (await recordsResponse.json()) as RecordsResponsePayload;

        if (!recordsResponse.ok || !Array.isArray(recordsPayload.records)) {
          throw new Error(recordsPayload.error ?? "記録を読み込めませんでした。");
        }

        setAccountRecords(
          sortRecords(
            recordsPayload.records.map((record) =>
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
          ),
        );

        try {
          const preferencesResponse = await fetch("/api/preferences", { cache: "no-store" });
          const preferencesPayload = await readPreferencesPayload(preferencesResponse);

          if (!preferencesResponse.ok || !preferencesPayload.preferences) {
            throw new Error(preferencesPayload.error ?? "設定を読み込めませんでした。");
          }

          const nextTheme = normalizeThemePreferences(preferencesPayload.preferences);
          setAccountTheme(nextTheme);
          setSettingsThemeDraft(nextTheme);
        } catch {
          const defaultTheme = getDefaultThemePreferences();
          setAccountTheme(defaultTheme);
          setSettingsThemeDraft(defaultTheme);
        }
      } catch {
        const defaultTheme = getDefaultThemePreferences();
        setSession(null);
        setAccountRecords([]);
        setAccountTheme(defaultTheme);
        setSettingsThemeDraft(defaultTheme);
      } finally {
        setIsSessionLoading(false);
      }
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    if (!showSettingsPopover) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        settingsPopoverRef.current &&
        event.target instanceof Node &&
        !settingsPopoverRef.current.contains(event.target)
      ) {
        handleSettingsDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleSettingsDismiss();
      }
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSettingsPopover]);

  function resetAccountTheme() {
    const defaultTheme = getDefaultThemePreferences();
    setAccountTheme(defaultTheme);
    setSettingsThemeDraft(defaultTheme);
  }

  function openSettingsPopover() {
    setSettingsThemeDraft(accountThemeRef.current);
    setShowSettingsPopover(true);
  }

  function closeSettingsPopover() {
    setShowSettingsPopover(false);
  }

  async function loadAccountRecords() {
    const response = await fetch("/api/records", { cache: "no-store" });
    const payload = (await response.json()) as RecordsResponsePayload;

    if (!response.ok || !Array.isArray(payload.records)) {
      throw new Error(payload.error ?? "記録を読み込めませんでした。");
    }

    setAccountRecords(
      sortRecords(
        payload.records.map((record) =>
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
      ),
    );
  }

  async function loadAccountTheme() {
    const response = await fetch("/api/preferences", { cache: "no-store" });
    const payload = await readPreferencesPayload(response);

    if (!response.ok || !payload.preferences) {
      throw new Error(payload.error ?? "設定を読み込めませんでした。");
    }

    const nextTheme = normalizeThemePreferences(payload.preferences);
    setAccountTheme(nextTheme);
    setSettingsThemeDraft(nextTheme);
  }

  async function persistAccountRecords(records: RecordPayload[]) {
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records }),
      });

      const payload = (await response.json()) as RecordsResponsePayload;

      if (!response.ok || !Array.isArray(payload.records)) {
        throw new Error(payload.error ?? "アカウントへの保存に失敗しました。");
      }

      setAccountRecords(
        sortRecords(
          payload.records.map((record) =>
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
        ),
      );

      return true;
    } catch {
      return false;
    }
  }

  async function persistThemePreferences(themeToSave: ThemePreferences) {
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences: themeToSave,
      }),
    });

    const payload = await readPreferencesPayload(response);

    if (!response.ok || !payload.preferences) {
      throw new Error(payload.error ?? "背景カラーを保存できませんでした。");
    }

    return normalizeThemePreferences(payload.preferences);
  }

  function updateSettingsTheme(key: keyof ThemePreferences, value: string) {
    if (!isHexColor(value)) {
      return;
    }

    setSettingsThemeDraft((currentTheme) => ({
      ...currentTheme,
      [key]: value,
    }));
  }

  async function saveSettingsThemeDraft(
    themeToSave: ThemePreferences,
    closeAfterSave = false,
  ) {
    if (!session || isPreferencesSavingRef.current) {
      if (closeAfterSave) {
        setShowSettingsPopover(false);
      }
      return;
    }

    const normalizedTheme = normalizeThemePreferences(themeToSave);
    const previousTheme = accountThemeRef.current;
    const isDirty =
      normalizedTheme.outerBackgroundColor !== previousTheme.outerBackgroundColor ||
      normalizedTheme.innerBackgroundColor !== previousTheme.innerBackgroundColor;

    if (!isDirty) {
      if (closeAfterSave) {
        setShowSettingsPopover(false);
      }
      return;
    }

    setAccountTheme(normalizedTheme);
    setSettingsThemeDraft(normalizedTheme);

    if (closeAfterSave) {
      setShowSettingsPopover(false);
    }

    isPreferencesSavingRef.current = true;
    setIsPreferencesSaving(true);

    try {
      const nextTheme = await persistThemePreferences(normalizedTheme);
      setAccountTheme(nextTheme);
      setSettingsThemeDraft(nextTheme);
    } catch (error) {
      setAccountTheme(previousTheme);
      setSettingsThemeDraft(previousTheme);

      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "背景カラーの保存に失敗しました。",
      });
    } finally {
      isPreferencesSavingRef.current = false;
      setIsPreferencesSaving(false);
    }
  }

  function handleSettingsPopoverBlur(event: FocusEvent<HTMLElement>) {
    const nextFocused = event.relatedTarget;

    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return;
    }

    void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
  }

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

  function handleStart() {
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

  function handleBreak() {
    if (activeSegment?.type !== "work" || isRecordSaving) {
      return;
    }

    void transitionSegment("break");
  }

  function handleFinish() {
    if (!activeSegment || isRecordSaving) {
      return;
    }

    void transitionSegment(null);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthPending(true);

    try {
      if (authMode === "signup") {
        const registerResponse = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: authName,
            password: authPassword,
          }),
        });

        const registerPayload = (await registerResponse.json()) as {
          error?: string;
        };

        if (!registerResponse.ok) {
          throw new Error(registerPayload.error ?? "アカウントを作成できませんでした。");
        }
      }

      const loginResult = await signIn("credentials", {
        name: authName,
        password: authPassword,
        redirect: false,
      });

      if (loginResult?.error) {
        throw new Error("ユーザー名またはパスワードが違います。");
      }

      const currentSession = await getSession();

      if (!currentSession?.user?.id) {
        throw new Error("ログイン状態を確認できませんでした。");
      }

      const username = currentSession.user.username ?? currentSession.user.name ?? "User";
      setSession({
        id: currentSession.user.id,
        name: currentSession.user.name ?? username,
        username,
      });
      setAuthName("");
      setAuthPassword("");
      setShowAuthPanel(false);
      await loadAccountRecords();

      try {
        await loadAccountTheme();
      } catch {
        resetAccountTheme();
      }

      setFeedback({
        tone: "success",
        text:
          authMode === "signup"
            ? "アカウントを作成してログインしました。"
            : "ログインしました。以降の記録はアカウントにも保存されます。",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "ログイン処理に失敗しました。",
      });
    } finally {
      setIsAuthPending(false);
    }
  }

  async function handleLogout() {
    setIsAuthPending(true);

    try {
      await signOut({
        redirect: false,
      });

      setSession(null);
      setAccountRecords([]);
      resetAccountTheme();
      setShowSettingsPopover(false);
      setFeedback({
        tone: "info",
        text: "ログアウトしました。ここからの記録はゲスト保存になります。",
      });
    } finally {
      setIsAuthPending(false);
    }
  }

  async function handleGuestSync() {
    if (!session || guestRecords.length === 0 || isGuestSyncing) {
      return;
    }

    setIsGuestSyncing(true);

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: guestRecords.map((record) => ({
            id: record.id,
            type: record.type,
            startedAt: record.startedAt,
            endedAt: record.endedAt,
            durationMs: record.durationMs,
          })),
        }),
      });

      const payload = (await response.json()) as RecordsResponsePayload;

      if (!response.ok || !Array.isArray(payload.records)) {
        throw new Error(payload.error ?? "ゲスト記録を同期できませんでした。");
      }

      setGuestRecords([]);
      setAccountRecords(
        sortRecords(
          payload.records.map((record) =>
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
        ),
      );
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

  const currentTheme =
    session && (showSettingsPopover || isPreferencesSaving)
      ? settingsThemeDraft
      : session
        ? accountTheme
        : GUEST_MODE_THEME;
  const themeStyle = buildThemeStyle(currentTheme);
  const mergedRecords = dedupeRecords([...accountRecords, ...guestRecords]);
  const currentElapsedMs = activeSegment
    ? Math.max(0, now.getTime() - new Date(activeSegment.startedAt).getTime())
    : 0;
  const todaySummary = getTodaySummary(mergedRecords, now);

  if (activeSegment && sameLocalDay(new Date(activeSegment.startedAt), now)) {
    if (activeSegment.type === "work") {
      todaySummary.workMs += currentElapsedMs;
    } else {
      todaySummary.breakMs += currentElapsedMs;
    }
  }

  const statusLabel = getStatusLabel(activeSegment);

  return (
    <main className="app-shell" style={themeStyle}>
      <div aria-hidden="true" className="app-background" />

      {feedback ? (
        <div className="feedback-banner" data-tone={feedback.tone}>
          {feedback.text}
        </div>
      ) : null}

      <header className="topbar">
        <div className="brand-lockup">
          <span className="eyebrow">Devote your Time</span>
          <h1 className="brand-title brand-title--compact">Devotime</h1>
        </div>

        <div className="topbar-actions">
          <div className="status-chip" data-mode={session ? "account" : "guest"}>
            {isSessionLoading ? "保存先を確認中" : session ? "アカウント保存中" : "ゲストモード"}
          </div>

          {session ? (
            <>
              {guestRecords.length > 0 ? (
                <button
                  className="plain-button"
                  disabled={isGuestSyncing}
                  type="button"
                  onClick={handleGuestSync}
                >
                  {isGuestSyncing ? "同期中..." : "ゲスト記録を同期"}
                </button>
              ) : null}

              <div className="settings-anchor" ref={settingsPopoverRef}>
                <button
                  aria-expanded={showSettingsPopover}
                  aria-haspopup="dialog"
                  className="plain-button plain-button--user"
                  data-open={showSettingsPopover}
                  type="button"
                  onClick={() => {
                    if (showSettingsPopover) {
                      closeSettingsPopover();
                    } else {
                      openSettingsPopover();
                    }
                  }}
                >
                  {session.username}
                </button>

                {showSettingsPopover ? (
                  <section
                    aria-label="ユーザ設定"
                    className="settings-popover"
                    role="dialog"
                    onBlur={handleSettingsPopoverBlur}
                  >
                    <div className="settings-popover-head">
                      <div>
                        <span className="eyebrow">User Settings</span>
                        <h2 className="settings-title">背景カラー設定</h2>
                      </div>

                      <button
                        aria-label="ユーザ設定を閉じる"
                        className="plain-button plain-button--icon"
                        type="button"
                        onClick={() => {
                          void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
                        }}
                      >
                        閉じる
                      </button>
                    </div>

                    {isPreferencesSaving ? <p className="settings-status">保存中...</p> : null}

                    <div className="settings-form">
                      <label className="color-field">
                        <span className="color-field-head">
                          <span>外側カラー</span>
                          <span className="color-value">{settingsThemeDraft.outerBackgroundColor}</span>
                        </span>
                        <div className="color-input-row">
                          <input
                            aria-label="カード外側の背景カラー"
                            className="color-picker"
                            type="color"
                            value={settingsThemeDraft.outerBackgroundColor}
                            onChange={(event) =>
                              updateSettingsTheme("outerBackgroundColor", event.target.value)
                            }
                          />
                          <span className="field-note">
                            カードの外側と全体のアクセントに反映されます。
                          </span>
                        </div>
                      </label>

                      <label className="color-field">
                        <span className="color-field-head">
                          <span>内側カラー</span>
                          <span className="color-value">{settingsThemeDraft.innerBackgroundColor}</span>
                        </span>
                        <div className="color-input-row">
                          <input
                            aria-label="カード内側の背景カラー"
                            className="color-picker"
                            type="color"
                            value={settingsThemeDraft.innerBackgroundColor}
                            onChange={(event) =>
                              updateSettingsTheme("innerBackgroundColor", event.target.value)
                            }
                          />
                          <span className="field-note">
                            メインカードの内側のトーンに反映されます。
                          </span>
                        </div>
                      </label>
                    </div>
                  </section>
                ) : null}
              </div>

              <button
                className="plain-button"
                disabled={isAuthPending}
                type="button"
                onClick={handleLogout}
              >
                ログアウト
              </button>
            </>
          ) : (
            <button className="plain-button" type="button" onClick={() => setShowAuthPanel(true)}>
              ログイン / 新規登録
            </button>
          )}
        </div>
      </header>

      <section className="focus-stage">
        <span className="date-chip date-chip--center">{formatHeroDate(now)}</span>
        <div className="clock-display clock-display--hero">{formatClock(now)}</div>

        <div className="status-line">現在の状態: {statusLabel}</div>

        {activeSegment ? (
          <div className="elapsed-card">
            <span className="elapsed-label">{getElapsedLabel(activeSegment)}</span>
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
            onClick={handleStart}
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
            onClick={handleBreak}
          >
            休憩
            <span className="button-caption">作業を区切って休憩を開始</span>
          </button>

          <button
            className="action-button"
            data-variant="danger"
            disabled={isRecordSaving || !activeSegment}
            type="button"
            onClick={handleFinish}
          >
            終了
            <span className="button-caption">現在の打刻を確定して終了</span>
          </button>
        </div>
      </section>

      {showAuthPanel ? (
        <div
          aria-hidden="true"
          className="auth-overlay"
          onClick={() => setShowAuthPanel(false)}
        >
          <section
            aria-labelledby="auth-dialog-title"
            aria-modal="true"
            className="auth-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-dialog-head">
              <div>
                <span className="eyebrow">Save Your Logs</span>
                <h2 className="dialog-title" id="auth-dialog-title">
                  アカウント保存
                </h2>
                <p className="dialog-copy">
                  ログインすると、このブラウザを閉じても打刻履歴を残せます。
                </p>
              </div>

              <button
                aria-label="ログインパネルを閉じる"
                className="plain-button plain-button--icon"
                type="button"
                onClick={() => setShowAuthPanel(false)}
              >
                閉じる
              </button>
            </div>

            <div className="auth-toggle">
              <button
                className="auth-tab"
                data-active={authMode === "login"}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                ログイン
              </button>
              <button
                className="auth-tab"
                data-active={authMode === "signup"}
                type="button"
                onClick={() => setAuthMode("signup")}
              >
                新規登録
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label className="field-label">
                ユーザー名
                <input
                  className="text-input"
                  placeholder="例: nakai-lab"
                  required
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                />
              </label>

              <label className="field-label">
                パスワード
                <input
                  className="text-input"
                  minLength={4}
                  placeholder="4文字以上"
                  required
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
              </label>

              <button className="secondary-button" disabled={isAuthPending} type="submit">
                {isAuthPending
                  ? "処理中..."
                  : authMode === "signup"
                    ? "アカウントを作成"
                    : "ログインする"}
              </button>
            </form>

            {guestRecords.length > 0 ? (
              <p className="small-note">
                ログイン後に「ゲスト記録を同期」を押すと、この端末の記録もアカウントへ移せます。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
