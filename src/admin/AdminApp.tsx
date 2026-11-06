"use client";

import { useCallback, useEffect, useState } from "react";
import { call, type Status } from "./api";
import { Screen, Spinner } from "./ui";
import { Login } from "./Login";
import { Setup } from "./Setup";
import { Panel } from "./Panel";

/**
 * /admin decides what to show from /api/admin/setup-status:
 * no admin → setup wizard (from the password step); not logged in → login;
 * setup not finished → the wizard resumes; otherwise the panel.
 */
export function AdminApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(
    () =>
      call<Status>("GET", "setup-status").then(
        (s) => (setStatus(s), setFailed(false)),
        () => setFailed(true),
      ),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!status)
    return (
      <Screen>
        <div className="grid flex-1 place-items-center text-ink-soft">
          {failed ? (
            <button className="pill pill-soft" onClick={refresh}>
              Yenidən yoxla
            </button>
          ) : (
            <Spinner />
          )}
        </div>
      </Screen>
    );

  if (!status.admin) return <Setup fresh completed={status.completed} onDone={refresh} />;
  if (!status.logged_in) return <Login onDone={refresh} />;
  if (!status.completed) return <Setup fresh={false} completed={false} onDone={refresh} />;
  return <Panel version={status.version} onLogout={refresh} />;
}
