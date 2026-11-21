import { Plus } from "lucide-react";

export function AddDocCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add PDF"
      className="group block h-full w-full text-left"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-md border-[1.5px] border-dashed border-gray-300 bg-transparent transition-all duration-300 ease-out group-hover:border-gray-400 group-hover:bg-white group-hover:shadow-sm">
        <div className="flex aspect-[3/4] flex-1 flex-col items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-slate-300 text-slate-400 transition-all duration-200 group-hover:scale-105 group-hover:border-slate-500 group-hover:text-slate-600">
            <Plus className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-slate-500">Add PDF</span>
        </div>
      </div>
    </button>
  );
}
