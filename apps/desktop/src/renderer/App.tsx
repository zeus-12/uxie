import { useEffect, useState } from "react";
import type { AppInfo } from "../ipc-contract";

// The bridge status is driven by the ACTUAL IPC round-trip, never assumed:
//   "checking" until app:info resolves, "error" if it rejects, "ok" only once
//   real data comes back. We never render a connected/version state we haven't
//   verified over the wire.
type BridgeState =
  | { status: "checking" }
  | { status: "ok"; info: AppInfo }
  | { status: "error"; message: string };

export default function App() {
  const [bridge, setBridge] = useState<BridgeState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    window.uxieAPI
      .getAppInfo()
      .then((info) => {
        if (!cancelled) setBridge({ status: "ok", info });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBridge({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Uxie</h1>
        <p className="text-sm text-zinc-500">Desktop — local-first</p>
      </div>

      <BridgeStatus bridge={bridge} />
    </div>
  );
}

function BridgeStatus({ bridge }: { bridge: BridgeState }) {
  if (bridge.status === "checking") {
    return <p className="text-sm text-zinc-500">Connecting to main process…</p>;
  }

  if (bridge.status === "error") {
    return (
      <p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
        IPC bridge error: {bridge.message}
      </p>
    );
  }

  const { info } = bridge;
  return (
    <div className="flex flex-col items-center gap-1 text-sm text-zinc-500">
      <span className="text-emerald-600 dark:text-emerald-400">
        ● IPC bridge connected
      </span>
      <span>
        v{info.appVersion} · Electron {info.electronVersion} · {info.platform}
      </span>
    </div>
  );
}
