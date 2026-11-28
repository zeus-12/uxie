import { CustomTooltip } from "../ui/tooltip";
import { copyTextToClipboard } from "../../lib/utils";
import { AskAiMenu } from "./ask-ai-menu";
import {
  AudioLines,
  ChevronDown,
  ChevronLeft,
  ClipboardCopy,
  Highlighter,
  MessageSquarePlus,
  Sparkles,
  TrashIcon,
  type LucideIcon,
} from "lucide-react";
import { usePdfSettingsStore, useSidebarTabStore } from "../../lib/store";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_LABELS,
  type HighlightColor,
} from "../../lib/highlight-colors";
import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

export type AskAi = (prompt: string) => void;

export type SelectionAction = {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
};

type Click = MouseEvent<HTMLButtonElement>;

const keepSelection = (e: MouseEvent) => e.preventDefault();

const BarButton = ({
  label,
  icon: Icon,
  onClick,
  tone,
}: {
  label: string;
  icon: LucideIcon;
  onClick: (e: Click) => void;
  tone?: "accent" | "danger";
}) => (
  <CustomTooltip content={label} asChild>
    <button
      type="button"
      aria-label={label}
      className="uxie-popover-btn"
      data-tone={tone}
      onClick={onClick}
    >
      <Icon aria-hidden className="uxie-popover-icon" />
    </button>
  </CustomTooltip>
);

const Separator = () => <span className="uxie-popover-sep" aria-hidden />;

const ColourPicker = ({
  current,
  onBack,
  onPick,
}: {
  current: HighlightColor;
  onBack: (e: Click) => void;
  onPick: (color: HighlightColor, e: Click) => void;
}) => (
  <>
    <BarButton label="Back" icon={ChevronLeft} onClick={onBack} />
    {HIGHLIGHT_COLORS.map((color) => (
      <CustomTooltip key={color} content={HIGHLIGHT_COLOR_LABELS[color]} asChild>
        <button
          type="button"
          className="uxie-popover-dot"
          data-swatch={color}
          data-picker-current={color === current || undefined}
          aria-label={`Highlight ${HIGHLIGHT_COLOR_LABELS[color]}`}
          aria-pressed={color === current}
          onClick={(e) => onPick(color, e)}
        />
      </CustomTooltip>
    ))}
  </>
);

const usePicker = () => {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const viaKeyboard = useRef(false);

  useLayoutEffect(() => {
    if (!viaKeyboard.current) return;
    viaKeyboard.current = false;
    panel.current
      ?.querySelector<HTMLElement>(open ? "[data-picker-current]" : "[data-picker-toggle]")
      ?.focus();
  }, [open]);

  const toggle = (next: boolean, e: Click) => {
    viaKeyboard.current = e.detail === 0;
    setOpen(next);
  };
  return { open, panel, toggle };
};

const PopoverBar = ({
  picker,
  panelRef,
  actions,
  colours,
  label,
}: {
  picker: boolean;
  panelRef: RefObject<HTMLDivElement>;
  actions: ReactNode;
  colours: ReactNode;
  label: string;
}) => {
  const swap = useRef<HTMLDivElement>(null);
  const actionsRow = useRef<HTMLDivElement>(null);
  const coloursRow = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const active = picker ? coloursRow.current : actionsRow.current;
    const idle = picker ? actionsRow.current : coloursRow.current;
    if (!swap.current || !active || !idle) return;
    active.removeAttribute("inert");
    idle.setAttribute("inert", "");
    swap.current.style.width = `${active.offsetWidth}px`;
  });

  return (
    <div
      ref={panelRef}
      className="uxie-popover-panel"
      role="toolbar"
      aria-label={label}
      onMouseDown={keepSelection}
    >
      <div ref={swap} className="uxie-popover-swap">
        <div ref={actionsRow} className="uxie-popover-row">
          {actions}
        </div>
        <div ref={coloursRow} className="uxie-popover-row">
          {colours}
        </div>
      </div>
    </div>
  );
};

