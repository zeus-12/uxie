import { THEME_BOOTSTRAP_SCRIPT } from "@uxie/shared/lib/theme";
import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
