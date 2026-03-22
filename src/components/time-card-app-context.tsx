"use client";

import { createContext, useContext, type FocusEvent, type ReactNode, type RefObject } from "react";

import type { ThemePreferences } from "@/lib/theme";
import type { ActiveSegment, SessionUser } from "@/lib/types";

export type FeedbackTone = "info" | "success" | "error";

export type Feedback = {
  tone: FeedbackTone;
  text: string;
};

export type AuthMode = "login" | "signup";

type TimeCardSummary = {
  workMs: number;
  breakMs: number;
};

export type TimeCardAppContextValue = {
  session: SessionUser | null;
  feedback: Feedback | null;
  guestRecordCount: number;
  isGuestSyncing: boolean;
  syncGuestRecords: () => Promise<void>;
  settingsPopoverRef: RefObject<HTMLDivElement | null>;
  showSettingsPopover: boolean;
  toggleSettingsPopover: () => void;
  closeSettingsAndSave: () => void;
  handleSettingsPopoverBlur: (event: FocusEvent<HTMLElement>) => void;
  settingsThemeDraft: ThemePreferences;
  updateSettingsTheme: (key: keyof ThemePreferences, value: string) => void;
  isPreferencesSaving: boolean;
  isAuthPending: boolean;
  logout: () => Promise<void>;
  showAuthPanel: boolean;
  openAuthPanel: () => void;
  closeAuthPanel: () => void;
  authMode: AuthMode;
  changeAuthMode: (mode: AuthMode) => void;
  authName: string;
  changeAuthName: (value: string) => void;
  authPassword: string;
  changeAuthPassword: (value: string) => void;
  submitAuthForm: () => Promise<void>;
  now: Date;
  statusLabel: string;
  elapsedLabel: string;
  currentElapsedMs: number;
  todaySummary: TimeCardSummary;
  activeSegment: ActiveSegment | null;
  isRecordSaving: boolean;
  startWork: () => void;
  startBreak: () => void;
  finishSegment: () => void;
};

const TimeCardAppContext = createContext<TimeCardAppContextValue | null>(null);

export function TimeCardAppContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: TimeCardAppContextValue;
}) {
  return <TimeCardAppContext.Provider value={value}>{children}</TimeCardAppContext.Provider>;
}

export function useTimeCardApp() {
  const context = useContext(TimeCardAppContext);

  if (!context) {
    throw new Error("useTimeCardApp must be used within TimeCardAppContextProvider.");
  }

  return context;
}
