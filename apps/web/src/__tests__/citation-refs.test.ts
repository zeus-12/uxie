import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  document: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  message: { findMany: vi.fn() },
}));
vi.mock("@/server/db", () => ({ prisma: db }));

const { numberPassagesForDocument } = await import("@/lib/citation-refs");

const chunk = (page: number) => ({
  kind: "pdf" as const,
  pageContent: `page ${page}`,
  pageNumber: page,
});

const storedTurn = (refs: number[]) => ({
  parts: [
    {
      type: "tool-result",
      toolCallId: "call",
      toolName: "getInformation",
      result: { results: refs.map((ref) => ({ ...chunk(ref), ref })) },
    },
  ],
});

beforeEach(() => vi.clearAllMocks());

describe("numberPassagesForDocument", () => {
  it("numbers passages from the block the database hands out", async () => {
    db.document.findUniqueOrThrow.mockResolvedValue({ nextCitationRef: 5 });
    db.document.update.mockResolvedValue({ nextCitationRef: 8 });

    expect(
      await numberPassagesForDocument("doc", [chunk(1), chunk(2), chunk(3)]),
    ).toEqual([
      { ...chunk(1), ref: 5 },
      { ...chunk(2), ref: 6 },
      { ...chunk(3), ref: 7 },
    ]);
    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: "doc" },
      data: { nextCitationRef: { increment: 3 } },
      select: { nextCitationRef: true },
    });
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it("starts an unseeded document above the refs its stored chat already uses", async () => {
    db.document.findUniqueOrThrow.mockResolvedValue({ nextCitationRef: 0 });
    db.message.findMany.mockResolvedValue([
      storedTurn([1, 2]),
      storedTurn([3, 6]),
    ]);
    db.document.update.mockResolvedValue({ nextCitationRef: 8 });

    await numberPassagesForDocument("doc", [chunk(1)]);

    expect(db.document.updateMany).toHaveBeenCalledWith({
      where: { id: "doc", nextCitationRef: 0 },
      data: { nextCitationRef: 7 },
    });
    expect(db.document.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.document.update.mock.invocationCallOrder[0]!,
    );
  });

  it("reserves nothing when there is nothing to number", async () => {
    expect(await numberPassagesForDocument("doc", [])).toEqual([]);
    expect(db.document.update).not.toHaveBeenCalled();
  });
});
