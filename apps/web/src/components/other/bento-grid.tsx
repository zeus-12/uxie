import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  BrainCircuit,
  Bug,
  Check,
  Info,
  Mic,
  PenLine,
  ScanText,
  Sparkles,
  ThumbsUp,
  Users,
} from "lucide-react";
import { type FC, type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { getOrpIndex } from "../pdf-reader/rsvp-reader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_WORDS = ["The", "quick", "brown", "fox", "jumps", "over"];
const BOUNCE_DELAYS = [0, 150, 300];
const OCR_LINE_WIDTHS = ["80%", "60%", "70%"];
const FLASHCARD_DURATIONS = [2000, 1500, 3000, 1500];

const FEEDBACK_ITEMS = [
  {
    icon: ThumbsUp,
    text: "Identified the process",
    bg: "bg-[#f0fff4]",
    textColor: "text-green-700",
    iconColor: "text-green-500",
  },
  {
    icon: Bug,
    text: "Missing: yields 36-38 ATP",
    bg: "bg-[#fef2f2]",
    textColor: "text-red-700",
    iconColor: "text-red-500",
  },
  {
    icon: Info,
    text: "Also produces CO₂ and H₂O",
    bg: "bg-[#ebf4ff]",
    textColor: "text-blue-700",
    iconColor: "text-blue-500",
  },
];

const COLLAB_USERS = [
  { bg: "bg-rose-400", letter: "V" },
  { bg: "bg-blue-400", letter: "A" },
  { bg: "bg-emerald-400", letter: "K" },
];

const READING_MODES = [
  { key: "rsvp", label: "RSVP" },
  { key: "bionic", label: "Bionic" },
  { key: "readalong", label: "Read-along" },
] as const;

type ReadingMode = (typeof READING_MODES)[number]["key"];

const READING_DEMOS: Record<ReadingMode, FC> = {
  rsvp: RSVPDemo,
  bionic: BionicDemo,
  readalong: ReadAlongDemo,
};

const LISTEN_MODES = [
  { key: "tts", label: "Text-to-Speech" },
  { key: "ocr", label: "OCR" },
] as const;

type ListenMode = (typeof LISTEN_MODES)[number]["key"];

const LISTEN_DEMOS: Record<ListenMode, FC> = {
  tts: TTSDemo,
  ocr: OCRDemo,
};

const CARDS: {
  className: string;
  Visual: FC;
  title: string;
  description: string;
}[] = [
  {
    className: "md:col-span-2 md:row-span-2",
    Visual: AIChatVisual,
    title: "Ask Your PDFs Anything",
    description:
      "Chat with your documents and get answers with highlighted sources",
  },
  {
    className: "md:col-span-2",
    Visual: SmartEditorVisual,
    title: "AI-Powered Notes",
    description:
      "Notion-like editor with AI completions, enhancements, and markdown export",
  },
  {
    className: "md:col-span-2 md:row-span-2",
    Visual: FlashcardsVisual,
    title: "Test Your Knowledge",
    description:
      "AI generates questions, you answer, and get graded feedback on what you know",
  },
  {
    className: "md:col-span-2",
    Visual: ReadingModesVisual,
    title: "Read Your Way",
    description: "Three reading modes to help you read faster and retain more",
  },
  {
    className: "md:col-span-3",
    Visual: TTSVisual,
    title: "Listen & Scan",
    description:
      "Text-to-speech with word tracking. OCR to unlock scanned PDFs",
  },
  {
    className: "md:col-span-3",
    Visual: CollabVisual,
    title: "Learn Together",
    description:
      "Real-time synced editor. Share documents and collaborate live",
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useCycleIndex(length: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function BentoGrid() {
  return (
    <section className="mx-auto max-w-6xl py-16 md:py-24">
      <div className="mb-12 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-purple-600">
          Features
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Everything you need to learn smarter
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-500">
          AI-powered tools that transform how you read, take notes, and study
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[220px]">
        {CARDS.map((card, i) => (
          <BentoCard key={card.title} index={i} className={card.className}>
            <card.Visual />
            <CardText title={card.title} description={card.description} />
          </BentoCard>
        ))}
      </div>
    </section>
  );
}

function BentoCard({
  className,
  children,
  index,
}: {
  className?: string;
  children: ReactNode;
  index: number;
}) {
  return (
    <motion.div
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-sm",
        className,
      )}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={index}
      whileHover={{ y: -2 }}
    >
      {children}
    </motion.div>
  );
}

function CardText({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-auto -mx-5 -mb-5 border-t border-gray-100 bg-gray-50/80 px-5 pb-5 pt-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-0.5 text-sm leading-snug text-gray-500">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function ShimmerBar({
  width,
  delay,
  className,
}: {
  width: string;
  delay: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-gray-200",
        className,
      )}
      style={{ width }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, delay, ease: "easeInOut" }}
      />
    </div>
  );
}

