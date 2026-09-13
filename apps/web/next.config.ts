import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a pnpm monorepo. Next 16's Turbopack builder otherwise
  // misinfers the workspace root and fails the build ("couldn't find the Next.js
  // package..."). Pin the root to THIS app directory so it resolves correctly.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
