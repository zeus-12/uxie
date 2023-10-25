// @ts-expect-error
import { withGlobalCss } from "next-global-css";

await import("./src/env.mjs");

const withConfig = withGlobalCss();

const config = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com"],
  },

  // https://huggingface.co/docs/transformers.js/tutorials/next => for HuggingFaceTransformersEmbeddings
  // @ts-ignore
  webpack: (config) => {
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ["sharp", "onnxruntime-node"],
  },
};

export default withConfig(config);
