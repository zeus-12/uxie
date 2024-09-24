// @ts-expect-error
import { withGlobalCss } from "next-global-css";

await import("./src/env.mjs");

const withConfig = withGlobalCss();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          process: "undefined",
        }),
      );
    }
    return config;
  },
};

export default config;
// export default withConfig(config);
