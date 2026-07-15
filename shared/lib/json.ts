// Parse JSON out of a model's text response for endpoints that don't support
// native JSON mode. Tries the whole string first, then strips a markdown code
// fence, then isolates the outermost {...} / [...]. Throws if nothing parses —
// callers validate the shape with zod afterwards.
export function parseJsonLoose(text: string): unknown {
  const attempts = [text, stripCodeFence(text), isolateBrackets(text)];
  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new Error("Model did not return valid JSON.");
}

function stripCodeFence(text: string): string | null {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : null;
}

// Isolate the outermost bracketed value, preferring whichever of `[` / `{`
// appears first (a JSON array vs object), so leading/trailing prose is dropped.
function isolateBrackets(text: string): string | null {
  const t = stripCodeFence(text) ?? text.trim();
  const firstArray = t.indexOf("[");
  const firstObject = t.indexOf("{");
  const useArray =
    firstArray !== -1 && (firstObject === -1 || firstArray < firstObject);
  const [open, close] = useArray ? ["[", "]"] : ["{", "}"];
  const start = t.indexOf(open);
  const end = t.lastIndexOf(close);
  if (start === -1 || end === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}
