import { normalizeWhitespace, type NormalizedText } from "./tts/utils";
import type { PdfPageText } from "./chat";

export type PdfTextLayerModel = {
  pageElement: Element;
  blocks: Element[];
  // Zero for whitespace-only blocks. Separating spaces are synthetic and do not
  // belong to a DOM node, so the offset mapper skips over them.
  blockRawLens: number[];
  blockStarts: number[];
  norm: NormalizedText;
};

export function buildPdfTextLayerModel(
  pageElement: Element,
): PdfTextLayerModel {
  const blocks = Array.from(
    pageElement.querySelectorAll("span[role='presentation']"),
  );
  const blockRawLens: number[] = [];
  const blockStarts: number[] = [];
  let rawText = "";

  for (const block of blocks) {
    const text = block.textContent ?? "";
    blockStarts.push(rawText.length);
    if (text.trim().length === 0) {
      blockRawLens.push(0);
      continue;
    }
    blockRawLens.push(text.length);
    rawText += /\s$/.test(text) ? text : `${text} `;
  }

  return {
    pageElement,
    blocks,
    blockRawLens,
    blockStarts,
    norm: normalizeWhitespace(rawText),
  };
}

function normalizedRangeToRaw(
  norm: NormalizedText,
  start: number,
  end: number,
): [number, number] | null {
  if (start < 0 || end <= start || end > norm.toRaw.length) return null;
  return [norm.toRaw[start]!, norm.toRaw[end - 1]! + 1];
}

function rawPositionToDom(
  model: PdfTextLayerModel,
  rawPosition: number,
  atEnd: boolean,
): { node: Node; offset: number } | null {
  for (let index = 0; index < model.blocks.length; index++) {
    const length = model.blockRawLens[index]!;
    if (length === 0) continue;
    const start = model.blockStarts[index]!;
    const end = start + length;
    const inside = atEnd
      ? rawPosition > start && rawPosition <= end
      : rawPosition >= start && rawPosition < end;
    if (!inside) continue;

    const node = model.blocks[index]!.firstChild;
    return node ? { node, offset: rawPosition - start } : null;
  }

  if (atEnd) {
    for (let index = model.blocks.length - 1; index >= 0; index--) {
      const length = model.blockRawLens[index]!;
      if (length === 0) continue;
      const end = model.blockStarts[index]! + length;
      const node = model.blocks[index]!.firstChild;
      if (end <= rawPosition && node) return { node, offset: length };
    }
  } else {
    for (let index = 0; index < model.blocks.length; index++) {
      const length = model.blockRawLens[index]!;
      if (length === 0) continue;
      const node = model.blocks[index]!.firstChild;
      if (model.blockStarts[index]! >= rawPosition && node) {
        return { node, offset: 0 };
      }
    }
  }
  return null;
}

export function normalizedRangeToDomRange(
  model: PdfTextLayerModel,
  start: number,
  end: number,
): Range | null {
  const rawRange = normalizedRangeToRaw(model.norm, start, end);
  if (!rawRange) return null;

  const domStart = rawPositionToDom(model, rawRange[0], false);
  const domEnd = rawPositionToDom(model, rawRange[1], true);
  if (!domStart || !domEnd) return null;

  const range = document.createRange();
  try {
    range.setStart(domStart.node, domStart.offset);
    range.setEnd(domEnd.node, domEnd.offset);
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

export function normalizePdfText(text: string): string {
  return normalizeWhitespace(text).text.trim();
}

export function findUniquePdfPageNumber(
  pageContent: string,
  pages: PdfPageText[],
): number | null {
  const chunk = normalizePdfText(pageContent);
  if (!chunk) return null;
  const matches = pages.filter((page) =>
    normalizePdfText(page.text).includes(chunk),
  );
  return matches.length === 1 ? matches[0]!.pageNumber : null;
}

/** Exact after PDF whitespace normalization. No word-overlap or fuzzy fallback. */
export function findExactPdfTextRange(
  pageElement: Element,
  text: string,
): Range | null {
  const query = normalizePdfText(text);
  if (!query) return null;

  const model = buildPdfTextLayerModel(pageElement);
  const start = model.norm.text.indexOf(query);
  if (start < 0) return null;
  return normalizedRangeToDomRange(model, start, start + query.length);
}
