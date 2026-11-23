import { useReflowCorpus } from "@/lib/demo/corpus";
import { resetDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@uxie/shared/components/ui/button";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function DemoBanner() {
  const router = useRouter();
  const corpus = useReflowCorpus();
  const requested = typeof router.query.doc === "string" ? router.query.doc : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning-subtle px-3 py-1.5 text-center text-xs text-foreground sm:text-sm">
      <span>
        <span className="font-semibold">Explore the demo.</span> Your highlights
        and notes stay on this device.
      </span>
      <div className="flex items-center gap-2">
        {corpus && requested && (
          <select
            aria-label="Test document"
            value={requested}
            onChange={(e) => void router.push({ pathname: "/demo", query: { doc: e.target.value } })}
            className="h-6 rounded-md border border-warning/40 bg-background/70 px-1 text-xs text-foreground"
          >
            {corpus.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={resetDemo}
          className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-background/70 px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-background"
        >
          <RotateCcw size={13} />
          Reset
        </button>
        <Link
          href="/f"
          className={cn(
            buttonVariants({ size: "sm" }),
            "h-6 rounded-md px-3 text-xs",
          )}
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
