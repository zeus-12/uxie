import { describe, expect, it } from "vitest";

import { extractArticle } from "@/server/article/extract";

const articleHtml = `
  <!doctype html>
  <html>
    <head>
      <title>Ignored browser title</title>
      <link rel="canonical" href="/canonical-story" />
      <meta property="og:image" content="/cover.jpg" />
    </head>
    <body>
      <nav>Unrelated navigation</nav>
      <article>
        <h1>A useful test article</h1>
        <p>By Example Author</p>
        <p>This is the first paragraph of a deliberately long article fixture. It contains enough words for Readability to treat it as meaningful article content rather than a small navigation fragment.</p>
        <p>The second paragraph includes <a href="/details" onclick="alert('no')">a relative link</a>, an image, and more prose so the extractor has realistic material to process safely.</p>
        <img src="/photo.jpg" onerror="alert('no')" alt="Example" />
        <script>window.bad = true</script>
      </article>
    </body>
  </html>
`;

describe("extractArticle", () => {
  it("creates a sanitized, stable reader snapshot", () => {
    const article = extractArticle({
      html: articleHtml,
      url: "https://example.com/original",
    });

    expect(article.title).toBe("Ignored browser title");
    expect(article.canonicalUrl).toBe("https://example.com/canonical-story");
    expect(article.coverImageUrl).toBe("https://example.com/cover.jpg");
    expect(article.contentHtml).toContain('data-uxie-block-id="block-1"');
    expect(article.contentHtml).toContain('href="https://example.com/details"');
    expect(article.contentHtml).toContain('rel="noopener noreferrer"');
    expect(article.contentHtml).not.toContain("onclick");
    expect(article.contentHtml).not.toContain("onerror");
    expect(article.contentHtml).not.toContain("<script");
    expect(article.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
