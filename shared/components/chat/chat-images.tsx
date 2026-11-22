import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageOffIcon, Loader2Icon, XIcon } from "lucide-react";
import type { ChatImage } from "../../lib/chat-attachments";
import { cn } from "../../lib/utils";
import { DialogOverlay, DialogPortal } from "../ui/dialog";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function StagedImageStrip({
  images,
  pending,
  onOpen,
  onRemove,
}: {
  images: ChatImage[];
  pending: number;
  onOpen: (image: ChatImage) => void;
  onRemove: (id: string) => void;
}) {
  if (!images.length && !pending) return null;
  return (
    <ul
      aria-label="Attached images"
      className="flex gap-2 overflow-x-auto px-2.5 pt-2.5"
    >
      {images.map((image) => (
        <li key={image.id} className="relative shrink-0 p-1">
          <button
            type="button"
            onClick={() => onOpen(image)}
            aria-label={`Preview ${image.filename}`}
            className={cn(
              "block size-14 overflow-hidden rounded-lg border border-border bg-background shadow-sm transition-opacity hover:opacity-90",
              FOCUS_RING,
            )}
          >
            {image.url && (
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            aria-label={`Remove ${image.filename}`}
            className={cn(
              "absolute right-0 top-0 flex size-5 items-center justify-center rounded-full border border-background bg-foreground text-background shadow-sm transition-transform hover:scale-110",
              FOCUS_RING,
            )}
          >
            <XIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </li>
      ))}
      {Array.from({ length: pending }, (_, index) => (
        <li key={`pending-${index}`} className="shrink-0 p-1">
          <div
            role="status"
            aria-label="Preparing image"
            className="flex size-14 items-center justify-center rounded-lg border border-dashed border-border bg-background text-muted-foreground"
          >
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MessageImageGrid({
  images,
  onOpen,
}: {
  images: ChatImage[];
  onOpen: (image: ChatImage) => void;
}) {
  if (!images.length) return null;
  const single = images.length === 1;
  return (
    <div className={cn("grid gap-1", single ? "grid-cols-1" : "grid-cols-2")}>
      {images.map((image) =>
        image.url ? (
          <button
            key={image.id}
            type="button"
            onClick={() => onOpen(image)}
            aria-label={`Open ${image.filename}`}
            className={cn(
              "block overflow-hidden rounded-xl border border-border bg-muted transition-opacity hover:opacity-90",
              single ? "max-w-60" : "size-28",
              FOCUS_RING,
            )}
          >
            <img
              src={image.url}
              alt={image.filename}
              draggable={false}
              className={cn(
                "block",
                single
                  ? "max-h-60 w-auto max-w-full"
                  : "size-full object-cover",
              )}
            />
          </button>
        ) : (
          <div
            key={image.id}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/50 px-2 text-center text-xs text-muted-foreground",
              single ? "h-20 w-40" : "size-28",
            )}
          >
            <ImageOffIcon className="size-4" aria-hidden="true" />
            <span className="line-clamp-2 break-all">{image.filename}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function ImageLightbox({
  image,
  onClose,
}: {
  image: ChatImage | null;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open={!!image?.url}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {image?.filename ?? "Image"}
          </DialogPrimitive.Title>
          {image?.url && (
            <img
              src={image.url}
              alt={image.filename}
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
