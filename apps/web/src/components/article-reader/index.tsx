import { ReaderHeader } from "@/components/workspace/reader-header";
import { addHighlightToNotes } from "@/lib/add-highlight-to-notes";
import { api } from "@/lib/api";
import { useBlocknoteEditorStore } from "@/lib/store";
import { HighlightContentType } from "@/types/highlight";
import type { ArticleDocumentData } from "@/types/reader";
import { createId } from "@paralleldrive/cuid2";
import type { HighlightColor } from "@uxie/shared/lib/highlight-colors";
import { CITATION_HIGHLIGHT_DURATION_MS } from "@uxie/shared/lib/citation-navigation";
import {
  useArticleSettingsStore,
  useChatStore,
  useCitationHighlightStore,
  useHighlightJumpStore,
} from "@uxie/shared/lib/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import {
  findTextRangeInBlock,
  getArticleTextSelection,
  paintArticleHighlights,
  type ArticleTextSelection,
} from "./article-dom";
import { useRecolorHighlight } from "@/hooks/use-recolor-highlight";
import { AnchoredPopover } from "@uxie/shared/components/pdf-reader/anchored-popover";
import {
  HighlightedTextPopover,
  TextSelectionPopover,
} from "@uxie/shared/components/pdf-reader/highlight-popover";
import { useHighlightTip, useSelectionTip } from "@uxie/shared/hooks/use-reader-tips";
import { usePublishHighlightColors } from "@uxie/shared/lib/store";
import { ArticleBottomToolbar } from "./tts-toolbar";
import { useArticleTts } from "./use-article-tts";

