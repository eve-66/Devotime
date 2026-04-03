"use client";

import { useTimeCardApp } from "@/features/time-card/context/time-card-app-context";

export function TimeCardAuthDialog() {
  const {
    showAuthPanel,
    closeAuthPanel,
    authMode,
    changeAuthMode,
    authName,
    changeAuthName,
    authPassword,
    changeAuthPassword,
    isAuthPending,
    submitAuthForm,
    guestRecordCount,
  } = useTimeCardApp();

  if (!showAuthPanel) {
    return null;
  }

  return (
    <div aria-hidden="true" className="auth-overlay" onClick={closeAuthPanel}>
      <section
        aria-labelledby="auth-dialog-title"
        aria-modal="true"
        className="auth-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-dialog-head">
          <div>
            <span className="eyebrow">Save Your Logs</span>
            <h2 className="dialog-title" id="auth-dialog-title">
              アカウント保存
            </h2>
            <p className="dialog-copy">
              ログインすると、このブラウザを閉じても打刻履歴を残せます。
            </p>
          </div>

          <button
            aria-label="ログインパネルを閉じる"
            className="plain-button plain-button--icon"
            type="button"
            onClick={closeAuthPanel}
          >
            閉じる
          </button>
        </div>

        <div className="auth-toggle">
          <button
            className="auth-tab"
            data-active={authMode === "login"}
            type="button"
            onClick={() => changeAuthMode("login")}
          >
            ログイン
          </button>
          <button
            className="auth-tab"
            data-active={authMode === "signup"}
            type="button"
            onClick={() => changeAuthMode("signup")}
          >
            新規登録
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAuthForm();
          }}
        >
          <label className="field-label">
            ユーザー名
            <input
              className="text-input"
              placeholder="例: nakai-lab"
              required
              value={authName}
              onChange={(event) => changeAuthName(event.target.value)}
            />
          </label>

          <label className="field-label">
            パスワード
            <input
              className="text-input"
              minLength={4}
              placeholder="4文字以上"
              required
              type="password"
              value={authPassword}
              onChange={(event) => changeAuthPassword(event.target.value)}
            />
          </label>

          <button className="secondary-button" disabled={isAuthPending} type="submit">
            {isAuthPending
              ? "処理中..."
              : authMode === "signup"
                ? "アカウントを作成"
                : "ログインする"}
          </button>
        </form>

        {guestRecordCount > 0 ? (
          <p className="small-note">
            ログイン後に「ゲスト記録を同期」を押すと、この端末の記録もアカウントへ移せます。
          </p>
        ) : null}
      </section>
    </div>
  );
}
