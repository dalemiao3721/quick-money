import type { NextConfig } from "next";
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  turbopack: {},
  output: 'standalone',
};

export default withPWA(nextConfig);
