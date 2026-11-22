import { useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
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
import { Spinner } from "@uxie/shared/components/ui/spinner";
import { ThemePicker } from "@uxie/shared/components/theme/theme-controls";
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
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    window.uxieAPI
      .getSettings()
      .then(setSettings)
      .catch((e) => setError(message(e)));
  }, [open]);

  function patchLlm(patch: Partial<Settings["llm"]>) {
    setStatus("idle");
    setSettings((s) => (s ? { ...s, llm: { ...s.llm, ...patch } } : s));
  }

  async function save() {
    if (!settings || status === "saving") return;
    setStatus("saving");
    try {
      await window.uxieAPI.setSettings(settings);
      setError(null);
      setStatus("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setError(message(e));
      setStatus("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85vh,760px)] grid-rows-[auto_minmax(0,1fr)] gap-0 p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Appearance and language model settings
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8 overflow-y-auto px-6 py-6">
          <section
            aria-labelledby="settings-appearance"
            className="flex flex-col gap-4"
          >
            <h3 id="settings-appearance" className="text-base font-semibold">
              Appearance
            </h3>
            <ThemePicker />
          </section>

          <section
            aria-labelledby="settings-ai"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h3 id="settings-ai" className="text-base font-semibold">
                AI
              </h3>
              <p className="text-sm text-muted-foreground">
                OpenAI-compatible endpoints only.
              </p>
            </div>

            {settings === null ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={settings.llm.baseUrl}
                    placeholder="http://localhost:11434/v1"
                    onChange={(e) => patchLlm({ baseUrl: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={settings.llm.model}
                    placeholder="llama3.1"
                    onChange={(e) => patchLlm({ model: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="apiKey">API key (optional)</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={settings.llm.apiKey}
                    onChange={(e) => patchLlm({ apiKey: e.target.value })}
                  />
                </div>

                <Button
                  onClick={save}
                  disabled={status === "saving"}
                  className="w-28"
                >
                  {status === "saving" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : status === "saved" ? (
                    <>
                      <CheckIcon className="mr-1.5 size-4" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
