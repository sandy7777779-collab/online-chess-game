import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors. This is needed for react-chessboard
    // incompatibilities with React 19 typings in Next 16.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
