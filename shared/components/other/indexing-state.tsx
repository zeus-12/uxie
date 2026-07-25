import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ShimmeringText } from "../ui/shimmering-text";

const TITLE = "Getting ready to chat";

/**
 * The wait between "Start chatting" and a usable chat, drawn as a sheet that
 * darkens from the top as the document is read.
 *
 * `value` is the real fraction embedded so far, or null when there is nothing to
 * measure — web's vectorise is a single round trip that reports no progress, and
 * desktop has no total until it has chunked the text. Null renders a scan line
 * and no percentage rather than a bar inching toward a number we invented.
 */
export function IndexingState({ value }: { value: number | null }) {
  const pct = value === null ? null : Math.round(value * 100);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <ReadingSheet value={value} />
      <div>
        {/* A sheen every few seconds, so a slow batch landing doesn't read as a
            frozen panel. It says "still working", never "making progress" — the
            component is only mounted while the work is genuinely in flight. */}
        <p className="font-medium">
          <ShimmeringText
            text={TITLE}
            startOnView={false}
            duration={1.8}
            repeatDelay={3.2}
            color="var(--color-foreground)"
            shimmerColor="var(--color-muted-foreground)"
          />
        </p>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {pct === null ? "This happens once." : `${pct}% · this happens once`}
        </p>
      </div>
    </div>
  );
}

export function IndexingFailed({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertCircleIcon className="h-7 w-7 text-destructive" />
      <div>
        <p className="font-medium">Couldn&rsquo;t finish reading it</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-destructive">
          {message}
        </p>
      </div>
      <Button onClick={onRetry} className="rounded-full">
        Try again
      </Button>
    </div>
  );
}

const SHEET_OUTLINE = "M9 4h16l12 12v34a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z";
const SHEET_FOLD = "M25 4v12h12";
const SHEET_LINES = "M12 26h18M12 34h18M12 42h11";

// Strokes ride on currentColor so the same markup works under both apps'
// Tailwind versions without relying on stroke-* utilities existing in either.
function Sheet({ className }: { className: string }) {
  return (
    <g className={className} fill="none" stroke="currentColor" strokeLinecap="round">
      <path d={SHEET_OUTLINE} strokeWidth={2} />
      <path d={SHEET_FOLD} strokeWidth={2} />
      <path d={SHEET_LINES} strokeWidth={2.5} />
    </g>
  );
}

function ReadingSheet({ value }: { value: number | null }) {
  // useId yields ":r1:" — the colons are legal in an id but hostile inside a
  // url(#…) reference, so strip them.
  const clipId = `read-${useId().replace(/:/g, "")}`;
  const reduced = useReducedMotion();

  return (
    <svg viewBox="0 0 46 58" className="h-[58px] w-[46px]" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          {/* Scaled from the top edge, so the read portion grows downward. */}
          <rect
            width="46"
            height="58"
            style={{
              transform: `scaleY(${value ?? 0})`,
              transformOrigin: "top",
              transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </clipPath>
      </defs>

      <Sheet className="text-border" />

      {value === null ? (
        <motion.line
          x1="12"
          x2="34"
          y1="0"
          y2="0"
          className="text-primary"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ y: 29, opacity: reduced ? 0.5 : 0 }}
          animate={reduced ? {} : { y: [8, 50], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.9,
            repeat: Infinity,
            ease: "easeInOut",
            opacity: {
              duration: 1.9,
              repeat: Infinity,
              times: [0, 0.15, 0.85, 1],
            },
          }}
        />
      ) : (
        <g clipPath={`url(#${clipId})`} className="text-primary">
          {/* The wash follows the sheet's silhouette, fold corner included — a
              plain rect squares off the cut corner and reads as a stray block. */}
          <path d={SHEET_OUTLINE} fill="currentColor" opacity={0.07} />
          <Sheet className="text-primary" />
        </g>
      )}
    </svg>
  );
}
