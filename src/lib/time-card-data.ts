import "server-only";

import { prisma } from "@/lib/prisma";
import { listRecordsForUser } from "@/lib/record-store";
import { getDefaultThemePreferences, normalizeThemePreferences } from "@/lib/theme";
import type { AccountSnapshot, SessionUser } from "@/lib/types";

type AuthSessionLike = {
  user?: {
    id?: string;
    name?: string | null;
    username?: string | null;
  } | null;
} | null;

export function toSessionUser(session: AuthSessionLike): SessionUser | null {
  if (!session?.user?.id) {
    return null;
  }

  const username = session.user.username ?? session.user.name ?? "User";

  return {
    id: session.user.id,
    name: session.user.name ?? username,
    username,
  };
}

export async function getAccountThemeForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      outerBackgroundColor: true,
      innerBackgroundColor: true,
    },
  });

  if (!user) {
    return getDefaultThemePreferences();
  }

  return normalizeThemePreferences(user);
}

export async function getAccountSnapshotForUser(sessionUser: SessionUser): Promise<AccountSnapshot> {
  const [accountRecords, accountTheme] = await Promise.all([
    listRecordsForUser(sessionUser.id),
    getAccountThemeForUser(sessionUser.id),
  ]);

  return {
    sessionUser,
    accountRecords,
    accountTheme,
  };
}
