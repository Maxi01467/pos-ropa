import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  outputFileTracingExcludes: {
    "*": [
      "./dist/**/*",
      "./build/**/*",
      "./backups/**/*",
      "./data-migration/**/*",
    ],
  },
  experimental: {
    webpackBuildWorker: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.next/**",
          "**/dist/**",
          "**/build/**",
          "**/backups/**",
          "**/data-migration/**",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
