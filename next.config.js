/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap.xml",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
