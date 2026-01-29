import TerserPlugin from "terser-webpack-plugin";

await import("./src/env.mjs");

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    esmExternals: "loose",
  },
  images: {
    domains: ["lh3.googleusercontent.com", "utfs.io"],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cross-Origin-Embedder-Policy",
          value: "require-corp",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
      ],
    },
  ],

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // for "scribe.js-ocr" library (DO NOT REMOVE)
      config.plugins.push(
        new webpack.DefinePlugin({
          process: "undefined",
        }),
      );

      // for "kokoro-js" library (DO NOT REMOVE) -> issue w onnxruntime
      config.optimization.minimizer = [
        new TerserPlugin({
          exclude: /ort\..*\.mjs$/,
          terserOptions: {
            compress: true,
            mangle: true,
          },
        }),
      ];
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };

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
