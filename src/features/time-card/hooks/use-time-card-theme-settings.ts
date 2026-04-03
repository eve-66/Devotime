"use client";

import type { Dispatch, FocusEvent, RefObject, SetStateAction } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { saveThemePreferencesAction } from "@/app/actions/time-card";
import type { Feedback } from "@/features/time-card/context/time-card-app-context";
import {
  getDefaultThemePreferences,
  isHexColor,
  normalizeThemePreferences,
  type ThemePreferences,
} from "@/lib/theme";
import type { SessionUser } from "@/lib/types";

type UseTimeCardThemeSettingsParams = {
  initialAccountTheme: ThemePreferences;
  session: SessionUser | null;
  setFeedback: Dispatch<SetStateAction<Feedback | null>>;
};

type UseTimeCardThemeSettingsResult = {
  accountTheme: ThemePreferences;
  settingsThemeDraft: ThemePreferences;
  showSettingsPopover: boolean;
  settingsPopoverRef: RefObject<HTMLDivElement | null>;
  isPreferencesSaving: boolean;
  toggleSettingsPopover: () => void;
  closeSettingsPopover: () => void;
  closeSettingsAndSave: () => void;
  handleSettingsPopoverBlur: (event: FocusEvent<HTMLElement>) => void;
  updateSettingsTheme: (key: keyof ThemePreferences, value: string) => void;
  applyAccountTheme: (theme: ThemePreferences) => void;
  resetAccountTheme: () => void;
};

export function useTimeCardThemeSettings({
  initialAccountTheme,
  session,
  setFeedback,
}: UseTimeCardThemeSettingsParams): UseTimeCardThemeSettingsResult {
  const normalizedInitialAccountTheme = normalizeThemePreferences(initialAccountTheme);
  const [accountTheme, setAccountTheme] = useState<ThemePreferences>(() => normalizedInitialAccountTheme);
  const [settingsThemeDraft, setSettingsThemeDraft] = useState<ThemePreferences>(
    () => normalizedInitialAccountTheme,
  );
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const accountThemeRef = useRef<ThemePreferences>(normalizedInitialAccountTheme);
  const settingsThemeDraftRef = useRef<ThemePreferences>(normalizedInitialAccountTheme);
  const isPreferencesSavingRef = useRef(false);

  useEffect(() => {
    accountThemeRef.current = accountTheme;
  }, [accountTheme]);

  useEffect(() => {
    settingsThemeDraftRef.current = settingsThemeDraft;
  }, [settingsThemeDraft]);

  useEffect(() => {
    isPreferencesSavingRef.current = isPreferencesSaving;
  }, [isPreferencesSaving]);

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
      const nextTheme = await saveThemePreferencesAction(normalizedTheme);
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

  function toggleSettingsPopover() {
    if (showSettingsPopover) {
      setShowSettingsPopover(false);
      return;
    }

    setSettingsThemeDraft(accountThemeRef.current);
    setShowSettingsPopover(true);
  }

  function closeSettingsPopover() {
    setShowSettingsPopover(false);
  }

  function closeSettingsAndSave() {
    void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
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

  function handleSettingsPopoverBlur(event: FocusEvent<HTMLElement>) {
    const nextFocused = event.relatedTarget;

    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return;
    }

    void saveSettingsThemeDraft(settingsThemeDraftRef.current, true);
  }

  function applyAccountTheme(theme: ThemePreferences) {
    const normalizedTheme = normalizeThemePreferences(theme);
    setAccountTheme(normalizedTheme);
    setSettingsThemeDraft(normalizedTheme);
  }

  function resetAccountTheme() {
    const defaultTheme = getDefaultThemePreferences();
    setAccountTheme(defaultTheme);
    setSettingsThemeDraft(defaultTheme);
  }

  return {
    accountTheme,
    settingsThemeDraft,
    showSettingsPopover,
    settingsPopoverRef,
    isPreferencesSaving,
    toggleSettingsPopover,
    closeSettingsPopover,
    closeSettingsAndSave,
    handleSettingsPopoverBlur,
    updateSettingsTheme,
    applyAccountTheme,
    resetAccountTheme,
  };
}
