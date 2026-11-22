import { createHash } from "node:crypto";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";

const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figcaption,td,th";

const absoluteUrl = (value: string, baseUrl: string) => {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
};

const sanitizeArticleHtml = (html: string, baseUrl: string) => {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      "article",
      "section",
      "div",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "figure",
      "figcaption",
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "hr",
      "br",
      "sup",
      "sub",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...(attributes.title ? { title: attributes.title } : {}),
          href: absoluteUrl(attributes.href ?? "", baseUrl),
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: {
          ...(attributes.alt ? { alt: attributes.alt } : {}),
          ...(attributes.title ? { title: attributes.title } : {}),
          ...(attributes.width ? { width: attributes.width } : {}),
          ...(attributes.height ? { height: attributes.height } : {}),
          src: absoluteUrl(attributes.src ?? "", baseUrl),
          loading: "lazy",
        },
      }),
    },
    exclusiveFilter: ({ tag, attribs }) =>
      (tag === "a" && !attribs.href) || (tag === "img" && !attribs.src),
  });

  const dom = new JSDOM(`<main>${sanitized}</main>`);
  const blocks = Array.from(
    dom.window.document.querySelectorAll(BLOCK_SELECTOR),
  ).filter((element) => !element.querySelector(BLOCK_SELECTOR));
  blocks.forEach((element, index) => {
    element.setAttribute("data-uxie-block-id", `block-${index + 1}`);
  });

  return dom.window.document.querySelector("main")?.innerHTML ?? "";
};

export type ExtractedArticle = {
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  canonicalUrl: string;
  coverImageUrl: string;
  wordCount: number;
  contentHtml: string;
  textContent: string;
  contentHash: string;
};

export const extractArticle = ({
  html,
  url,
}: {
  html: string;
  url: string;
}): ExtractedArticle => {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const canonicalUrl = absoluteUrl(
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
      url,
    url,
  );
  const coverImageUrl = absoluteUrl(
    document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
      ?.content ?? "",
    url,
  );
  const article = new Readability(document).parse();

  if (!article?.title || !article.content || !article.textContent) {
    throw new Error("Uxie could not find a readable article on this page.");
  }

  const textContent = article.textContent.replace(/\s+/g, " ").trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    throw new Error(
      "This page does not contain enough article text to import.",
    );
  }

  const contentHtml = sanitizeArticleHtml(article.content, url);
  if (!contentHtml) {
    throw new Error("Uxie could not create a safe reader view for this page.");
  }

  return {
    title: article.title.trim(),
    byline: article.byline?.trim() || null,
    siteName: article.siteName?.trim() || null,
    excerpt: article.excerpt?.trim() || null,
    canonicalUrl: canonicalUrl || url,
    coverImageUrl,
    wordCount,
    contentHtml,
    textContent,
    contentHash: createHash("sha256").update(contentHtml).digest("hex"),
  };
};

export const getArticleBlockText = ({
  contentHtml,
  blockId,
}: {
  contentHtml: string;
  blockId: string;
}) => {
  const dom = new JSDOM(`<main>${contentHtml}</main>`);
  return (
    dom.window.document.querySelector(`[data-uxie-block-id="${blockId}"]`)
      ?.textContent ?? null
  );
};
