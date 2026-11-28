import { useDemoDocStore } from "@/lib/demo/store";
import { HighlightColor } from "@prisma/client";
import { HIGHLIGHT_COLORS } from "@uxie/shared/lib/highlight-colors";
import { usePdfSettingsStore } from "@uxie/shared/lib/store";
import { describe, expect, it } from "vitest";

const rect = { x1: 1, y1: 2, x2: 3, y2: 4, width: 10, height: 10, pageNumber: 1 };

describe("highlight colours", () => {
  it("matches the database enum", () => {
    expect(Object.values(HighlightColor)).toEqual([...HIGHLIGHT_COLORS]);
  });

  it("remembers the last colour used across reloads", async () => {
    usePdfSettingsStore.getState().setHighlightColor("blue");
    await usePdfSettingsStore.persist.rehydrate();
    expect(usePdfSettingsStore.getState().highlightColor).toBe("blue");
  });

  it("reads demo highlights saved before colours existed as yellow", async () => {
    localStorage.setItem(
      "uxie-demo-doc",
      JSON.stringify({
        state: { highlights: [{ id: "old", position: { boundingRect: rect, rects: [rect], pageNumber: 1 } }] },
        version: 0,
      }),
    );
    await useDemoDocStore.persist.rehydrate();
    expect(useDemoDocStore.getState().highlights.map((h) => h.color)).toEqual(["yellow"]);
  });

  it("recolours a demo highlight and keeps the change on reload", async () => {
    useDemoDocStore.getState().recolorHighlight("old", "green");
    await useDemoDocStore.persist.rehydrate();
    expect(useDemoDocStore.getState().highlights[0]?.color).toBe("green");
  });
});
