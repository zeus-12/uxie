import {
  useArticleSettingsStore,
  usePdfSettingsStore,
} from "@uxie/shared/lib/store";
import { describe, expect, it } from "vitest";

async function rehydratePdf(pageColour: unknown) {
  localStorage.setItem(
    "pdf-settings",
    JSON.stringify({ state: { pageColour }, version: 0 }),
  );
  await usePdfSettingsStore.persist.rehydrate();
  return usePdfSettingsStore.getState().pageColour;
}

async function rehydrateArticle(backgroundColour: unknown) {
  localStorage.setItem(
    "article-settings",
    JSON.stringify({ state: { backgroundColour }, version: 0 }),
  );
  await useArticleSettingsStore.persist.rehydrate();
  return useArticleSettingsStore.getState().backgroundColour;
}

describe("page colour migration", () => {
  it("maps the old white default to the theme page", async () => {
    expect(await rehydratePdf("#FFF")).toBe("theme");
    expect(await rehydrateArticle("#FFF")).toBe("theme");
  });

  it("keeps a known tint", async () => {
    expect(await rehydratePdf("#DBEAFE")).toBe("#DBEAFE");
    expect(await rehydrateArticle("#FEF9C3")).toBe("#FEF9C3");
  });

  it("drops values that are not a page colour", async () => {
    expect(await rehydratePdf("#fff")).toBe("theme");
    expect(await rehydratePdf(undefined)).toBe("theme");
    expect(await rehydrateArticle("rebeccapurple")).toBe("theme");
  });
});
