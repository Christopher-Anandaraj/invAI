import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
  },
};

export default nextConfig;