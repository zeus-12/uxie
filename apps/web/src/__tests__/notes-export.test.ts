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
