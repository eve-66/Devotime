"use client";

import { useTimeCardApp } from "@/features/time-card/context/time-card-app-context";

export function TimeCardHeaderActions() {
  const {
    session,
    guestRecordCount,
    isGuestSyncing,
    syncGuestRecords,
    settingsPopoverRef,
    showSettingsPopover,
    toggleSettingsPopover,
    closeSettingsAndSave,
    handleSettingsPopoverBlur,
    settingsThemeDraft,
    updateSettingsTheme,
    isPreferencesSaving,
    isAuthPending,
    logout,
    openAuthPanel,
  } = useTimeCardApp();

  return (
    <>
      <div className="status-chip" data-mode={session ? "account" : "guest"}>
        {session ? "アカウント保存中" : "ゲストモード"}
      </div>

      {session ? (
        <>
          {guestRecordCount > 0 ? (
            <button
              className="plain-button"
              disabled={isGuestSyncing}
              type="button"
              onClick={() => {
                void syncGuestRecords();
              }}
            >
              {isGuestSyncing ? "同期中..." : "ゲスト記録を同期"}
            </button>
          ) : null}

          <div className="settings-anchor" ref={settingsPopoverRef}>
            <button
              aria-expanded={showSettingsPopover}
              aria-haspopup="dialog"
              className="plain-button plain-button--user"
              data-open={showSettingsPopover}
              type="button"
              onClick={toggleSettingsPopover}
            >
              {session.username}
            </button>

            {showSettingsPopover ? (
              <section
                aria-label="ユーザ設定"
                className="settings-popover"
                role="dialog"
                onBlur={handleSettingsPopoverBlur}
              >
                <div className="settings-popover-head">
                  <div>
                    <span className="eyebrow">User Settings</span>
                    <h2 className="settings-title">背景カラー設定</h2>
                  </div>

                  <button
                    aria-label="ユーザ設定を閉じる"
                    className="plain-button plain-button--icon"
                    type="button"
                    onClick={closeSettingsAndSave}
                  >
                    閉じる
                  </button>
                </div>

                {isPreferencesSaving ? <p className="settings-status">保存中...</p> : null}

                <div className="settings-form">
                  <label className="color-field">
                    <span className="color-field-head">
                      <span>外側カラー</span>
                      <span className="color-value">{settingsThemeDraft.outerBackgroundColor}</span>
                    </span>
                    <div className="color-input-row">
                      <input
                        aria-label="カード外側の背景カラー"
                        className="color-picker"
                        type="color"
                        value={settingsThemeDraft.outerBackgroundColor}
                        onChange={(event) =>
                          updateSettingsTheme("outerBackgroundColor", event.target.value)
                        }
                      />
                      <span className="field-note">
                        カードの外側と全体のアクセントに反映されます。
                      </span>
                    </div>
                  </label>

                  <label className="color-field">
                    <span className="color-field-head">
                      <span>内側カラー</span>
                      <span className="color-value">{settingsThemeDraft.innerBackgroundColor}</span>
                    </span>
                    <div className="color-input-row">
                      <input
                        aria-label="カード内側の背景カラー"
                        className="color-picker"
                        type="color"
                        value={settingsThemeDraft.innerBackgroundColor}
                        onChange={(event) =>
                          updateSettingsTheme("innerBackgroundColor", event.target.value)
                        }
                      />
                      <span className="field-note">
                        メインカードの内側のトーンに反映されます。
                      </span>
                    </div>
                  </label>
                </div>
              </section>
            ) : null}
          </div>

          <button
            className="plain-button"
            disabled={isAuthPending}
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            ログアウト
          </button>
        </>
      ) : (
        <button className="plain-button" type="button" onClick={openAuthPanel}>
          ログイン / 新規登録
        </button>
      )}
    </>
  );
}
