import { useEffect, useRef, useState } from "react";
import { CheckIcon, FileDownIcon, Loader2Icon } from "lucide-react";
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
import { toast } from "@uxie/shared/components/ui/sonner";
import { Spinner } from "@uxie/shared/components/ui/spinner";
import type { Settings } from "../ipc-contract";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SettingsDialog({
  open,
  onOpenChange,
  activeDocumentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDocumentId: string | null;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [exporting, setExporting] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setExporting(false);
    setError(null);
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

  async function exportPdf() {
    if (!activeDocumentId || exporting) return;
    setExporting(true);
    try {
      const result = await window.uxieAPI.exportAnnotatedPdf(activeDocumentId);
      if (result.status === "exported") {
        toast.success("Annotated PDF exported", { duration: 3000 });
      }
    } catch (e) {
      toast.error("Unable to export annotated PDF", {
        description: message(e),
        duration: 5000,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage document export and language model settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col items-start gap-2">
            <div>
              <h3 className="text-sm font-medium">Document</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeDocumentId
                  ? "Exports highlights from the open document. Notes are not included yet."
                  : "Open a document to export its highlights."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void exportPdf()}
              disabled={!activeDocumentId || exporting}
            >
              {exporting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <FileDownIcon className="h-4 w-4" />
              )}
              {exporting ? "Exporting…" : "Export annotated PDF"}
            </Button>
          </section>

          <section className="flex flex-col gap-4 border-t pt-4">
            <div>
              <h3 className="text-sm font-medium">Language model</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use an OpenAI-compatible endpoint. For local Ollama, use
                http://localhost:11434/v1.
              </p>
            </div>

            {settings === null ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
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

                <Button
                  onClick={() => void save()}
                  disabled={status === "saving"}
                  className="w-28"
                >
                  {status === "saving" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : status === "saved" ? (
                    <>
                      <CheckIcon className="mr-1.5 h-4 w-4" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </>
            )}
          </section>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
