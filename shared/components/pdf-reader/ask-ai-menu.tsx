import { useState } from "react";
import {
  BookOpenCheck,
  Lightbulb,
  List,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";

export type SelectionTemplate = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  buildPrompt: (selection: string) => string;
};

const quoted = (selection: string) => `\n'${selection}'`;

// Add a template here and it shows up in the menu, on both web and desktop.
export const SELECTION_TEMPLATES: SelectionTemplate[] = [
  {
    id: "explain",
    label: "Explain simply",
    description: "Plain-language walkthrough",
    icon: Lightbulb,
    buildPrompt: (s) =>
      `**Explain the following text in simple terms**: ${quoted(s)}`,
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "The key points, briefly",
    icon: BookOpenCheck,
    buildPrompt: (s) =>
      `**Summarise the following text in simple terms**: ${quoted(s)}`,
  },
  {
    id: "define",
    label: "Define the terms",
    description: "Unpack the jargon",
    icon: Type,
    buildPrompt: (s) =>
      `**Define the key terms in the following text**: ${quoted(s)}`,
  },
  {
    id: "takeaways",
    label: "Key takeaways",
    description: "What to remember",
    icon: List,
    buildPrompt: (s) =>
      `**List the key takeaways from the following text**: ${quoted(s)}`,
  },
];

export const buildCustomPrompt = (question: string, selection: string) =>
  `${question.trim()}${quoted(selection)}`;

export const AskAiMenu = ({
  selection,
  onSubmit,
  onClose,
}: {
  selection: string;
  onSubmit: (prompt: string) => void;
  onClose?: () => void;
}) => {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  return (
    <Command
      // We manage the rows ourselves: the free-form question always leads, the
      // templates always follow. cmdk's substring filter would hide them.
      shouldFilter={false}
      className="w-[280px] rounded-lg border shadow-md"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
        }
      }}
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Ask about the selection…"
        className="h-8 py-0 text-sm"
        rootClassName="px-2.5 py-0"
        leftIcon={
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
        }
      />
      <CommandList className="p-1">
        {trimmed && (
          <CommandItem
            value="__ask__"
            onSelect={() => onSubmit(buildCustomPrompt(trimmed, selection))}
            className="gap-2 py-1.5"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* On the custom row the "title" is the user's own text, so it may truncate. */}
            <span className="min-w-0 flex-1 truncate text-violet-500 dark:text-violet-400">
              {trimmed}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">Ask AI</span>
          </CommandItem>
        )}
        {SELECTION_TEMPLATES.map((t) => (
          <CommandItem
            key={t.id}
            value={t.id}
            onSelect={() => onSubmit(t.buildPrompt(selection))}
            className="gap-2 py-1.5"
          >
            <t.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* Title never truncates; the description yields space and truncates instead. */}
            <span className="shrink-0 whitespace-nowrap">{t.label}</span>
            <span className="min-w-0 flex-1 truncate pl-2 text-right text-xs text-muted-foreground">
              {t.description}
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
};
