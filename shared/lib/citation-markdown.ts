import type { CitationIndex } from "./chat";

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

export const CITATION_REF_TAG = "cite";
export const CITATION_SOURCES_TAG = "footer";

const CITATION_GROUP = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const LITERAL_CONTAINERS = new Set(["link", "linkReference"]);

function citationNode(ref: number, label: number): MdNode {
  return {
    type: "citationRef",
    children: [],
    data: {
      hName: CITATION_REF_TAG,
      hProperties: { dataRef: String(ref), dataLabel: String(label) },
    },
  };
}

function splitCitations(
  value: string,
  cite: (ref: number) => MdNode | null,
): MdNode[] | null {
  const nodes: MdNode[] = [];
  let last = 0;
  for (const match of value.matchAll(CITATION_GROUP)) {
    const refs = match[1]!.split(",").map((ref) => Number(ref.trim()));
    const cited = refs.flatMap((ref) => cite(ref) ?? []);
    if (!cited.length) continue;
    if (match.index > last) {
      nodes.push({ type: "text", value: value.slice(last, match.index) });
    }
    nodes.push(...cited);
    last = match.index + match[0].length;
  }
  if (!nodes.length) return null;
  if (last < value.length)
    nodes.push({ type: "text", value: value.slice(last) });
  return nodes;
}

function transform(node: MdNode, cite: (ref: number) => MdNode | null) {
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
    const cite = (ref: number) => {
      if (!citations.has(ref)) return null;
      if (!order.includes(ref)) order.push(ref);
      return citationNode(ref, order.indexOf(ref) + 1);
    };
    transform(tree, cite);
    if (!order.length) return;
    tree.children?.push({
      type: "citationSources",
      children: [],
      data: {
        hName: CITATION_SOURCES_TAG,
        hProperties: { dataRefs: order.join(",") },
      },
    });
  };
}
