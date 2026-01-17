// @ts-expect-error
import { withGlobalCss } from "next-global-css";

await import("./src/env.mjs");

const withConfig = withGlobalCss();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com", "utfs.io"],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          process: "undefined",
        }),
      );
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /scribe\.js-ocr/,
        message: /topLevelAwait|async\/await/,
      },
    ];

    return config;
  },
};

export default config;
// export default withConfig(config);
