import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export class ArticleFetchError extends Error {
  constructor(
    message: string,
    readonly kind: "invalid-url" | "unsafe-url" | "unsupported" | "failed",
  ) {
    super(message);
    this.name = "ArticleFetchError";
  }
}

const isPrivateIpv4 = (address: string) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
};

const isPrivateIpv6 = (address: string) => {
  const normalized = address.toLowerCase().split("%")[0] ?? "";
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("2001:db8:")
  ) {
    return true;
  }

  const firstGroup = Number.parseInt(normalized.split(":")[0] ?? "", 16);
  if (!Number.isFinite(firstGroup)) return true;

  const isUniqueLocal = (firstGroup & 0xfe00) === 0xfc00;
  const isLinkLocal = (firstGroup & 0xffc0) === 0xfe80;
  const isMulticast = (firstGroup & 0xff00) === 0xff00;
  const isGloballyRoutable = (firstGroup & 0xe000) === 0x2000;

  return isUniqueLocal || isLinkLocal || isMulticast || !isGloballyRoutable;
};

export const isPrivateIpAddress = (address: string) => {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
};

const parsePublicUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ArticleFetchError("Enter a valid web address.", "invalid-url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ArticleFetchError(
      "Only public HTTP and HTTPS pages are supported.",
      "invalid-url",
    );
  }
  if (url.username || url.password) {
    throw new ArticleFetchError(
      "Web addresses containing credentials are not supported.",
      "unsafe-url",
    );
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ArticleFetchError(
      "Web addresses using a custom port are not supported.",
      "unsafe-url",
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new ArticleFetchError(
      "Private network addresses are not supported.",
      "unsafe-url",
    );
  }

  return url;
};

const assertPublicHostname = async (url: URL) => {
  const literalIpVersion = isIP(url.hostname);
  if (literalIpVersion !== 0) {
    if (isPrivateIpAddress(url.hostname)) {
      throw new ArticleFetchError(
        "Private network addresses are not supported.",
        "unsafe-url",
      );
    }
    return;
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ArticleFetchError("The website could not be found.", "failed");
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIpAddress(address))
  ) {
    throw new ArticleFetchError(
      "Private network addresses are not supported.",
      "unsafe-url",
    );
  }
};

const readLimitedBody = async (response: Response, maxBytes: number) => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ArticleFetchError(
      "This page is too large to import.",
      "unsupported",
    );
  }

  if (!response.body) {
    throw new ArticleFetchError("The website returned no content.", "failed");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ArticleFetchError(
        "This page is too large to import.",
        "unsupported",
      );
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

export type FetchedPublicResource = {
  body: Uint8Array;
  finalUrl: string;
  contentType: string;
};

export const fetchPublicResource = async ({
  inputUrl,
  maxBytes,
}: {
  inputUrl: string;
  maxBytes: number;
}): Promise<FetchedPublicResource> => {
  let url = parsePublicUrl(inputUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertPublicHostname(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          "User-Agent": "Uxie Article Reader/1.0",
        },
      });
    } catch {
      throw new ArticleFetchError(
        "The website did not respond in time.",
        "failed",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ArticleFetchError(
          "The website returned a broken redirect.",
          "failed",
        );
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new ArticleFetchError(
          "The website redirected too many times.",
          "failed",
        );
      }
      url = parsePublicUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new ArticleFetchError(
        `The website returned HTTP ${response.status}.`,
        response.status === 401 || response.status === 403
          ? "unsupported"
          : "failed",
      );
    }

    return {
      body: await readLimitedBody(response, maxBytes),
      finalUrl: url.toString(),
      contentType: response.headers.get("content-type")?.toLowerCase() ?? "",
    };
  }

  throw new ArticleFetchError(
    "The website redirected too many times.",
    "failed",
  );
};

export type FetchedArticlePage = {
  html: string;
  finalUrl: string;
};

export const fetchArticlePage = async (
  inputUrl: string,
): Promise<FetchedArticlePage> => {
  const resource = await fetchPublicResource({
    inputUrl,
    maxBytes: MAX_HTML_BYTES,
  });
  if (
    !resource.contentType.includes("text/html") &&
    !resource.contentType.includes("application/xhtml+xml")
  ) {
    throw new ArticleFetchError(
      "This URL does not point to a readable web page.",
      "unsupported",
    );
  }
  return {
    html: new TextDecoder().decode(resource.body),
    finalUrl: resource.finalUrl,
  };
};
