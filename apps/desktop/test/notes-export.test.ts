import { mkdir, mkdtemp, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { saveNotes } from "../src/main/notes-export";

describe("saveNotes", () => {
  it("writes the markdown to the chosen path and leaves no temp file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uxie-notes-export-"));
    const destinationPath = join(dir, "Research notes.md");

    const result = await saveNotes({
      markdown: "# Chapter one\n\nPlain and **bold**\n",
      libraryRoot: join(dir, "library"),
      destinationPath,
    });

    expect(result).toEqual({ status: "exported" });
    expect(await readFile(destinationPath, "utf8")).toBe(
      "# Chapter one\n\nPlain and **bold**\n",
    );
    expect(await readdir(dir)).toEqual(["Research notes.md"]);
  });

  it("reports a cancelled dialog without writing", async () => {
    expect(
      await saveNotes({
        markdown: "anything",
        libraryRoot: tmpdir(),
        destinationPath: null,
      }),
    ).toEqual({ status: "cancelled" });
  });

  it("refuses to write inside Uxie's library", async () => {
    const library = await mkdtemp(join(tmpdir(), "uxie-notes-library-"));
    await mkdir(join(library, "doc-a"));
    const destinationPath = join(library, "doc-a", "notes.md");

    await expect(
      saveNotes({ markdown: "x", libraryRoot: library, destinationPath }),
    ).rejects.toThrow("outside Uxie's library");
    expect(await readdir(join(library, "doc-a"))).toEqual([]);
  });
});
