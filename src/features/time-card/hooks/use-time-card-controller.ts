"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import type { TimeCardAppContextValue } from "@/features/time-card/context/time-card-app-context";
import { useTimeCardAuthFlow } from "@/features/time-card/hooks/use-time-card-auth-flow";
import { useTimeCardFeedback } from "@/features/time-card/hooks/use-time-card-feedback";
import { useTimeCardGuestStorage } from "@/features/time-card/hooks/use-time-card-guest-storage";
import { useTimeCardSegmentRecorder } from "@/features/time-card/hooks/use-time-card-segment-recorder";
import { useTimeCardThemeSettings } from "@/features/time-card/hooks/use-time-card-theme-settings";
import {
  buildThemeStyle,
  getElapsedLabel,
  getStatusLabel,
  GUEST_MODE_THEME,
} from "@/features/time-card/lib/time-card-client-helpers";
import { dedupeRecords, getTodaySummary, sameLocalDay } from "@/lib/time";
import type { ThemePreferences } from "@/lib/theme";
import type { SessionUser, WorkRecord } from "@/lib/types";

type UseTimeCardControllerParams = {
  initialSession: SessionUser | null;
  initialAccountTheme: ThemePreferences;
  initialAccountRecords: WorkRecord[];
};

type UseTimeCardControllerResult = {
  themeStyle: CSSProperties;
  contextValue: TimeCardAppContextValue;
};

export function useTimeCardController({
  initialSession,
  initialAccountTheme,
  initialAccountRecords,
}: UseTimeCardControllerParams): UseTimeCardControllerResult {
  const [now, setNow] = useState(() => new Date());
  const [session, setSession] = useState<SessionUser | null>(initialSession);
  const { feedback, setFeedback } = useTimeCardFeedback();
  const { guestRecords, setGuestRecords, activeSegment, setActiveSegment } = useTimeCardGuestStorage();
  const themeSettings = useTimeCardThemeSettings({
    initialAccountTheme,
    session,
    setFeedback,
  });
  const records = useTimeCardSegmentRecorder({
    initialAccountRecords,
    session,
    guestRecords,
    setGuestRecords,
    activeSegment,
    setActiveSegment,
    setFeedback,
  });
  const auth = useTimeCardAuthFlow({
    setSession,
    setFeedback,
    applyAccountTheme: themeSettings.applyAccountTheme,
    setAccountRecords: records.setAccountRecords,
    closeSettingsPopover: themeSettings.closeSettingsPopover,
    resetAccountTheme: themeSettings.resetAccountTheme,
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const currentTheme =
    session && (themeSettings.showSettingsPopover || themeSettings.isPreferencesSaving)
      ? themeSettings.settingsThemeDraft
      : session
        ? themeSettings.accountTheme
        : GUEST_MODE_THEME;
  const themeStyle = buildThemeStyle(currentTheme);
  const mergedRecords = dedupeRecords([...records.accountRecords, ...guestRecords]);
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

  const contextValue: TimeCardAppContextValue = {
    session,
    feedback,
    guestRecordCount: guestRecords.length,
    isGuestSyncing: records.isGuestSyncing,
    syncGuestRecords: records.syncGuestRecords,
    settingsPopoverRef: themeSettings.settingsPopoverRef,
    showSettingsPopover: themeSettings.showSettingsPopover,
    toggleSettingsPopover: themeSettings.toggleSettingsPopover,
    closeSettingsAndSave: themeSettings.closeSettingsAndSave,
    handleSettingsPopoverBlur: themeSettings.handleSettingsPopoverBlur,
    settingsThemeDraft: themeSettings.settingsThemeDraft,
    updateSettingsTheme: themeSettings.updateSettingsTheme,
    isPreferencesSaving: themeSettings.isPreferencesSaving,
    isAuthPending: auth.isAuthPending,
    logout: auth.logout,
    showAuthPanel: auth.showAuthPanel,
    openAuthPanel: auth.openAuthPanel,
    closeAuthPanel: auth.closeAuthPanel,
    authMode: auth.authMode,
    changeAuthMode: auth.changeAuthMode,
    authName: auth.authName,
    changeAuthName: auth.changeAuthName,
    authPassword: auth.authPassword,
    changeAuthPassword: auth.changeAuthPassword,
    submitAuthForm: auth.submitAuthForm,
    now,
    statusLabel: getStatusLabel(activeSegment),
    elapsedLabel: getElapsedLabel(activeSegment),
    currentElapsedMs,
    todaySummary,
    activeSegment,
    isRecordSaving: records.isRecordSaving,
    startWork: records.startWork,
    startBreak: records.startBreak,
    finishSegment: records.finishSegment,
  };

  return {
    themeStyle,
    contextValue,
  };
}
