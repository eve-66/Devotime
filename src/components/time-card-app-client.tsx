"use client";

import type { CSSProperties, FocusEvent, ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";

import {
  getAccountSnapshotAction,
  registerUserAction,
  saveAccountRecordsAction,
  saveThemePreferencesAction,
  syncGuestRecordsAction,
} from "@/app/actions/time-card";
import {
  TimeCardAppContextProvider,
  type AuthMode,
  type Feedback,
} from "@/components/time-card-app-context";
import {
  colorToRgb,
  DEFAULT_INNER_BACKGROUND,
  DEFAULT_OUTER_BACKGROUND,
  getDefaultThemePreferences,
  isHexColor,
  normalizeThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";
import { dedupeRecords, getTodaySummary, sameLocalDay, sortRecords } from "@/lib/time";
import type { ActiveSegment, RecordPayload, SegmentType, SessionUser, WorkRecord } from "@/lib/types";

const LOCAL_STATE_KEY = "devotime-local-state";
const GUEST_MODE_THEME: ThemePreferences = {
  outerBackgroundColor: "#08131f",
  innerBackgroundColor: "#08131f",
};

type PersistedState = {
  guestRecords: WorkRecord[];
  activeSegment: ActiveSegment | null;
  guestTheme: ThemePreferences;
};

type TimeCardAppClientProps = {
  initialSession: SessionUser | null;
  initialAccountTheme: ThemePreferences;
  initialAccountRecords: WorkRecord[];
  feedbackBanner: ReactNode;
  header: ReactNode;
  focusStage: ReactNode;
  authDialog: ReactNode;
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

function normalizeAccountRecords(
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

export function TimeCardAppClient({
  initialSession,
  initialAccountTheme,
  initialAccountRecords,
  feedbackBanner,
  header,
  focusStage,
  authDialog,
}: TimeCardAppClientProps) {
  const normalizedInitialAccountTheme = normalizeThemePreferences(initialAccountTheme);
  const [now, setNow] = useState(() => new Date());
  const [guestRecords, setGuestRecords] = useState<WorkRecord[]>([]);
  const [accountRecords, setAccountRecords] = useState<WorkRecord[]>(() =>
    normalizeAccountRecords(initialAccountRecords),
  );
  const [activeSegment, setActiveSegment] = useState<ActiveSegment | null>(null);
  const [guestTheme, setGuestTheme] = useState<ThemePreferences>(() => getDefaultThemePreferences());
  const [accountTheme, setAccountTheme] = useState<ThemePreferences>(() => normalizedInitialAccountTheme);
  const [settingsThemeDraft, setSettingsThemeDraft] = useState<ThemePreferences>(
    () => normalizedInitialAccountTheme,
  );
  const [session, setSession] = useState<SessionUser | null>(initialSession);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isRecordSaving, setIsRecordSaving] = useState(false);
  const [isGuestSyncing, setIsGuestSyncing] = useState(false);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const accountThemeRef = useRef<ThemePreferences>(normalizedInitialAccountTheme);
  const settingsThemeDraftRef = useRef<ThemePreferences>(normalizedInitialAccountTheme);
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

  function toggleSettingsPopover() {
    if (showSettingsPopover) {
      setShowSettingsPopover(false);
      return;
    }

    setSettingsThemeDraft(accountThemeRef.current);
    setShowSettingsPopover(true);
  }

  async function persistAccountRecords(records: RecordPayload[]) {
    try {
      const nextRecords = await saveAccountRecordsAction(records);
      setAccountRecords(normalizeAccountRecords(nextRecords));
      return true;
    } catch {
      return false;
    }
  }

  async function persistThemePreferences(themeToSave: ThemePreferences) {
    return saveThemePreferencesAction(themeToSave);
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

  function openAuthPanel() {
    setShowAuthPanel(true);
  }

  function closeAuthPanel() {
    setShowAuthPanel(false);
  }

  function changeAuthMode(mode: AuthMode) {
    setAuthMode(mode);
  }

  function changeAuthName(value: string) {
    setAuthName(value);
  }

  function changeAuthPassword(value: string) {
    setAuthPassword(value);
  }

  async function submitAuthForm() {
    setIsAuthPending(true);

    try {
      if (authMode === "signup") {
        await registerUserAction({
          name: authName,
          password: authPassword,
        });
      }

      const loginResult = await signIn("credentials", {
        name: authName,
        password: authPassword,
        redirect: false,
      });

      if (loginResult?.error) {
        throw new Error("ユーザー名またはパスワードが違います。");
      }

      const snapshot = await getAccountSnapshotAction();
      const nextTheme = normalizeThemePreferences(snapshot.accountTheme);

      setSession(snapshot.sessionUser);
      setAccountRecords(normalizeAccountRecords(snapshot.accountRecords));
      setAccountTheme(nextTheme);
      setSettingsThemeDraft(nextTheme);
      setAuthName("");
      setAuthPassword("");
      setShowAuthPanel(false);

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

  async function logout() {
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

  async function syncGuestRecords() {
    if (!session || guestRecords.length === 0 || isGuestSyncing) {
      return;
    }

    setIsGuestSyncing(true);

    try {
      const nextRecords = await syncGuestRecordsAction(
        guestRecords.map((record) => ({
          id: record.id,
          type: record.type,
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          durationMs: record.durationMs,
        })),
      );

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

  const contextValue = {
    session,
    feedback,
    guestRecordCount: guestRecords.length,
    isGuestSyncing,
    syncGuestRecords,
    settingsPopoverRef,
    showSettingsPopover,
    toggleSettingsPopover,
    closeSettingsAndSave: () => {
      void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
    },
    handleSettingsPopoverBlur,
    settingsThemeDraft,
    updateSettingsTheme,
    isPreferencesSaving,
    isAuthPending,
    logout,
    showAuthPanel,
    openAuthPanel,
    closeAuthPanel,
    authMode,
    changeAuthMode,
    authName,
    changeAuthName,
    authPassword,
    changeAuthPassword,
    submitAuthForm,
    now,
    statusLabel: getStatusLabel(activeSegment),
    elapsedLabel: getElapsedLabel(activeSegment),
    currentElapsedMs,
    todaySummary,
    activeSegment,
    isRecordSaving,
    startWork,
    startBreak,
    finishSegment,
  };

  return (
    <TimeCardAppContextProvider value={contextValue}>
      <main className="app-shell" style={themeStyle}>
        <div aria-hidden="true" className="app-background" />
        {feedbackBanner}
        {header}
        {focusStage}
        {authDialog}
      </main>
    </TimeCardAppContextProvider>
  );
}
