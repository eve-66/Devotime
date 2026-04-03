"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

import { getAccountSnapshotAction, registerUserAction } from "@/app/actions/time-card";
import type { Feedback, AuthMode } from "@/features/time-card/context/time-card-app-context";
import { normalizeAccountRecords } from "@/features/time-card/lib/time-card-client-helpers";
import type { SessionUser } from "@/lib/types";

type UseTimeCardAuthFlowParams = {
  setSession: Dispatch<SetStateAction<SessionUser | null>>;
  setFeedback: Dispatch<SetStateAction<Feedback | null>>;
  applyAccountTheme: (theme: { outerBackgroundColor: string; innerBackgroundColor: string }) => void;
  setAccountRecords: Dispatch<SetStateAction<ReturnType<typeof normalizeAccountRecords>>>;
  closeSettingsPopover: () => void;
  resetAccountTheme: () => void;
};

export function useTimeCardAuthFlow({
  setSession,
  setFeedback,
  applyAccountTheme,
  setAccountRecords,
  closeSettingsPopover,
  resetAccountTheme,
}: UseTimeCardAuthFlowParams) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  // auth
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

      setSession(snapshot.sessionUser);
      setAccountRecords(normalizeAccountRecords(snapshot.accountRecords));
      applyAccountTheme(snapshot.accountTheme);
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
      closeSettingsPopover();
      setFeedback({
        tone: "info",
        text: "ログアウトしました。ここからの記録はゲスト保存になります。",
      });
    } finally {
      setIsAuthPending(false);
    }
  }

  return {
    authMode,
    authName,
    authPassword,
    isAuthPending,
    showAuthPanel,
    openAuthPanel,
    closeAuthPanel,
    changeAuthMode,
    changeAuthName,
    changeAuthPassword,
    submitAuthForm,
    logout,
  };
}
