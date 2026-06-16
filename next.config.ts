import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  /* Any other existing configuration options you already had go here */
};

export default nextConfig;