export const TextSelectionPopover = ({
  text,
  image,
  onHighlight,
  onRead,
  onAskAi,
  onAskAiStart,
  onAttach,
  extraActions = [],
  close,
}: {
  text?: string;
  image?: string;
  onHighlight?: (color: HighlightColor) => void;
  onRead?: () => void;
  onAskAi?: AskAi;
  // Lets the reader keep the selection visible once the AI input steals focus and
  // collapses the native selection.
  onAskAiStart?: () => void;
  onAttach?: () => void;
  extraActions?: SelectionAction[];
  close: () => void;
}) => {
  const setSidebarTab = useSidebarTabStore((s) => s.setTab);
  const lastColor = usePdfSettingsStore((s) => s.highlightColor);
  const setLastColor = usePdfSettingsStore((s) => s.setHighlightColor);
  const [askingAi, setAskingAi] = useState(false);
  const picker = usePicker();

  if (askingAi && onAskAi) {
    return (
      <AskAiMenu
        selection={text ?? ""}
        onSubmit={(prompt) => {
          onAskAi(prompt);
          setSidebarTab("chat");
          close();
        }}
        onClose={() => setAskingAi(false)}
      />
    );
  }

  const highlight = (color: HighlightColor) => {
    setLastColor(color);
    onHighlight?.(color);
    close();
  };
  const run = (action: () => void) => () => {
    action();
    close();
  };

  const actions = (
    <>
      {text && (
        <BarButton
          label="Copy the text"
          icon={ClipboardCopy}
          onClick={run(() => void copyTextToClipboard(text))}
        />
      )}
      {text && onRead && <BarButton label="Read the text" icon={AudioLines} onClick={run(onRead)} />}
      {onHighlight && (
        <span className="uxie-popover-split" data-swatch={lastColor}>
          <CustomTooltip content="Highlight" asChild>
            <button
              type="button"
              className="uxie-popover-btn"
              aria-label={`Highlight ${HIGHLIGHT_COLOR_LABELS[lastColor]}`}
              onClick={() => highlight(lastColor)}
            >
              <Highlighter aria-hidden className="uxie-popover-icon" />
              <span className="uxie-popover-swatch" />
            </button>
          </CustomTooltip>
          <CustomTooltip content="Colour" asChild>
            <button
              type="button"
              className="uxie-popover-btn"
              data-picker-toggle=""
              aria-label="Choose highlight colour"
              aria-expanded={picker.open}
              onClick={(e) => picker.toggle(true, e)}
            >
              <ChevronDown aria-hidden className="uxie-popover-chevron" />
            </button>
          </CustomTooltip>
        </span>
      )}
      {extraActions.map((action) => (
        <BarButton
          key={action.label}
          label={action.label}
          icon={action.icon}
          onClick={run(action.onSelect)}
        />
      ))}
      {image && onAttach && (
        <BarButton
          label="Attach to chat"
          icon={MessageSquarePlus}
          onClick={run(() => {
            onAttach();
            setSidebarTab("chat");
          })}
        />
      )}
      {text && onAskAi && (
        <>
          <Separator />
          <BarButton
            label="Ask AI"
            icon={Sparkles}
            tone="accent"
            onClick={() => {
              onAskAiStart?.();
              setAskingAi(true);
            }}
          />
        </>
      )}
    </>
  );

  return (
    <PopoverBar
      label="Selection actions"
      panelRef={picker.panel}
      picker={picker.open}
      actions={actions}
      colours={
        <ColourPicker
          current={lastColor}
          onBack={(e) => picker.toggle(false, e)}
          onPick={highlight}
        />
      }
    />
  );
};

export const HighlightedTextPopover = ({
  text,
  color,
  onRead,
  onRecolor,
  onDelete,
  onAskAi,
  close,
}: {
  text: string | null;
  color: HighlightColor;
  onRead?: () => void;
  onRecolor?: (color: HighlightColor) => void;
  onDelete?: () => void;
  onAskAi?: AskAi;
  close: () => void;
}) => {
  const setLastColor = usePdfSettingsStore((s) => s.setHighlightColor);
  const setSidebarTab = useSidebarTabStore((s) => s.setTab);
  const [askingAi, setAskingAi] = useState(false);
  const picker = usePicker();

  if (askingAi && text && onAskAi) {
    return (
      <AskAiMenu
        selection={text}
        onSubmit={(prompt) => {
          onAskAi(prompt);
          setSidebarTab("chat");
          close();
        }}
        onClose={() => setAskingAi(false)}
      />
    );
  }

  const run = (action: () => void) => () => {
    action();
    close();
  };

  const actions = (
    <>
      {text && (
        <BarButton
          label="Copy the text"
          icon={ClipboardCopy}
          onClick={run(() => void copyTextToClipboard(text))}
        />
      )}
      {text && onRead && <BarButton label="Read the text" icon={AudioLines} onClick={run(onRead)} />}
      {onRecolor && (
        <CustomTooltip content="Change colour" asChild>
          <button
            type="button"
            className="uxie-popover-btn uxie-popover-colour"
            data-swatch={color}
            data-picker-toggle=""
            aria-label={`Change colour, now ${HIGHLIGHT_COLOR_LABELS[color]}`}
            aria-expanded={picker.open}
            onClick={(e) => picker.toggle(true, e)}
          >
            <span className="uxie-popover-current" />
            <ChevronDown aria-hidden className="uxie-popover-chevron" />
          </button>
        </CustomTooltip>
      )}
      {text && onAskAi && (
        <>
          <Separator />
          <BarButton label="Ask AI" icon={Sparkles} tone="accent" onClick={() => setAskingAi(true)} />
        </>
      )}
      {onDelete && (
        <>
          <Separator />
          <BarButton label="Delete highlight" icon={TrashIcon} tone="danger" onClick={run(onDelete)} />
        </>
      )}
    </>
  );

  return (
    <PopoverBar
      label="Highlight actions"
      panelRef={picker.panel}
      picker={picker.open}
      actions={actions}
      colours={
        <ColourPicker
          current={color}
          onBack={(e) => picker.toggle(false, e)}
          onPick={(next, e) => {
            setLastColor(next);
            if (next !== color) onRecolor?.(next);
            picker.toggle(false, e);
          }}
        />
      }
    />
  );
};
