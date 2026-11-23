import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/reflow-corpus.mjs <folder of PDFs>");
  process.exit(1);
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/reflow-corpus");
mkdirSync(out, { recursive: true });

const entries = [];
for (const file of readdirSync(source).filter((f) => f.endsWith(".pdf")).sort()) {
  const path = join(source, file);
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  copyFileSync(path, join(out, file));
  entries.push({ name: basename(file, ".pdf"), pageCount: doc.numPages });
  await doc.destroy();
}
writeFileSync(join(out, "index.json"), JSON.stringify(entries, null, 2));
console.log(`${entries.length} PDFs → ${out}`);
