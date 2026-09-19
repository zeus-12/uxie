import DocCard from "@/components/workspace/doc-card";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | false>) =>
    classes.filter(Boolean).join(" "),
}));

vi.stubGlobal("React", React);

describe("web document card", () => {
  it("renders an article cover from an arbitrary public hostname", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    expect(() => {
      flushSync(() =>
        root.render(
          React.createElement(DocCard, {
            title: "Why I built Uxie",
            id: "article-id",
            isCollab: false,
            isVectorised: false,
            coverImageUrl: "https://vishnuu.com/me.png",
            pageCount: 0,
            lastReadPage: null,
          }),
        ),
      );
    }).not.toThrow();

    const cover = container.querySelector("img");
    expect(cover?.getAttribute("src")).toBe("https://vishnuu.com/me.png");

    flushSync(() => root.unmount());
  });
});
