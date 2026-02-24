import { NextApiRequest, NextApiResponse } from "next";

const WEBSITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://slopmog.com";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "text/plain");

  const host = req.headers.host || "";

  // Block crawlers on non-production environments
  if (host.includes("localhost") || host.includes("vercel.app")) {
    res.send(`User-agent: *
Disallow: /
`);
    return;
  }

  res.send(`User-agent: *
Allow: /
Disallow: /api
Disallow: /dashboard

Sitemap: ${WEBSITE_URL}/api/sitemap.xml
`);
}
