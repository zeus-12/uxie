import { Loader2, Plus } from "lucide-react";

// A dashed "empty slot" that sits as the first tile in the document grid and
// mirrors DocCard's footprint so the grid stays rhythmic. Quiet at rest, fills
// to a solid card on hover.
export function AddDocCard({
  onClick,
  importing,
}: {
  onClick: () => void;
  importing: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={importing}
      aria-label="Add PDF"
      className="group block h-full w-full text-left disabled:cursor-default"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-md border-[1.5px] border-dashed border-gray-300 bg-transparent transition-all duration-300 ease-out group-hover:border-gray-400 group-hover:bg-white group-hover:shadow-sm group-disabled:opacity-70">
        <div className="flex aspect-[3/4] flex-1 flex-col items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-slate-300 text-slate-400 transition-all duration-200 group-hover:scale-105 group-hover:border-slate-500 group-hover:text-slate-600">
            {importing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            )}
          </div>
          <span className="text-sm font-medium text-slate-500">
            {importing ? "Importing…" : "Add PDF"}
          </span>
        </div>
      </div>
    </button>
  );
}
