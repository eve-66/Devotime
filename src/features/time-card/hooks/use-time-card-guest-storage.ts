"use client";

import { useEffect, useState } from "react";

import { getDefaultThemePreferences } from "@/lib/theme";
import type { ActiveSegment, WorkRecord } from "@/lib/types";

import { LOCAL_STATE_KEY, parsePersistedState } from "@/features/time-card/lib/time-card-client-helpers";

export function useTimeCardGuestStorage() {
  const [guestRecords, setGuestRecords] = useState<WorkRecord[]>([]);
  const [activeSegment, setActiveSegment] = useState<ActiveSegment | null>(null);
  const [guestTheme, setGuestTheme] = useState(() => getDefaultThemePreferences());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persistedState = parsePersistedState(window.localStorage.getItem(LOCAL_STATE_KEY));

    // localStorage is only available after mount, so guest state is hydrated here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return {
    guestRecords,
    setGuestRecords,
    activeSegment,
    setActiveSegment,
  };
}
