"use client";

import { TimeCardAppContextProvider } from "@/features/time-card/context/time-card-app-context";
import { TimeCardAuthDialog } from "@/features/time-card/components/time-card-auth-dialog";
import { TimeCardFeedbackBanner } from "@/features/time-card/components/time-card-feedback-banner";
import { TimeCardFocusStage } from "@/features/time-card/components/time-card-focus-stage";
import { TimeCardHeaderActions } from "@/features/time-card/components/time-card-header-actions";
import { useTimeCardController } from "@/features/time-card/hooks/use-time-card-controller";
import type { ThemePreferences } from "@/lib/theme";
import type { SessionUser, WorkRecord } from "@/lib/types";

type TimeCardScreenClientProps = {
  initialSession: SessionUser | null;
  initialAccountTheme: ThemePreferences;
  initialAccountRecords: WorkRecord[];
};

export function TimeCardScreenClient({
  initialSession,
  initialAccountTheme,
  initialAccountRecords,
}: TimeCardScreenClientProps) {
  const { themeStyle, contextValue } = useTimeCardController({
    initialSession,
    initialAccountTheme,
    initialAccountRecords,
  });

  return (
    <TimeCardAppContextProvider value={contextValue}>
      <main className="app-shell" style={themeStyle}>
        <div aria-hidden="true" className="app-background" />
        <TimeCardFeedbackBanner />

        <header className="topbar">
          <div className="brand-lockup">
            <span className="eyebrow">Devote your Time</span>
            <h1 className="brand-title brand-title--compact">Devotime</h1>
          </div>

          <div className="topbar-actions">
            <TimeCardHeaderActions />
          </div>
        </header>

        <section className="focus-stage">
          <TimeCardFocusStage />
        </section>

        <TimeCardAuthDialog />
      </main>
    </TimeCardAppContextProvider>
  );
}
