import {
  buildWordMap,
  extractWords,
  splitSentences,
  type WordMapEntry,
} from "@/lib/tts/utils";
import { useCallback, useEffect, useRef } from "react";

export type HighlightMode = "tts" | "rsvp";

const HIGHLIGHT_CLASS = {
  sentence: "current-sentence",
  word: "current-word",
};

const HIGHLIGHT_CLASS_RSVP = {
  sentence: "rsvp-sentence",
  word: "rsvp-word",
};

const HIGHLIGHT_TAG = {
  sentence: "span",
  word: "div",
};

// Get the appropriate class based on mode
function getHighlightClass(
  type: "sentence" | "word",
  mode: HighlightMode = "tts",
) {
  return mode === "rsvp" ? HIGHLIGHT_CLASS_RSVP[type] : HIGHLIGHT_CLASS[type];
}

export type SentencePosition = {
  pageNumber: number;
  sentenceIndex: number;
  sentence: string;
  sentenceForTts: string;
};

function removeHighlightsByType(
  type: "sentence" | "word",
  mode?: HighlightMode,
) {
  // Remove both TTS and RSVP highlights if no mode specified
  const classNames = mode
    ? [mode === "rsvp" ? HIGHLIGHT_CLASS_RSVP[type] : HIGHLIGHT_CLASS[type]]
    : [HIGHLIGHT_CLASS[type], HIGHLIGHT_CLASS_RSVP[type]];

  classNames.forEach((className) => {
    const elements = document.querySelectorAll(`.${className}`);
    elements.forEach((el) => {
      const text = el.textContent || "";
      if (el.parentNode) {
        el.parentNode.replaceChild(document.createTextNode(text), el);
      }
    });
  });
}

export function removeAllHighlights() {
  removeHighlightsByType("sentence");
  removeHighlightsByType("word");
}

export function cleanSentenceForTts(text: string): string {
  text = text.replace(/[\[\(]\d+[\]\)]/g, "");
  text = text.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "");
  text = text.replace(/[●○■□▪▫◆◇★☆►▶◀◄→←↑↓↔↕⇒⇐⇑⇓•◦‣⁃∙·§¶†‡※⁂⁑⁕]/g, "");
  text = text.replace(/[≠≈≡≤≥±∓×÷∞∑∏∫∂√∛∜∝∀∃∄∅∈∉∋∌⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋∪∩]/g, "");
  text = text.replace(/[─━│┃┄┅┆┇┈┉┊┋╌╍╎╏═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/g, "");
  text = text.replace(/(\w)-\s+(\w)/g, "$1$2");
  return text.trim();
}

function extractSentencesFromBlocks(blockContents: string[]): string[] {
  const fullText = blockContents.join("");
  const sentences = splitSentences(fullText);

  return sentences.filter((sentence) => {
    const cleaned = cleanSentenceForTts(sentence);
    const alphanumericCount = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;
    return alphanumericCount >= 3 && alphanumericCount / cleaned.length > 0.3;
  });
}