function ToggleButtons<T extends string>({
  modes,
  active,
  onChange,
  activeColor,
}: {
  modes: readonly { readonly key: T; readonly label: string }[];
  active: T;
  onChange: (key: T) => void;
  activeColor: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {modes.map((mode) => (
        <button
          key={mode.key}
          onClick={() => onChange(mode.key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            active === mode.key
              ? `${activeColor} text-white`
              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card visuals
// ---------------------------------------------------------------------------

function AIChatVisual() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-[220px] space-y-2.5">
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <div className="rounded-2xl rounded-br-sm bg-purple-100 px-3 py-1.5 text-[11px] font-medium text-purple-800">
            What are the key findings?
          </div>
        </motion.div>

        <motion.div
          className="flex items-start gap-1.5"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-1.5 text-[11px] text-gray-700">
            Based on section 3.2, the study found three significant results...
            <span className="mt-1 block text-[10px] font-medium text-purple-500">
              p.12 &middot; Highlighted
            </span>
          </div>
        </motion.div>

        <motion.div
          className="flex items-center gap-1.5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="flex gap-0.5 rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2">
            {BOUNCE_DELAYS.map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SmartEditorVisual() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-[200px] space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
        <ShimmerBar width="90%" delay={0} className="h-2" />
        <ShimmerBar width="70%" delay={0.3} className="h-2" />
        <div className="flex items-center gap-0.5">
          <ShimmerBar width="40%" delay={0.6} className="h-2" />
          <div className="h-3.5 w-px animate-pulse bg-blue-500" />
          <ShimmerBar width="30%" delay={0.9} className="h-2 bg-blue-100/60" />
        </div>
        <div className="flex items-center gap-1 pt-0.5">
          <PenLine className="h-3 w-3 text-blue-400" />
          <span className="text-[10px] text-blue-400">AI completing...</span>
        </div>
      </div>
    </div>
  );
}

function FlashcardsVisual() {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const advance = () => {
      phaseRef.current = (phaseRef.current + 1) % 4;
      setPhase(phaseRef.current);
      timeoutId = setTimeout(advance, FLASHCARD_DURATIONS[phaseRef.current]!);
    };
    timeoutId = setTimeout(advance, FLASHCARD_DURATIONS[0]!);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="relative h-28 w-44" style={{ perspective: 800 }}>
        <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl border border-amber-100 bg-amber-50/30" />
        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl border border-amber-100 bg-amber-50/50" />
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-white shadow-sm"
          whileHover={{ rotateY: 10, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <BrainCircuit className="mb-1.5 h-6 w-6 text-amber-500" />
          <span className="text-[11px] font-medium text-gray-700">
            What process converts
          </span>
          <span className="text-[11px] font-medium text-gray-700">
            glucose to ATP?
          </span>
        </motion.div>
      </div>

      <div className="h-[90px] w-48">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200"
            >
              <span className="text-[10px] text-gray-400">Your answer...</span>
            </motion.div>
          )}
          {phase === 1 && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full items-center rounded-lg bg-[#F7F5FB] px-3"
            >
              <p className="text-[11px] leading-snug text-purple-800">
                Cellular respiration breaks down glucose to produce energy...
              </p>
            </motion.div>
          )}
          {phase === 2 && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col justify-center gap-1.5"
            >
              {FEEDBACK_ITEMS.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                    item.bg,
                  )}
                >
                  <item.icon
                    className={cn("h-3.5 w-3.5 shrink-0", item.iconColor)}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      item.textColor,
                    )}
                  >
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
          {phase === 3 && (
            <motion.div
              key="pause"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full items-center justify-center"
            >
              <span className="text-[10px] text-gray-400">
                Next question...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reading mode demos
// ---------------------------------------------------------------------------

function BionicDemo() {
  return (
    <p className="text-[11px] leading-relaxed text-gray-700">
      <strong className="font-bold">Th</strong>e{" "}
      <strong className="font-bold">qui</strong>ck{" "}
      <strong className="font-bold">bro</strong>wn{" "}
      <strong className="font-bold">fo</strong>x{" "}
      <strong className="font-bold">jum</strong>ps{" "}
      <strong className="font-bold">ov</strong>er
    </p>
  );
}

function RSVPDemo() {
  const index = useCycleIndex(SAMPLE_WORDS.length, 500);
  const word = SAMPLE_WORDS[index]!;
  const orpIdx = getOrpIndex(word);
  const before = word.slice(0, orpIdx);
  const orpChar = word[orpIdx] ?? "";
  const after = word.slice(orpIdx + 1);

  return (
    <div className="relative flex h-8 w-full items-center">
      <div className="absolute bottom-0 left-1/2 top-0 w-px bg-orange-500/20" />
      <div
        className="absolute whitespace-nowrap font-mono text-lg"
        style={{
          left: "50%",
          transform: `translateX(calc(-${before.length}ch - 0.5ch))`,
        }}
      >
        <span className="text-gray-700">{before}</span>
        <span className="font-bold text-[#ff6500]">{orpChar}</span>
        <span className="text-gray-700">{after}</span>
      </div>
    </div>
  );
}

function ReadAlongDemo() {
  const index = useCycleIndex(SAMPLE_WORDS.length, 600);

  return (
    <div className="flex items-center gap-2">
      <p className="flex-1 text-[11px] leading-relaxed text-gray-700">
        {SAMPLE_WORDS.map((word, i) => (
          <span key={word}>
            <span
              className={cn(
                "rounded px-0.5 transition-colors duration-200",
                i === index && "bg-[#74f273]",
              )}
            >
              {word}
            </span>{" "}
          </span>
        ))}
      </p>
      <div className="relative flex h-5 w-5 items-center justify-center">
        <Mic className="h-3.5 w-3.5 text-gray-500" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500" />
      </div>
    </div>
  );
}

function ReadingModesVisual() {
  const [active, setActive] = useState<ReadingMode>("rsvp");
  const Demo = READING_DEMOS[active];

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-[240px] space-y-2.5">
        <ToggleButtons
          modes={READING_MODES}
          active={active}
          onChange={setActive}
          activeColor="bg-emerald-500"
        />
        <div className="flex h-12 items-center rounded-lg border border-emerald-100 bg-emerald-50/30 px-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <Demo />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listen & Scan demos
// ---------------------------------------------------------------------------

function TTSDemo() {
  const index = useCycleIndex(SAMPLE_WORDS.length, 800);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 items-end gap-1">
        {[16, 28, 20, 32, 14, 26, 18].map((maxH, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full bg-teal-400"
            animate={{
              height: [maxH * 0.4, maxH, maxH * 0.6, maxH * 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              repeatType: "reverse",
              delay: i * 0.1,
              ease: "easeInOut",
            }}
            style={{ height: maxH * 0.5 }}
          />
        ))}
      </div>
      <p className="text-[11px] text-gray-600">
        {SAMPLE_WORDS.map((word, i) => (
          <span key={word}>
            <span
              className={cn(
                "rounded px-0.5 transition-colors duration-200",
                i === index && "bg-teal-200 font-medium text-teal-800",
              )}
            >
              {word}
            </span>{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

function OCRDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const durations = [1000, 1200, 1500];
    const timeout = setTimeout(() => {
      setPhase((p) => (p + 1) % 3);
    }, durations[phase]);
    return () => clearTimeout(timeout);
  }, [phase]);

  const isScanning = phase === 1;
  const isExtracted = phase === 2;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 space-y-1.5 overflow-hidden rounded border border-gray-200 bg-white p-2">
        {OCR_LINE_WIDTHS.map((width) => (
          <div
            key={width}
            className={cn(
              "h-1.5 rounded-full transition-colors duration-500",
              isExtracted ? "bg-gray-600" : "bg-gray-200",
            )}
            style={{ width }}
          />
        ))}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              className="absolute inset-x-0 h-0.5 bg-teal-400"
              initial={{ top: 0 }}
              animate={{ top: "100%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "linear" }}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="flex w-12 shrink-0 flex-col items-center gap-1">
        <div className="relative h-4 w-4">
          <ScanText
            className={cn(
              "absolute inset-0 h-4 w-4 transition-all duration-300",
              isExtracted
                ? "scale-75 opacity-0"
                : isScanning
                ? "animate-pulse text-teal-500"
                : "text-gray-400",
            )}
          />
          <Check
            className={cn(
              "absolute inset-0 h-4 w-4 text-teal-600 transition-all duration-300",
              isExtracted ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
        </div>
        <span
          className={cn(
            "text-[9px] font-medium transition-colors duration-300",
            isExtracted
              ? "text-teal-600"
              : isScanning
              ? "text-teal-500"
              : "text-gray-400",
          )}
        >
          {isExtracted ? "Done!" : isScanning ? "Scanning" : "OCR"}
        </span>
      </div>
    </div>
  );
}

function TTSVisual() {
  const [active, setActive] = useState<ListenMode>("tts");
  const Demo = LISTEN_DEMOS[active];

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-[280px] space-y-2.5">
        <ToggleButtons
          modes={LISTEN_MODES}
          active={active}
          onChange={setActive}
          activeColor="bg-teal-500"
        />
        <div className="flex h-14 items-center rounded-lg border border-teal-100 bg-teal-50/30 px-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <Demo />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

function CollabVisual() {
  const [showThird, setShowThird] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setShowThird((s) => !s), 2000);
    return () => clearInterval(interval);
  }, []);

  const visibleUsers = showThird ? COLLAB_USERS : COLLAB_USERS.slice(0, 2);

  return (
    <div className="flex flex-1 items-center justify-center gap-4">
      <div className="flex -space-x-2">
        <AnimatePresence mode="popLayout">
          {visibleUsers.map((user) => (
            <motion.div
              key={user.letter}
              layout
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white",
                user.bg,
              )}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {user.letter}
              {user.letter === "V" && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full border border-white bg-green-400" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="text-[11px] font-medium text-gray-600">
            {visibleUsers.length} editing now
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-rose-400" />
          <span className="text-[10px] text-gray-500">Editor synced</span>
        </div>
      </div>
    </div>
  );
}
