import { useEffect, useState } from "react";
import { Button } from "@uxie/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@uxie/shared/components/ui/dialog";
import { Input } from "@uxie/shared/components/ui/input";
import { Label } from "@uxie/shared/components/ui/label";
import type { Settings } from "../ipc-contract";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    window.uxieAPI
      .getSettings()
      .then(setSettings)
      .catch((e) => setError(message(e)));
  }, [open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Language model — an OpenAI-compatible endpoint. For a local Ollama,
            use http://localhost:11434/v1.
          </DialogDescription>
        </DialogHeader>

        {settings === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                value={settings.llm.baseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={(e) => patchLlm({ baseUrl: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={settings.llm.model}
                placeholder="llama3.1"
                onChange={(e) => patchLlm({ model: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey">API key (optional)</Label>
              <Input
                id="apiKey"
                type="password"
                value={settings.llm.apiKey}
                onChange={(e) => patchLlm({ apiKey: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save}>Save</Button>
              {saved && (
                <span className="text-sm text-emerald-600">Saved</span>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
