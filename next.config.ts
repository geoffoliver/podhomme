import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['chonk.local'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
};

export default nextConfig;
