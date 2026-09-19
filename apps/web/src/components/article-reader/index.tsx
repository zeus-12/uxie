import { ReaderHeader } from "@/components/workspace/reader-header";
import { addHighlightToNotes } from "@/lib/add-highlight-to-notes";
import { api } from "@/lib/api";
import { useBlocknoteEditorStore } from "@/lib/store";
import { HighlightContentType } from "@/types/highlight";
import type { ArticleDocumentData } from "@/types/reader";
import { createId } from "@paralleldrive/cuid2";
import {
  useArticleSettingsStore,
  useChatStore,
  useHighlightJumpStore,
  useSidebarTabStore,
} from "@uxie/shared/lib/store";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import {
  getArticleTextSelection,
  paintArticleHighlights,
  type ArticleTextSelection,
} from "./article-dom";
import {
  ArticleHighlightPopover,
  ArticleSelectionPopover,
} from "./selection-popover";
import { ArticleBottomToolbar } from "./tts-toolbar";
import { useArticleTts } from "./use-article-tts";

const readingMinutes = (wordCount: number) =>
  Math.max(1, Math.ceil(wordCount / 225));

const ARTICLE_FONT_FAMILIES = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, Cambria, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

export default function ArticleReader({ doc }: { doc: ArticleDocumentData }) {
  const { article } = doc;
  const sourceName = article.siteName || new URL(article.canonicalUrl).hostname;
  const scrollRootRef = useRef<HTMLElement>(null);
  const articleContentRef = useRef<HTMLDivElement>(null);
  const restoredProgressRef = useRef(false);
  const restoringProgressRef = useRef(true);
  const [selection, setSelection] = useState<ArticleTextSelection | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{
    id: string;
    text: string;
    rect: DOMRect;
  } | null>(null);
  const fontFamily = useArticleSettingsStore((state) => state.fontFamily);
  const fontSize = useArticleSettingsStore((state) => state.fontSize);
  const backgroundColour = useArticleSettingsStore(
    (state) => state.backgroundColour,
  );
  const utils = api.useContext();
  const { mutate: updateProgress } =
    api.document.updateArticleProgress.useMutation();
  const setJumpToHighlight = useHighlightJumpStore(
    (state) => state.setJumpToHighlight,
  );
  const sendChatMessage = useChatStore((state) => state.sendMessage);
  const setSidebarTab = useSidebarTabStore((state) => state.setTab);
  const articleTts = useArticleTts({
    articleRootRef: articleContentRef,
    scrollRootRef,
  });

  const { mutate: addHighlight } = api.highlight.addArticleText.useMutation({
    async onMutate(input) {
      await utils.document.getDocData.cancel({ docId: doc.id });
      const previous = utils.document.getDocData.getData({ docId: doc.id });
      utils.document.getDocData.setData({ docId: doc.id }, (old) => {
        if (!old || old.kind !== "article") return old;
        return {
          ...old,
          highlights: [
            ...old.highlights,
            {
              id: input.id,
              selectedText: input.exactText,
              anchor: {
                snapshotId: input.snapshotId,
                blockId: input.blockId,
                startOffset: input.startOffset,
                endOffset: input.endOffset,
                exactText: input.exactText,
                prefix: input.prefix,
                suffix: input.suffix,
              },
            },
          ],
        };
      });
      return { previous };
    },
    onError(error, _input, context) {
      toast.error(error.message);
      utils.document.getDocData.setData({ docId: doc.id }, context?.previous);
    },
    onSuccess(_result, input) {
      const editor = useBlocknoteEditorStore.getState().editor;
      void addHighlightToNotes({
        content: input.exactText,
        highlightId: input.id,
        type: HighlightContentType.TEXT,
        editor,
        canEdit: doc.userPermissions.canEdit,
      });
    },
    onSettled() {
      void utils.document.getDocData.invalidate({ docId: doc.id });
    },
  });

  const { mutate: deleteHighlight } = api.highlight.delete.useMutation({
    async onMutate(input) {
      await utils.document.getDocData.cancel({ docId: doc.id });
      const previous = utils.document.getDocData.getData({ docId: doc.id });
      utils.document.getDocData.setData({ docId: doc.id }, (old) => {
        if (!old || old.kind !== "article") return old;
        return {
          ...old,
          highlights: old.highlights.filter(
            (highlight) => highlight.id !== input.highlightId,
          ),
        };
      });
      return { previous };
    },
    onError(error, _input, context) {
      toast.error(error.message);
      utils.document.getDocData.setData({ docId: doc.id }, context?.previous);
    },
    onSettled() {
      void utils.document.getDocData.invalidate({ docId: doc.id });
    },
  });

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || restoredProgressRef.current) return;

    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        restoredProgressRef.current = true;
        const progress = doc.progress;
        if (!progress || progress.snapshotId !== article.snapshot.id) {
          restoringProgressRef.current = false;
          return;
        }

        const target = progress.blockId
          ? root.querySelector<HTMLElement>(
              `[data-uxie-block-id="${CSS.escape(progress.blockId)}"]`,
            )
          : null;
        if (target) {
          target.scrollIntoView({ block: "start" });
        } else {
          const availableScroll = root.scrollHeight - root.clientHeight;
          root.scrollTop = availableScroll * progress.scrollFraction;
        }

        frame = window.requestAnimationFrame(() => {
          restoringProgressRef.current = false;
        });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [article.snapshot.id, doc.progress]);

  useEffect(() => {
    const root = articleContentRef.current;
    if (!root) return;
    paintArticleHighlights(root, doc.highlights);
  }, [article.snapshot.contentHtml, doc.highlights]);

  useEffect(() => {
    setJumpToHighlight((highlightId) => {
      const root = articleContentRef.current;
      const mark = root?.querySelector<HTMLElement>(
        `mark[data-article-highlight-id="${highlightId}"]`,
      );
      if (!mark) {
        toast.error("Couldn't find this highlight in the article.");
        return;
      }
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      mark.focus({ preventScroll: true });
    });
    return () => setJumpToHighlight(null);
  }, [setJumpToHighlight]);

  const saveProgress = useDebouncedCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const rootTop = root.getBoundingClientRect().top;
    const blocks = root.querySelectorAll<HTMLElement>("[data-uxie-block-id]");
    const currentBlock = Array.from(blocks).find(
      (block) => block.getBoundingClientRect().bottom > rootTop + 96,
    );
    const availableScroll = root.scrollHeight - root.clientHeight;

    const progress = {
      documentId: doc.id,
      snapshotId: article.snapshot.id,
      blockId: currentBlock?.dataset.uxieBlockId ?? null,
      characterOffset: 0,
      scrollFraction:
        availableScroll > 0 ? Math.min(1, root.scrollTop / availableScroll) : 0,
    };

    utils.document.getDocData.setData({ docId: doc.id }, (old) =>
      old?.kind === "article"
        ? {
            ...old,
            progress: {
              snapshotId: progress.snapshotId,
              blockId: progress.blockId,
              characterOffset: progress.characterOffset,
              scrollFraction: progress.scrollFraction,
            },
          }
        : old,
    );
    updateProgress(progress);
  }, 1_000);

  useEffect(() => {
    return () => saveProgress.flush();
  }, [saveProgress]);

  const dismissPopover = () => {
    setSelection(null);
    setActiveHighlight(null);
    window.getSelection()?.removeAllRanges();
  };

  const readSelection = () => {
    const root = articleContentRef.current;
    if (!root) return;
    // Always assign: keeping the previous selection when the current one is
    // unusable leaves the popover anchored to text the user no longer has
    // selected, and highlighting then saves that stale text.
    setSelection(getArticleTextSelection(root));
  };

  const openHighlightActions = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    const mark = target.closest<HTMLElement>("mark[data-article-highlight-id]");
    const id = mark?.dataset.articleHighlightId;
    if (!mark || !id) return false;
    const highlight = doc.highlights.find((item) => item.id === id);
    if (!highlight) return false;
    setSelection(null);
    setActiveHighlight({
      id,
      text: highlight.selectedText,
      rect: mark.getBoundingClientRect(),
    });
    return true;
  };

  const persistSelection = () => {
    if (!selection) return;
    const id = createId();
    addHighlight({
      id,
      documentId: doc.id,
      snapshotId: article.snapshot.id,
      blockId: selection.blockId,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      exactText: selection.exactText,
      prefix: selection.prefix,
      suffix: selection.suffix,
    });
    dismissPopover();
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      style={{ backgroundColor: backgroundColour }}
    >
      <ReaderHeader
        title={doc.title}
        canEdit={doc.userPermissions.canEdit}
        documentId={doc.id}
      />

      <main
        ref={scrollRootRef}
        onScroll={() => {
          setSelection(null);
          setActiveHighlight(null);
          articleTts.notifyUserScroll();
          if (!restoringProgressRef.current) saveProgress();
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-24 pt-10 sm:px-8 sm:pb-24 sm:pt-14"
      >
        <article
          className="mx-auto max-w-[68ch]"
          style={{ fontFamily: ARTICLE_FONT_FAMILIES[fontFamily] }}
        >
          <header className="mb-10 border-b border-stone-200 pb-8">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {sourceName}
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-stone-950 sm:text-4xl">
              {article.snapshot.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {article.byline && <span>{article.byline}</span>}
              {article.byline && <span aria-hidden="true">·</span>}
              <span>{readingMinutes(article.wordCount)} min read</span>
            </div>
            {article.excerpt && (
              <p className="mt-5 text-pretty text-lg leading-7 text-stone-600">
                {article.excerpt}
              </p>
            )}
          </header>

          <div
            ref={articleContentRef}
            className="article-content prose prose-stone max-w-none break-words leading-[1.7] prose-headings:scroll-mt-6 prose-headings:text-balance prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:text-stone-900 prose-a:decoration-stone-400 prose-a:underline-offset-4 prose-blockquote:border-stone-300 prose-blockquote:text-stone-700 prose-img:rounded-md prose-img:outline prose-img:outline-1 prose-img:outline-black/10 prose-pre:overflow-x-auto"
            style={{ fontFamily: "inherit", fontSize }}
            dangerouslySetInnerHTML={{ __html: article.snapshot.contentHtml }}
            onMouseUp={(event) => {
              if (openHighlightActions(event.target)) return;
              requestAnimationFrame(readSelection);
            }}
            onKeyUp={(event) => {
              if (event.key === "Enter" && openHighlightActions(event.target)) {
                return;
              }
              requestAnimationFrame(readSelection);
            }}
          />
        </article>
      </main>
      {selection && (
        <ArticleSelectionPopover
          rect={selection.rect}
          text={selection.exactText}
          canEdit={doc.userPermissions.canEdit}
          onDismiss={dismissPopover}
          onHighlight={persistSelection}
          onRead={() =>
            articleTts.startFromSelection(
              selection.blockId,
              selection.startOffset,
            )
          }
          onAsk={
            doc.isVectorised && sendChatMessage
              ? (prompt) => {
                  sendChatMessage(prompt);
                  setSidebarTab("chat");
                }
              : undefined
          }
        />
      )}
      {activeHighlight && doc.userPermissions.canEdit && (
        <ArticleHighlightPopover
          rect={activeHighlight.rect}
          text={activeHighlight.text}
          onDismiss={dismissPopover}
          onDelete={() =>
            deleteHighlight({
              documentId: doc.id,
              highlightId: activeHighlight.id,
            })
          }
        />
      )}
      <ArticleBottomToolbar tts={articleTts} originalUrl={article.sourceUrl} />
    </div>
  );
}
