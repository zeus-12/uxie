import { addHighlightToNotes } from "@/components/pdf-reader";
import PdfReader from "@/components/pdf-reader/reader";
import { buttonVariants } from "@uxie/shared/components/ui/button";
import { useDemoDocStore } from "@/lib/demo/store";
import { useBlocknoteEditorStore } from "@/lib/store";
import { cn, stripTextFromEnd } from "@/lib/utils";
import { type AddHighlightType, HighlightContentType } from "@/types/highlight";
import { type ReaderDoc } from "@/types/reader";
import { createId } from "@paralleldrive/cuid2";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Demo container for the reader. It reuses the production PdfReader (and, below
 * it, PdfHighlighter) unchanged, injecting store-backed persistence so nothing
 * touches the backend. Only the demo-specific header (back link + always-editable
 * title) lives here.
 */
const DemoDocViewer = ({ doc }: { doc: ReaderDoc }) => {
  const addHighlightToStore = useDemoDocStore((s) => s.addHighlight);
  const deleteHighlight = useDemoDocStore((s) => s.deleteHighlight);
  const updateAreaHighlight = useDemoDocStore((s) => s.updateAreaHighlight);
  const setLastReadPage = useDemoDocStore((s) => s.setLastReadPage);

  async function addHighlight({ content, position }: AddHighlightType) {
    const { text, image } = content;
    if (!text && !image) return;

    const highlightId = createId();
    addHighlightToStore({ id: highlightId, position });

    const editor = useBlocknoteEditorStore.getState().editor;
    if (text) {
      addHighlightToNotes(
        text,
        highlightId,
        HighlightContentType.TEXT,
        editor,
        true,
        position.pageNumber,
      );
    } else if (image) {
      addHighlightToNotes(image, highlightId, HighlightContentType.IMAGE, editor, true);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit justify-start",
          )}
        >
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
        </Link>

        <DemoTitle title={doc.title} />
      </div>
      <div className="relative h-full w-full">
        <PdfReader
          doc={doc}
          addHighlight={addHighlight}
          deleteHighlight={deleteHighlight}
          onUpdateLastReadPage={(_id, page) => setLastReadPage(page)}
          onUpdateAreaHighlight={updateAreaHighlight}
        />
      </div>
    </div>
  );
};

const DemoTitle = ({ title }: { title: string | null }) => {
  const setTitle = useDemoDocStore((s) => s.setTitle);
  const [isEditing, setIsEditing] = useState(false);
  const displayTitle = stripTextFromEnd(title, ".pdf");
  const [value, setValue] = useState(displayTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(displayTitle);
  }, [displayTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(displayTitle);
      setIsEditing(false);
      return;
    }
    if (trimmed !== displayTitle) setTitle(trimmed);
    setIsEditing(false);
  };

  return (
    <div className="min-w-0 flex-1">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              save();
            } else if (e.key === "Escape") {
              setValue(displayTitle);
              setIsEditing(false);
            }
          }}
          className="w-full border-none bg-transparent px-1 -mx-1 font-semibold leading-normal outline-none focus:ring-0"
        />
      ) : (
        <p
          className="line-clamp-1 -mx-1 cursor-pointer rounded px-1 font-semibold leading-normal hover:bg-muted/50"
          onClick={() => setIsEditing(true)}
          title="Click to edit"
        >
          {displayTitle}
        </p>
      )}
    </div>
  );
};

export default DemoDocViewer;
