import { buttonVariants } from "@/components/ui/button";
import { resetDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

/**
 * Slim, friendly banner across the top of the demo. Says once (and only once)
 * that the demo is local to this device.
 */
export default function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900 sm:text-sm">
      <span>
        <span className="font-semibold">You&apos;re exploring the demo</span> —
        play around all you like! Your highlights and notes stay right here on
        your device.
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={resetDemo}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/70 px-2 py-0.5 font-medium text-amber-900 transition-colors hover:bg-white"
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
