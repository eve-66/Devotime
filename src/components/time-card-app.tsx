import { TimeCardAppClient } from "@/components/time-card-app-client";
import { TimeCardAuthDialogInteractive } from "@/components/time-card-auth-dialog-interactive";
import { TimeCardFeedbackBanner } from "@/components/time-card-feedback-banner";
import { TimeCardFocusStageInteractive } from "@/components/time-card-focus-stage-interactive";
import { TimeCardHeaderActions } from "@/components/time-card-header-actions";
import type { ThemePreferences } from "@/lib/theme";
import type { SessionUser, WorkRecord } from "@/lib/types";

export type TimeCardAppProps = {
  initialSession: SessionUser | null;
  initialAccountTheme: ThemePreferences;
  initialAccountRecords: WorkRecord[];
};

export function TimeCardApp({
  initialSession,
  initialAccountTheme,
  initialAccountRecords,
}: TimeCardAppProps) {
  return (
    <TimeCardAppClient
      authDialog={
        <TimeCardAuthDialogInteractive
          intro={
            <div>
              <span className="eyebrow">Save Your Logs</span>
              <h2 className="dialog-title" id="auth-dialog-title">
                アカウント保存
              </h2>
              <p className="dialog-copy">
                ログインすると、このブラウザを閉じても打刻履歴を残せます。
              </p>
            </div>
          }
        />
      }
      feedbackBanner={<TimeCardFeedbackBanner />}
      focusStage={
        <section className="focus-stage">
          <TimeCardFocusStageInteractive />
        </section>
      }
      header={
        <header className="topbar">
          <div className="brand-lockup">
            <span className="eyebrow">Devote your Time</span>
            <h1 className="brand-title brand-title--compact">Devotime</h1>
          </div>

          <div className="topbar-actions">
            <TimeCardHeaderActions />
          </div>
        </header>
      }
      initialAccountRecords={initialAccountRecords}
      initialAccountTheme={initialAccountTheme}
      initialSession={initialSession}
    />
  );
}
