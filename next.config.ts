import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone-сборка — для самостоятельного запуска (VPS/локально);
  // на Vercel обычная сборка (команду сборки задаёт vercel.json)
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
