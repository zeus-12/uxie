import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@uxie/shared/components/ui/button";
import { DocumentTitle } from "@uxie/shared/components/workspace/document-title";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";

export function ReaderHeader({
  canEdit,
  title,
  documentId,
  actions,
}: {
  canEdit: boolean;
  title: string;
  documentId: string;
  actions?: ReactNode;
}) {
  const utils = api.useContext();
  const { mutate: updateTitle } = api.document.updateTitle.useMutation({
    async onMutate(newData) {
      await utils.document.getDocData.cancel();
      const previous = utils.document.getDocData.getData({ docId: documentId });
      utils.document.getDocData.setData({ docId: documentId }, (old) =>
        old ? { ...old, title: newData.title } : old,
      );
      return { previous };
    },
    onError(_error, _newData, context) {
      toast.error("Failed to update title");
      utils.document.getDocData.setData(
        { docId: documentId },
        context?.previous,
      );
    },
    onSettled() {
      void utils.document.getDocData.invalidate();
    },
  });

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-stone-200 bg-white px-1">
      <Link
        href="/f"
        aria-label="Back to library"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-9 shrink-0 px-0",
        )}
      >
        <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <DocumentTitle
          title={title}
          canEdit={canEdit}
          onSave={(newTitle) =>
            updateTitle({ docId: documentId, title: newTitle })
          }
        />
      </div>
      {actions}
    </header>
  );
}
