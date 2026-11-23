import type { CitationIndex } from "./chat";

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

export const CITATION_GROUP_TAG = "cite";

const CITATION_BRACKET = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const LITERAL_CONTAINERS = new Set(["link", "linkReference"]);

type CitedRef = { ref: number; label: number };

function citationGroupNode(cited: CitedRef[]): MdNode {
  return {
    type: "citationGroup",
    children: [],
    data: {
      hName: CITATION_GROUP_TAG,
      hProperties: {
        dataRefs: cited.map(({ ref }) => ref).join(","),
        dataLabels: cited.map(({ label }) => label).join(","),
      },
    },
  };
}

function splitCitations(
  value: string,
  cite: (ref: number) => CitedRef | null,
): MdNode[] | null {
  const nodes: MdNode[] = [];
  let group: CitedRef[] = [];
  let groupEnd = -1;
  let last = 0;
  for (const match of value.matchAll(CITATION_BRACKET)) {
    const cited = match[1]!
      .split(",")
      .flatMap((ref) => cite(Number(ref.trim())) ?? []);
    if (!cited.length) continue;
    if (match.index !== groupEnd && group.length) {
      nodes.push(citationGroupNode(group));
      group = [];
    }
    if (match.index > last) {
      nodes.push({ type: "text", value: value.slice(last, match.index) });
    }
    for (const entry of cited) {
      if (!group.some(({ ref }) => ref === entry.ref)) group.push(entry);
    }
    last = groupEnd = match.index + match[0].length;
  }
  if (group.length) nodes.push(citationGroupNode(group));
  if (!nodes.length) return null;
  if (last < value.length)
    nodes.push({ type: "text", value: value.slice(last) });
  return nodes;
}

function transform(node: MdNode, cite: (ref: number) => CitedRef | null) {
  if (!node.children || LITERAL_CONTAINERS.has(node.type)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value) {
      return splitCitations(child.value, cite) ?? [child];
    }
    transform(child, cite);
    return [child];
  });
}

// A bracket naming no retrieved passage at all is ordinary text (e.g. "x[0]"), so it is left alone.
export function remarkCitations(citations: CitationIndex) {
  return () => (tree: MdNode) => {
    const order: number[] = [];
    transform(tree, (ref) => {
      if (!citations.has(ref)) return null;
      if (!order.includes(ref)) order.push(ref);
      return { ref, label: order.indexOf(ref) + 1 };
    });
  };
}