export function useSentenceReader({ pageCount }: { pageCount: number }) {
  const currentPageRef = useRef(1);
  const currentSentenceIndexRef = useRef(0);
  const sentencesRef = useRef<string[]>([]);

  // Block tracking
  const blockIndex = useRef({ x: 0, y: 0 });
  const sentenceIndex = useRef({ x: 0, y: 0 });

  const blocksRef = useRef<Element[]>([]);
  const blockContentsRef = useRef<string[]>([]);
  const blockLengthsRef = useRef<number[]>([]);
  const wordMapRef = useRef<WordMapEntry[]>([]);
  const lastHighlightModeRef = useRef<HighlightMode>("tts");

  // Highlight inside a single block
  const highlightInsideSameBlockByIndexes = useCallback(
    ({
      startIndex,
      endIndex,
      type,
      blockYIndex,
      removePreviousHighlights = true,
      mode = "tts" as HighlightMode,
    }: {
      startIndex: number;
      endIndex: number;
      type: "sentence" | "word";
      blockYIndex: number;
      removePreviousHighlights?: boolean;
      mode?: HighlightMode;
    }) => {
      const currentBlockText = blockContentsRef.current[blockYIndex] ?? "";

      if (currentBlockText[startIndex] === " ") {
        startIndex += 1;
        if (
          endIndex < currentBlockText.length &&
          currentBlockText[endIndex] !== " "
        ) {
          endIndex += 1;
        }
      }

      const className = getHighlightClass(type, mode);
      const sentenceClass = getHighlightClass("sentence", mode);

      if (removePreviousHighlights) {
        removeHighlightsByType(type, mode);
      }

      let block = blocksRef.current?.[blockYIndex];
      if (!block) return;

      if (type === "word") {
        // Look for sentence highlight (either TTS or RSVP)
        block =
          block.querySelector(`.${sentenceClass}`) ??
          block.querySelector(`.${HIGHLIGHT_CLASS.sentence}`) ??
          block.querySelector(`.${HIGHLIGHT_CLASS_RSVP.sentence}`) ??
          block;
        if (!block) return;
      }

      const text =
        type === "sentence"
          ? blockContentsRef.current[blockYIndex]
          : block.textContent;

      if (!text) return;

      if (startIndex < 0 || startIndex > endIndex) return;

      if (endIndex > currentBlockText.length) {
        endIndex = currentBlockText.length;
      }

      const lengthDif = currentBlockText.indexOf(text);
      const ele = HIGHLIGHT_TAG[type];

      let highlightedText = "";
      let newHtml = "";

      if (type === "word") {
        const tex = block.innerHTML;
        highlightedText = `<${ele} class="${className}">${currentBlockText.substring(
          startIndex,
          endIndex,
        )}</${ele}>`;
        newHtml =
          tex.substring(0, startIndex - lengthDif) +
          highlightedText +
          tex.substring(endIndex - lengthDif);
      } else {
        highlightedText = `<${ele} class="${className}">${currentBlockText.substring(
          startIndex,
          endIndex,
        )}</${ele}>`;
        newHtml =
          currentBlockText.substring(lengthDif, startIndex) +
          highlightedText +
          currentBlockText.substring(endIndex);
      }

      block.innerHTML = newHtml;
    },
    [],
  );

  // Recursive sentence highlight across blocks
  const addClassAroundSentence = useCallback(
    (
      blockYIndex: number,
      sentenceLength: number,
      blockXIndex: number,
      removePreviousHighlights: boolean = true,
      mode: HighlightMode = "tts",
    ) => {
      if (
        sentenceLength <= 0 ||
        isNaN(sentenceLength) ||
        blockXIndex < 0 ||
        isNaN(blockXIndex) ||
        blockYIndex < 0 ||
        isNaN(blockYIndex)
      ) {
        return;
      }

      const blockLength = blockLengthsRef.current[blockYIndex] ?? 0;

      if (blockLength - blockXIndex >= sentenceLength) {
        highlightInsideSameBlockByIndexes({
          startIndex: blockXIndex,
          endIndex: blockXIndex + sentenceLength,
          type: "sentence",
          blockYIndex,
          removePreviousHighlights,
          mode,
        });
      } else {
        highlightInsideSameBlockByIndexes({
          startIndex: blockXIndex,
          endIndex: blockLength,
          type: "sentence",
          blockYIndex,
          removePreviousHighlights,
          mode,
        });

        const remaining = sentenceLength - (blockLength - blockXIndex);
        if (remaining > 0) {
          addClassAroundSentence(blockYIndex + 1, remaining, 0, false, mode);
        }
      }
    },
    [highlightInsideSameBlockByIndexes],
  );

  const loadPageSentences = useCallback((pageNumber: number): string[] => {
    const pageElement = document.querySelector(
      `.page[data-page-number="${pageNumber}"]`,
    );
    if (!pageElement) return [];

    const textDivs = pageElement.querySelectorAll("span[role='presentation']");
    const blocks = Array.from(textDivs);
    blocksRef.current = blocks;

    const blockContents = blocks
      .map((block) => block.textContent ?? "")
      .map((block) => {
        if (block.trim().length === 0) return "";
        return block.endsWith(" ") ? block : `${block} `;
      });

    blockContentsRef.current = blockContents;
    blockLengthsRef.current = blockContents.map((b) => b.length);

    const sentences = extractSentencesFromBlocks(blockContents);
    sentencesRef.current = sentences;
    currentPageRef.current = pageNumber;

    return sentences;
  }, []);

  const highlightCurrentSentence = useCallback(
    (mode: HighlightMode = "tts") => {
      lastHighlightModeRef.current = mode;
      const idx = currentSentenceIndexRef.current;
      const sentence = sentencesRef.current[idx];
      if (!sentence) return;

      addClassAroundSentence(
        blockIndex.current.y,
        sentence.length,
        blockIndex.current.x,
        true,
        mode,
      );
    },
    [addClassAroundSentence],
  );

  // Highlight a word in the current sentence by character offset and length (for RSVP)
  // charOffsetInSentence: where the word starts within the sentence
  // wordLength: length of the word to highlight
  const highlightWordInSentence = useCallback(
    (
      charOffsetInSentence: number,
      wordLength: number,
      mode: HighlightMode = "rsvp",
      removePreviousHighlights = true,
    ) => {
      const sentence = sentencesRef.current[currentSentenceIndexRef.current];
      if (!sentence || wordLength <= 0) return;

      // Find the sentence highlight span(s) already in the DOM
      const sentenceHighlights = Array.from(
        document.querySelectorAll(
          `.${HIGHLIGHT_CLASS.sentence}, .${HIGHLIGHT_CLASS_RSVP.sentence}`,
        ),
      );
      if (sentenceHighlights.length === 0) return;

      // Walk through highlight spans to find which one contains the char offset
      let consumed = 0;
      for (const el of sentenceHighlights) {
        const spanLen = (el.textContent || "").length;

        if (consumed + spanLen > charOffsetInSentence) {
          const parentBlock = el.parentElement;
          if (!parentBlock) return;

          const blockY = blocksRef.current.indexOf(parentBlock);
          if (blockY === -1) return;

          // Use a Range to find the exact character offset of the highlight
          // span within its parent block — no indexOf, no duplicate ambiguity.
          const range = document.createRange();
          range.setStart(parentBlock, 0);
          range.setEndBefore(el);
          const highlightStartInBlock = range.toString().length;

          const offsetInSpan = charOffsetInSentence - consumed;
          const startIndex = highlightStartInBlock + offsetInSpan;

          highlightInsideSameBlockByIndexes({
            startIndex,
            endIndex: startIndex + wordLength,
            type: "word",
            blockYIndex: blockY,
            removePreviousHighlights,
            mode,
          });
          return;
        }
        consumed += spanLen;
      }
    },
    [highlightInsideSameBlockByIndexes],
  );

  // Legacy function for compatibility - wraps highlightWordInSentence
  const highlightWordByIndex = useCallback(
    (wordIndex: number, mode: HighlightMode = "rsvp") => {
      const sentence = sentencesRef.current[currentSentenceIndexRef.current];
      if (!sentence) return;

      const words = extractWords(sentence);
      if (wordIndex < 0 || wordIndex >= words.length) return;

      const targetWord = words[wordIndex];
      if (!targetWord) return;

      // Calculate character offset
      let charOffset = 0;
      for (let i = 0; i < wordIndex; i++) {
        charOffset += (words[i]?.length ?? 0) + 1;
      }

      highlightWordInSentence(charOffset, targetWord.length, mode);
    },
    [highlightWordInSentence],
  );

  const getCurrentSentence = useCallback((): SentencePosition | null => {
    const idx = currentSentenceIndexRef.current;
    const sentence = sentencesRef.current[idx];
    if (!sentence) return null;

    return {
      pageNumber: currentPageRef.current,
      sentenceIndex: idx,
      sentence,
      sentenceForTts: cleanSentenceForTts(sentence),
    };
  }, []);

  // Helper to calculate blockIndex for a given sentence index
  // Finds where the sentence actually starts in the joined text
  const calculateBlockIndexForSentence = useCallback(
    (targetSentenceIdx: number) => {
      const sentence = sentencesRef.current[targetSentenceIdx];
      if (!sentence) {
        blockIndex.current = { x: 0, y: 0 };
        return;
      }

      // Join all blocks to find where this sentence starts
      const fullText = blockContentsRef.current.join("");

      // Find all sentence positions to get the correct one (in case of duplicates)
      let searchStart = 0;
      for (let i = 0; i < targetSentenceIdx; i++) {
        const prevSentence = sentencesRef.current[i];
        if (prevSentence) {
          const pos = fullText.indexOf(prevSentence, searchStart);
          if (pos !== -1) {
            searchStart = pos + prevSentence.length;
          }
        }
      }

      const sentenceStart = fullText.indexOf(sentence, searchStart);
      if (sentenceStart === -1) {
        blockIndex.current = { x: 0, y: 0 };
        return;
      }

      // Convert absolute position to block coordinates
      let remaining = sentenceStart;
      blockIndex.current = { x: 0, y: 0 };

      for (let i = 0; i < blockLengthsRef.current.length; i++) {
        const blockLen = blockLengthsRef.current[i] ?? 0;
        if (remaining < blockLen) {
          blockIndex.current = { x: remaining, y: i };
          return;
        }
        remaining -= blockLen;
      }
    },
    [],
  );

  const advanceToNextSentence = useCallback((): SentencePosition | null => {
    const nextIdx = currentSentenceIndexRef.current + 1;

    if (nextIdx < sentencesRef.current.length) {
      // More sentences on current page
      currentSentenceIndexRef.current = nextIdx;
      sentenceIndex.current.y = nextIdx;
      sentenceIndex.current.x = 0;
      calculateBlockIndexForSentence(nextIdx);
      highlightCurrentSentence();
      return getCurrentSentence();
    }

    // Need to go to next page - loop until we find one with text
    let nextPage = currentPageRef.current + 1;
    while (nextPage <= pageCount) {
      const sentences = loadPageSentences(nextPage);
      if (sentences.length > 0) {
        currentSentenceIndexRef.current = 0;
        sentenceIndex.current = { x: 0, y: 0 };
        calculateBlockIndexForSentence(0);
        highlightCurrentSentence();
        return getCurrentSentence();
      }
      nextPage++;
    }

    return null; // End of document
  }, [
    pageCount,
    loadPageSentences,
    highlightCurrentSentence,
    getCurrentSentence,
    calculateBlockIndexForSentence,
  ]);

  const goToPreviousSentence = useCallback((): SentencePosition | null => {
    const prevIdx = currentSentenceIndexRef.current - 1;

    if (prevIdx < 0) {
      const prevPage = currentPageRef.current - 1;
      if (prevPage < 1) {
        // Stay at first
        currentSentenceIndexRef.current = 0;
        calculateBlockIndexForSentence(0);
        highlightCurrentSentence();
        return getCurrentSentence();
      }

      const sentences = loadPageSentences(prevPage);
      if (sentences.length === 0) return null;

      // Go to last sentence
      currentSentenceIndexRef.current = sentences.length - 1;
      calculateBlockIndexForSentence(currentSentenceIndexRef.current);

      highlightCurrentSentence();
      return getCurrentSentence();
    }

    currentSentenceIndexRef.current = prevIdx;
    calculateBlockIndexForSentence(prevIdx);

    highlightCurrentSentence();
    return getCurrentSentence();
  }, [
    loadPageSentences,
    highlightCurrentSentence,
    getCurrentSentence,
    calculateBlockIndexForSentence,
  ]);

  const startFromPage = useCallback(
    (pageNumber: number): SentencePosition | null => {
      let currentPage = pageNumber;
      while (currentPage <= pageCount) {
        const sentences = loadPageSentences(currentPage);
        if (sentences.length > 0) {
          currentSentenceIndexRef.current = 0;
          sentenceIndex.current = { x: 0, y: 0 };
          calculateBlockIndexForSentence(0);
          highlightCurrentSentence();
          return getCurrentSentence();
        }
        currentPage++;
      }
      return null;
    },
    [
      pageCount,
      loadPageSentences,
      highlightCurrentSentence,
      getCurrentSentence,
      calculateBlockIndexForSentence,
    ],
  );

  const startFromTextOnPage = useCallback(
    (
      pageNumber: number,
      selectedText: string,
      selectionBlockIndex?: number,
      selectionOffsetInBlock?: number,
    ): SentencePosition | null => {
      const sentences = loadPageSentences(pageNumber);
      if (sentences.length === 0) return null;

      const normalised = selectedText.trim().replace(/\s+/g, " ");
      let bestIdx = -1;

      // Use the exact block + char offset captured on mouseup to find
      // the sentence at the user's actual selection position.
      if (selectionBlockIndex !== undefined && selectionBlockIndex >= 0) {
        let absoluteCharOffset = 0;
        for (
          let i = 0;
          i < selectionBlockIndex && i < blockContentsRef.current.length;
          i++
        ) {
          absoluteCharOffset += (blockContentsRef.current[i] ?? "").length;
        }
        absoluteCharOffset += selectionOffsetInBlock ?? 0;

        const fullText = blockContentsRef.current.join("");
        let searchStart = 0;
        for (let i = 0; i < sentences.length; i++) {
          const pos = fullText.indexOf(sentences[i]!, searchStart);
          if (pos === -1) continue;
          const sentenceEnd = pos + sentences[i]!.length;
          if (
            absoluteCharOffset >= pos &&
            absoluteCharOffset < sentenceEnd
          ) {
            bestIdx = i;
            break;
          }
          if (pos > absoluteCharOffset && bestIdx === -1) {
            bestIdx = i;
            break;
          }
          searchStart = sentenceEnd;
        }

        if (bestIdx === -1 && sentences.length > 0) {
          bestIdx = sentences.length - 1;
        }
      }

      // Fallback: text-based matching
      if (bestIdx === -1) {
        for (let i = 0; i < sentences.length; i++) {
          const s = sentences[i]!;
          if (s.includes(normalised) || normalised.includes(s.trim())) {
            bestIdx = i;
            break;
          }
        }
      }

      // Fallback: partial overlap — find sentence with most shared words
      if (bestIdx === -1) {
        const selectedWords = new Set(normalised.toLowerCase().split(/\s+/));
        let bestScore = 0;
        for (let i = 0; i < sentences.length; i++) {
          const words = sentences[i]!.toLowerCase().split(/\s+/);
          const score = words.filter((w) => selectedWords.has(w)).length;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
      }

      if (bestIdx === -1) bestIdx = 0;

      currentSentenceIndexRef.current = bestIdx;
      sentenceIndex.current = { x: 0, y: bestIdx };
      calculateBlockIndexForSentence(bestIdx);
      highlightCurrentSentence();
      return getCurrentSentence();
    },
    [
      loadPageSentences,
      highlightCurrentSentence,
      getCurrentSentence,
      calculateBlockIndexForSentence,
    ],
  );

  const reset = useCallback(() => {
    currentPageRef.current = 1;
    currentSentenceIndexRef.current = 0;
    sentencesRef.current = [];
    blockIndex.current = { x: 0, y: 0 };
    sentenceIndex.current = { x: 0, y: 0 };
    blocksRef.current = [];
    blockContentsRef.current = [];
    blockLengthsRef.current = [];
    wordMapRef.current = [];
    removeAllHighlights();
  }, []);

  const scrollToCurrentSentence = useCallback(() => {
    const highlight =
      document.querySelector(`.${HIGHLIGHT_CLASS.sentence}`) ??
      document.querySelector(`.${HIGHLIGHT_CLASS_RSVP.sentence}`);
    if (highlight) {
      highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const highlightWord = useCallback(
    (charIndex: number, _charLength: number, spokenText?: string) => {
      // Build word map lazily on first call for this sentence
      if (wordMapRef.current.length === 0 && spokenText) {
        const sentence = sentencesRef.current[currentSentenceIndexRef.current];
        if (sentence) {
          wordMapRef.current = buildWordMap(sentence, spokenText);
        }
      }

      const map = wordMapRef.current;

      // Find which mapped word contains this charIndex in the cleaned text
      for (const entry of map) {
        if (charIndex >= entry.cleanedOffset && charIndex < entry.cleanedEnd) {
          if (entry.parts && entry.parts.length > 1) {
            entry.parts.forEach((part, idx) => {
              highlightWordInSentence(
                part.originalOffset,
                part.originalLength,
                "tts",
                idx === 0,
              );
            });
          } else {
            highlightWordInSentence(
              entry.originalOffset,
              entry.originalLength,
              "tts",
            );
          }
          return;
        }
      }
    },
    [highlightWordInSentence],
  );

  // Reset word tracking when starting a new sentence
  const resetWordTracking = useCallback(() => {
    sentenceIndex.current.x = 0;
    wordMapRef.current = [];
  }, []);

  // Reset blockIndex to the start of the current sentence (for speed change, voice change, restart)
  const resetToCurrentSentenceStart = useCallback(
    (mode: HighlightMode = "tts") => {
      const currentIdx = currentSentenceIndexRef.current;
      calculateBlockIndexForSentence(currentIdx);
      sentenceIndex.current.x = 0;
      wordMapRef.current = [];
      highlightCurrentSentence(mode);
    },
    [calculateBlockIndexForSentence, highlightCurrentSentence],
  );

  const refreshHighlights = useCallback(
    (mode?: HighlightMode) => {
      if (blocksRef.current.length === 0) return;

      const modeToUse = mode ?? lastHighlightModeRef.current;
      const pageNumber = currentPageRef.current;
      const savedSentenceIdx = currentSentenceIndexRef.current;
      const savedBlockIndex = { ...blockIndex.current };
      const savedSentenceIndex = { ...sentenceIndex.current };

      loadPageSentences(pageNumber);

      if (sentencesRef.current.length === 0) return;

      currentSentenceIndexRef.current = savedSentenceIdx;
      calculateBlockIndexForSentence(savedSentenceIdx);
      highlightCurrentSentence(modeToUse);

      // Restore word position so next word boundary continues from where it was
      blockIndex.current = savedBlockIndex;
      sentenceIndex.current = savedSentenceIndex;
    },
    [
      loadPageSentences,
      calculateBlockIndexForSentence,
      highlightCurrentSentence,
    ],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const pageNumber = (e as CustomEvent).detail?.pageNumber;
      if (blocksRef.current.length === 0) return;
      if (pageNumber !== undefined && pageNumber !== currentPageRef.current)
        return;
      refreshHighlights();
    };

    document.addEventListener("pdf:textlayerrendered", handler);
    return () => document.removeEventListener("pdf:textlayerrendered", handler);
  }, [refreshHighlights]);

  const getTotalSentences = useCallback(() => sentencesRef.current.length, []);
  const getCurrentIndex = useCallback(
    () => currentSentenceIndexRef.current,
    [],
  );
  const getCurrentPage = useCallback(() => currentPageRef.current, []);
  const getSentences = useCallback(() => sentencesRef.current, []);

  return {
    startFromPage,
    startFromTextOnPage,
    advanceToNextSentence,
    goToPreviousSentence,
    getCurrentSentence,
    reset,
    highlightCurrentSentence,
    highlightWord,
    highlightWordByIndex,
    highlightWordInSentence,
    resetWordTracking,
    resetToCurrentSentenceStart,
    scrollToCurrentSentence,
    removeAllHighlights,
    refreshHighlights,
    getTotalSentences,
    getCurrentIndex,
    getCurrentPage,
    getSentences,
    highlightInsideSameBlockByIndexes,
    blockIndex,
    sentenceIndex,
    blockContentsRef,
    blockLengthsRef,
    blocksRef,
  };
}

// HIGHLIGHT SELF-CORRECTING MECHANISM
// NOT USED ANYMORE

// const highlightWord = useCallback(
//   (charIndex: number, charLength: number, spokenText?: string) => {
//     // Get the expected word from the spoken text (cleaned sentence)
//     const expectedWord =
//       spokenText?.substring(charIndex, charIndex + charLength)?.trim() ?? "";

//     // Get current block text
//     const currentBlockText =
//       blockContentsRef.current[blockIndex.current.y] ?? "";

//     // Try to find the expected word near current position with self-correction
//     let startX = blockIndex.current.x;
//     let blockY = blockIndex.current.y;
//     let foundMatch = false;

//     // Search within a range of positions to find the word
//     const MAX_SEARCH_RANGE = 10;

//     for (
//       let offset = 0;
//       offset <= MAX_SEARCH_RANGE && !foundMatch;
//       offset++
//     ) {
//       // Try current position + offset
//       for (const delta of offset === 0 ? [0] : [-offset, offset]) {
//         const tryX = blockIndex.current.x + delta;
//         const tryBlockText = blockContentsRef.current[blockY] ?? "";

//         if (tryX >= 0 && tryX < tryBlockText.length) {
//           const wordAtPos = tryBlockText
//             .substring(tryX, tryX + charLength)
//             .trim();
//           if (wordAtPos === expectedWord) {
//             startX = tryX;
//             foundMatch = true;
//             break;
//           }
//         }
//       }

//       // If word might span blocks or be in next block
//       if (!foundMatch && offset > 0) {
//         const nextBlockY = blockY + 1;
//         if (nextBlockY < blockContentsRef.current.length) {
//           const nextBlockText = blockContentsRef.current[nextBlockY] ?? "";
//           for (
//             let tryX = 0;
//             tryX < Math.min(MAX_SEARCH_RANGE, nextBlockText.length);
//             tryX++
//           ) {
//             const wordAtPos = nextBlockText
//               .substring(tryX, tryX + charLength)
//               .trim();
//             if (wordAtPos === expectedWord) {
//               blockY = nextBlockY;
//               startX = tryX;
//               foundMatch = true;
//               break;
//             }
//           }
//         }
//       }
//     }

//     // Skip leading space at highlight position
//     const blockText = blockContentsRef.current[blockY] ?? "";
//     if (blockText[startX] === " " && startX + 1 < blockText.length) {
//       startX += 1;
//     }

//     // Update blockIndex to the found position
//     blockIndex.current.x = startX;
//     blockIndex.current.y = blockY;

//     // Highlight the word
//     highlightInsideSameBlockByIndexes({
//       startIndex: startX,
//       endIndex: startX + charLength,
//       type: "word",
//       blockYIndex: blockY,
//     });

//     // Advance position for next word
//     blockIndex.current.x = startX + charLength;

//     // Handle block overflow
//     while (
//       blockIndex.current.y < blockLengthsRef.current.length &&
//       blockIndex.current.x >=
//         (blockLengthsRef.current[blockIndex.current.y] ?? 0)
//     ) {
//       blockIndex.current.x -=
//         blockLengthsRef.current[blockIndex.current.y] ?? 0;
//       blockIndex.current.y += 1;
//     }

//     // Update sentence tracking
//     sentenceIndex.current.x = charIndex + charLength;
//   },
//   [highlightInsideSameBlockByIndexes],
// );
