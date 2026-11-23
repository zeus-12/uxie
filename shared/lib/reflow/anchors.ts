import type { Run } from "./types";

export type ItemPoint = { itemIndex: number; offset: number };
export type ItemRange = { begin: ItemPoint; end: ItemPoint };

// Same walk as pdf.js 2.16 TextHighlighter._convertMatches, so a match lands on
// exactly the characters the canvas text layer would highlight.
export const convertMatches = (
  itemStrings: string[],
  matches: number[],
  lengths: number[],
): ItemRange[] => {
  const last = itemStrings.length - 1;
  const result: ItemRange[] = [];
  let i = 0;
  let iIndex = 0;
  for (let m = 0; m < matches.length; m++) {
    let matchIdx = matches[m]!;
    while (i !== last && matchIdx >= iIndex + itemStrings[i]!.length) {
      iIndex += itemStrings[i]!.length;
      i++;
    }
    const begin = { itemIndex: i, offset: matchIdx - iIndex };
    matchIdx += lengths[m]!;
    while (i !== last && matchIdx > iIndex + itemStrings[i]!.length) {
      iIndex += itemStrings[i]!.length;
      i++;
    }
    result.push({ begin, end: { itemIndex: i, offset: matchIdx - iIndex } });
  }
  return result;
};

export type RunSlice = { from: number; to: number };

export const sliceOfRun = (run: Run, range: ItemRange): RunSlice | null => {
  const { begin, end } = range;
  if (run.itemIndex < begin.itemIndex || run.itemIndex > end.itemIndex) return null;
  const from = run.itemIndex === begin.itemIndex ? Math.max(run.start, begin.offset) : run.start;
  const to = run.itemIndex === end.itemIndex ? Math.min(run.end, end.offset) : run.end;
  return to > from ? { from, to } : null;
};
