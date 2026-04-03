import { getServerSession } from "next-auth";

import { TimeCardScreen } from "@/features/time-card/components/time-card-screen";
import { authOptions } from "@/lib/auth";
import { getAccountSnapshotForUser, toSessionUser } from "@/lib/time-card-data";
import { getDefaultThemePreferences } from "@/lib/theme";
import type { WorkRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const initialSession = toSessionUser(session);
  let initialAccountTheme = getDefaultThemePreferences();
  let initialAccountRecords: WorkRecord[] = [];

  if (initialSession) {
    const snapshot = await getAccountSnapshotForUser(initialSession);
    initialAccountRecords = snapshot.accountRecords;
    initialAccountTheme = snapshot.accountTheme;
  }

  return (
    <TimeCardScreen
      initialAccountRecords={initialAccountRecords}
      initialAccountTheme={initialAccountTheme}
      initialSession={initialSession}
    />
  );
}