const ARTICLE_CITATION_HIGHLIGHT = "uxie-article-citation";

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
  const articleContentRef = useRef<HTMLDivElement | null>(null);
  const [articleContent, setArticleContent] = useState<HTMLDivElement | null>(null);
  const attachArticleContent = useCallback((element: HTMLDivElement | null) => {
    articleContentRef.current = element;
    setArticleContent(element);
  }, []);
  const restoredProgressRef = useRef(false);
  const restoringProgressRef = useRef(true);
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
              color: input.color,
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
        `mark[data-highlight-id="${CSS.escape(highlightId)}"]`,
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

  const setHighlightSource = useCitationHighlightStore(
    (state) => state.setHighlightSource,
  );
  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const clearCitation = () => {
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = null;
      CSS.highlights?.delete(ARTICLE_CITATION_HIGHLIGHT);
    };

    setHighlightSource((source) => {
      clearCitation();
      if (source.kind !== "article") {
        toast.error("That source isn't part of this article", {
          duration: 3000,
        });
        return;
      }
      const block = articleContentRef.current?.querySelector<HTMLElement>(
        `[data-uxie-block-id="${CSS.escape(source.blockId)}"]`,
      );
      const range = block && findTextRangeInBlock(block, source.pageContent);
      if (!block || !range) {
        toast.error("Couldn't find this passage in the article", {
          duration: 3000,
        });
        return;
      }
      CSS.highlights?.set(ARTICLE_CITATION_HIGHLIGHT, new Highlight(range));
      block.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      clearTimer = setTimeout(clearCitation, CITATION_HIGHLIGHT_DURATION_MS);
    });
    return () => {
      setHighlightSource(null);
      clearCitation();
    };
  }, [setHighlightSource]);

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

  const recolorHighlight = useRecolorHighlight(doc.id);
  usePublishHighlightColors(doc.highlights);
  const canEdit = doc.userPermissions.canEdit;
  const askAi = doc.isVectorised && sendChatMessage ? sendChatMessage : undefined;

  const describeSelection = useCallback(
    () => (articleContentRef.current ? getArticleTextSelection(articleContentRef.current) : null),
    [],
  );
  const selectionTip = useSelectionTip(articleContent, describeSelection);
  const highlightTip = useHighlightTip(articleContent, {
    suspended: selectionTip.tip !== null,
  });
  const closeSelection = () => {
    selectionTip.close();
    window.getSelection()?.removeAllRanges();
  };

  const persistSelection = (
    selection: ArticleTextSelection,
    color: HighlightColor,
  ) => {
    addHighlight({
      id: createId(),
      documentId: doc.id,
      snapshotId: article.snapshot.id,
      blockId: selection.blockId,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      exactText: selection.exactText,
      prefix: selection.prefix,
      suffix: selection.suffix,
      color,
    });
  };

  const selection = selectionTip.tip?.value;
  const tipHighlight = highlightTip.tip
    ? doc.highlights.find((h) => h.id === highlightTip.tip!.id)
    : undefined;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background text-foreground"
      data-theme={backgroundColour === "theme" ? undefined : "light"}
      style={
        backgroundColour === "theme"
          ? undefined
          : { backgroundColor: backgroundColour }
      }
    >
      <ReaderHeader
        title={doc.title}
        canEdit={doc.userPermissions.canEdit}
        documentId={doc.id}
      />

      <main
        ref={scrollRootRef}
        onScroll={() => {
          articleTts.notifyUserScroll();
          if (!restoringProgressRef.current) saveProgress();
        }}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-24 pt-10 sm:px-8 sm:pb-24 sm:pt-14"
      >
        <article
          className="mx-auto max-w-[68ch]"
          style={{ fontFamily: ARTICLE_FONT_FAMILIES[fontFamily] }}
        >
          <header className="mb-10 border-b border-border pb-8">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {sourceName}
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-4xl">
              {article.snapshot.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {article.byline && <span>{article.byline}</span>}
              {article.byline && <span aria-hidden="true">·</span>}
              <span>{readingMinutes(article.wordCount)} min read</span>
            </div>
            {article.excerpt && (
              <p className="mt-5 text-pretty text-lg leading-7 text-muted-foreground">
                {article.excerpt}
              </p>
            )}
          </header>

          <div
            ref={attachArticleContent}
            className="article-content prose max-w-none break-words leading-[1.7] prose-headings:scroll-mt-6 prose-headings:text-balance prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:text-foreground prose-a:decoration-muted-foreground prose-a:underline-offset-4 prose-blockquote:border-border prose-blockquote:text-muted-foreground prose-img:rounded-md prose-img:outline prose-img:outline-1 prose-img:outline-foreground/10 prose-pre:overflow-x-auto"
            style={{ fontFamily: "inherit", fontSize }}
            dangerouslySetInnerHTML={{ __html: article.snapshot.contentHtml }}
          />
        </article>
        {highlightTip.tip && tipHighlight && (
          <AnchoredPopover
            key={highlightTip.tip.id}
            ref={highlightTip.popoverRef}
            anchor={highlightTip.tip.anchor}
          >
            <HighlightedTextPopover
              text={tipHighlight.selectedText}
              color={tipHighlight.color}
              onRead={() =>
                articleTts.startFromSelection(
                  tipHighlight.anchor.blockId,
                  tipHighlight.anchor.startOffset,
                )
              }
              onRecolor={
                canEdit ? (color) => recolorHighlight(tipHighlight.id, color) : undefined
              }
              onDelete={
                canEdit
                  ? () => deleteHighlight({ documentId: doc.id, highlightId: tipHighlight.id })
                  : undefined
              }
              onAskAi={askAi}
              close={highlightTip.close}
            />
          </AnchoredPopover>
        )}
        {selectionTip.tip && selection && (
          <AnchoredPopover ref={selectionTip.popoverRef} anchor={selectionTip.tip.anchor}>
            <TextSelectionPopover
              text={selection.exactText}
              onHighlight={canEdit ? (color) => persistSelection(selection, color) : undefined}
              onRead={() =>
                articleTts.startFromSelection(selection.blockId, selection.startOffset)
              }
              onAskAi={askAi}
              close={closeSelection}
            />
          </AnchoredPopover>
        )}
      </main>
      <ArticleBottomToolbar tts={articleTts} originalUrl={article.sourceUrl} />
    </div>
  );
}
