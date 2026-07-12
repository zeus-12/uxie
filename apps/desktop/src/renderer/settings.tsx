import { useEffect, useState } from "react";
import type { Settings } from "../ipc-contract";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.uxieAPI
      .getSettings()
      .then(setSettings)
      .catch((e) => setError(message(e)));
  }, []);

  function patchLlm(patch: Partial<Settings["llm"]>) {
    setSaved(false);
    setSettings((s) => (s ? { ...s, llm: { ...s.llm, ...patch } } : s));
  }

  async function save() {
    if (!settings) return;
    try {
      await window.uxieAPI.setSettings(settings);
      setSaved(true);
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center gap-4 px-8 py-6">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Library
        </button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="max-w-lg px-8">
        <h2 className="mb-1 text-sm font-medium">Language model</h2>
        <p className="mb-4 text-xs text-zinc-500">
          An OpenAI-compatible endpoint. For a local Ollama, use
          http://localhost:11434/v1.
        </p>

        {settings === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field
              label="Base URL"
              value={settings.llm.baseUrl}
              placeholder="http://localhost:11434/v1"
              onChange={(v) => patchLlm({ baseUrl: v })}
            />
            <Field
              label="Model"
              value={settings.llm.model}
              placeholder="llama3.1"
              onChange={(v) => patchLlm({ model: v })}
            />
            <Field
              label="API key (optional)"
              type="password"
              value={settings.llm.apiKey}
              placeholder="—"
              onChange={(v) => patchLlm({ apiKey: v })}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                Save
              </button>
              {saved && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                  Saved
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
