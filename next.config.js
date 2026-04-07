/** @type {import('next').NextConfig} */
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
};
module.exports = nextConfig;
