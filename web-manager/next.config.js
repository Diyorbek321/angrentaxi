/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  swcMinify: true,
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
