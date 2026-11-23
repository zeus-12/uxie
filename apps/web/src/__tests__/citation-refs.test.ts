import { describe, expect, it, vi } from "vitest";

const update = vi.fn();
vi.mock("@/server/db", () => ({ prisma: { document: { update } } }));

const { numberPassagesForDocument } = await import("@/lib/citation-refs");

const chunk = (page: number) => ({
  kind: "pdf" as const,
  pageContent: `page ${page}`,
  pageNumber: page,
});

describe("numberPassagesForDocument", () => {
  it("numbers passages from the block the database hands out", async () => {
    update.mockResolvedValueOnce({ nextCitationRef: 8 });
    expect(
      await numberPassagesForDocument("doc", [chunk(1), chunk(2), chunk(3)]),
    ).toEqual([
      { ...chunk(1), ref: 5 },
      { ...chunk(2), ref: 6 },
      { ...chunk(3), ref: 7 },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: "doc" },
      data: { nextCitationRef: { increment: 3 } },
      select: { nextCitationRef: true },
    });
  });

  it("reserves nothing when there is nothing to number", async () => {
    update.mockClear();
    expect(await numberPassagesForDocument("doc", [])).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });
});
