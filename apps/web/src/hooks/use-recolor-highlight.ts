import { api } from "@/lib/api";
import type { HighlightColor } from "@uxie/shared/lib/highlight-colors";
import { toast } from "sonner";

export function useRecolorHighlight(docId: string) {
  const utils = api.useContext();
  const { mutate } = api.highlight.updateColor.useMutation({
    async onMutate({ id, color }) {
      await utils.document.getDocData.cancel({ docId });
      const previous = utils.document.getDocData.getData({ docId });
      utils.document.getDocData.setData({ docId }, (old) => {
        if (!old) return old;
        if (old.kind === "pdf") {
          return {
            ...old,
            highlights: old.highlights.map((h) => (h.id === id ? { ...h, color } : h)),
          };
        }
        return {
          ...old,
          highlights: old.highlights.map((h) => (h.id === id ? { ...h, color } : h)),
        };
      });
      return { previous };
    },
    onError(_error, _input, context) {
      toast.error("Couldn't change the highlight colour", { duration: 3000 });
      utils.document.getDocData.setData({ docId }, context?.previous);
    },
    onSettled() {
      void utils.document.getDocData.invalidate({ docId });
    },
  });

  return (id: string, color: HighlightColor) => mutate({ documentId: docId, id, color });
}
