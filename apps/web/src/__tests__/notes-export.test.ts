import { BlockNoteEditor } from "@blocknote/core";
import { schema } from "@uxie/shared/lib/editor-utils";
import { notesFilename, notesToMarkdown } from "@uxie/shared/lib/notes-export";
import { describe, expect, it } from "vitest";

describe("notesToMarkdown", () => {
  it("converts the editor's blocks to markdown", async () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [
        { type: "heading", props: { level: 1 }, content: "Chapter one" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Plain and ", styles: {} },
            { type: "text", text: "bold", styles: { bold: true } },
          ],
        },
        { type: "bulletListItem", content: "First point" },
      ],
    });

    const markdown = await notesToMarkdown(editor);

    expect(markdown).toBe(
      "# Chapter one\n\nPlain and **bold**\n\n*   First point\n",
    );
  });

  it("passes every file url through the resolver, nested blocks included", async () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [
        {
          type: "paragraph",
          content: "Figure",
          children: [
            { type: "image", props: { url: "uxie-pdf://image/doc/figure" } },
          ],
        },
        { type: "image", props: { url: "https://example.com/remote.png" } },
      ],
    });
    const resolved: string[] = [];

    const markdown = await notesToMarkdown(editor, async (url) => {
      resolved.push(url);
      return url.startsWith("uxie-pdf:") ? "data:image/png;base64,AAAA" : url;
    });

    expect(resolved.sort()).toEqual([
      "https://example.com/remote.png",
      "uxie-pdf://image/doc/figure",
    ]);
    expect(markdown).toContain("(data:image/png;base64,AAAA)");
    expect(markdown).toContain("(https://example.com/remote.png)");
    expect(markdown).not.toContain("uxie-pdf:");
  });
});

describe("notesFilename", () => {
  it("names the file after the document", () => {
    expect(notesFilename("Research.pdf")).toBe("Research notes.md");
    expect(notesFilename("Q3: plans/goals")).toBe("Q3- plans-goals notes.md");
  });

  it("falls back when the document has no title", () => {
    expect(notesFilename(null)).toBe("document notes.md");
    expect(notesFilename("   ")).toBe("document notes.md");
  });
});
