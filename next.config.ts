import type { NextConfig } from "next";
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  skipWaiting: true,       // 新 SW 立即接管，不等舊分頁關閉
  clientsClaim: true,      // 新 SW 立即控制所有分頁
  cleanupOutdatedCaches: true, // 自動清除舊版快取
});

const nextConfig: NextConfig = {
  turbopack: {},
  output: 'standalone',
};

export default withPWA(nextConfig);
