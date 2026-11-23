export function exportFilename(title: string | null, suffix: string): string {
  const withoutExtension = (title ?? "").replace(/\.pdf$/i, "");
  const safeTitle = withoutExtension
    .replace(/[\u0000-\u001f/:]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${safeTitle || "document"} ${suffix}`;
}
