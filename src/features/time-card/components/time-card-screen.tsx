import { TimeCardScreenClient } from "@/features/time-card/components/time-card-screen-client";
import type { ThemePreferences } from "@/lib/theme";
import type { SessionUser, WorkRecord } from "@/lib/types";

type TimeCardScreenProps = {
  initialSession: SessionUser | null;
  initialAccountTheme: ThemePreferences;
  initialAccountRecords: WorkRecord[];
};

export function TimeCardScreen({
  initialSession,
  initialAccountTheme,
  initialAccountRecords,
}: TimeCardScreenProps) {
  return (
    <TimeCardScreenClient
      initialAccountRecords={initialAccountRecords}
      initialAccountTheme={initialAccountTheme}
      initialSession={initialSession}
    />
  );
}
