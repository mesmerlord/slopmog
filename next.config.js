const { withSentryConfig } = require("@sentry/nextjs");

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

if (process.env.NODE_ENV === "production") {
  module.exports = withSentryConfig(nextConfig, {
    org: "slopmog",
    project: "slopmog",
    silent: true,
    hideSourceMaps: false,
    widenClientFileUpload: true,
    disableLogger: true,
  });
} else {
  module.exports = nextConfig;
}
