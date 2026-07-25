import { useEffect, useRef, useState } from "react";
import { cn, stripTextFromEnd } from "../../lib/utils";

/**
 * The reader's header title. Click to rename; Enter/blur commits, Escape
 * reverts. `onSave` only fires for a real change, so callers can treat it as a
 * write.
 */
export function DocumentTitle({
  title,
  canEdit,
  onSave,
}: {
  title: string | null;
  canEdit: boolean;
  onSave: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const displayTitle = stripTextFromEnd(title, ".pdf");
  const [value, setValue] = useState(displayTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const trimmed = value.trim();
    setIsEditing(false);
    if (!trimmed) {
      setValue(displayTitle);
      return;
    }
    if (trimmed !== displayTitle) onSave(trimmed);
  };

  useEffect(() => {
    setValue(displayTitle);
  }, [displayTitle]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

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
          className="-mx-1 w-full border-none bg-transparent px-1 font-semibold leading-normal outline-none focus:ring-0"
        />
      ) : (
        <p
          className={cn(
            "-mx-1 line-clamp-1 rounded px-1 font-semibold leading-normal",
            canEdit && "cursor-pointer hover:bg-muted/50",
          )}
          onClick={() => canEdit && setIsEditing(true)}
          title={canEdit ? "Click to edit" : undefined}
        >
          {displayTitle}
        </p>
      )}
    </div>
  );
}
