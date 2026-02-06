import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Next.js 16 uses Turbopack by default; empty config silences "webpack config but no turbopack" error. */
  turbopack: {},
  webpack: (config) => {
    // @dagrejs/dagre uses dynamic require('@dagrejs/graphlib'); webpack can't statically extract it — suppress the warning
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules[\\/]@dagrejs[\\/]dagre/ },
    ];
    return config;
  },
};

export default nextConfig;
