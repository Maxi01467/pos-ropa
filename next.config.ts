import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;
