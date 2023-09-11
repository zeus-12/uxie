// @ts-expect-error
import { withGlobalCss } from "next-global-css";

await import("./src/env.mjs");

const withConfig = withGlobalCss();

const config = {
  reactStrictMode: true,
};

export default withConfig(config);
// export default config;
