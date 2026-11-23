import { selectedSlices } from "@uxie/shared/components/pdf-reader/reflow/selection";
import { describe, expect, it } from "vitest";

const run = (page: number, item: number, start: number, text: string) =>
  `<span data-run="${page}:${item}" data-run-start="${start}">${text}</span>`;

describe("reflow selection → pdf.js item offsets", () => {
  it("maps a selection across runs, separators and pages to item slices", () => {
    document.body.innerHTML = `<div id="root">
      <section data-reflow-page="1"><p>${run(1, 4, 0, "reading with")} ${run(1, 5, 2, "your hands.")}</p></section>
      <section data-reflow-page="2"><p>${run(2, 0, 0, "Underline the claim")}</p></section>
    </div>`;
    const root = document.getElementById("root")!;
    const [a, b, c] = [...root.querySelectorAll("[data-run]")].map((el) => el.firstChild as Text);
    const range = document.createRange();
    range.setStart(a!, 8);
    range.setEnd(c!, 9);
    expect(selectedSlices(root, range)).toEqual([
      { pageNumber: 1, itemIndex: 4, from: 8, to: 12 },
      { pageNumber: 1, itemIndex: 5, from: 2, to: 2 + b!.length },
      { pageNumber: 2, itemIndex: 0, from: 0, to: 9 },
    ]);
  });

  it("offsets inside a run account for the part of the item it doesn't show", () => {
    document.body.innerHTML = `<div id="root">${run(3, 7, 5, "<mark>sur</mark>prises")}</div>`;
    const root = document.getElementById("root")!;
    const marked = root.querySelector("mark")!.firstChild as Text;
    const rest = root.querySelector("[data-run]")!.lastChild as Text;
    const range = document.createRange();
    range.setStart(marked, 1);
    range.setEnd(rest, 3);
    expect(selectedSlices(root, range)).toEqual([{ pageNumber: 3, itemIndex: 7, from: 6, to: 11 }]);
  });
});
