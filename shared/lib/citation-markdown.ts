import type { CitationIndex } from "./chat";

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

export const CITATION_GROUP_TAG = "cite";

const CITATION_TOKEN = /\[ref:\s*(\d+(?:\s*,\s*(?:ref:\s*)?\d+)*)\]/g;
const LITERAL_CONTAINERS = new Set(["link", "linkReference"]);

function citationGroupNode(refs: number[]): MdNode {
  return {
    type: "citationGroup",
    children: [],
    data: {
      hName: CITATION_GROUP_TAG,
      hProperties: { dataRefs: refs.join(",") },
    },
  };
}

// The token is ours, never document text, so refs naming no retrieved passage are dropped rather than shown.
function splitCitations(value: string, citations: CitationIndex): MdNode[] {
  const nodes: MdNode[] = [];
  let group: number[] = [];
  let groupEnd = -1;
  let last = 0;
  let inRun = false;
  const flush = () => {
    if (group.length) nodes.push(citationGroupNode(group));
    else if (inRun && nodes.at(-1)?.type === "text") {
      nodes.at(-1)!.value = nodes.at(-1)!.value!.trimEnd();
    }
    group = [];
    inRun = false;
  };
  for (const match of value.matchAll(CITATION_TOKEN)) {
    if (match.index !== groupEnd) flush();
    if (match.index > last) {
      nodes.push({ type: "text", value: value.slice(last, match.index) });
    }
    for (const ref of match[1]!.match(/\d+/g)!.map(Number)) {
      if (citations.has(ref) && !group.includes(ref)) group.push(ref);
    }
    inRun = true;
    last = groupEnd = match.index + match[0].length;
  }
  flush();
  if (last < value.length)
    nodes.push({ type: "text", value: value.slice(last) });
  return nodes;
}

function transform(node: MdNode, citations: CitationIndex) {
  if (!node.children || LITERAL_CONTAINERS.has(node.type)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value) {
      return splitCitations(child.value, citations);
    }
    transform(child, citations);
    return [child];
  });
}

export function remarkCitations(citations: CitationIndex) {
  return () => (tree: MdNode) => transform(tree, citations);
}
