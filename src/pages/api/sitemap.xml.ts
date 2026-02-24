import { NextApiRequest, NextApiResponse } from "next";
import { routes, ALTERNATIVES } from "@/lib/constants";

const WEBSITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://slopmog.com";

interface SitemapUrl {
  url: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
  lastmod?: string;
}

function generateUrlXml({ url, changefreq, priority, lastmod }: SitemapUrl): string {
  const lastmodXml = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `
    <url>
      <loc>${WEBSITE_URL}${url}</loc>
      <changefreq>${changefreq}</changefreq>
      <priority>${priority}</priority>
      ${lastmodXml}
    </url>`;
}

function generateSiteMap() {
  const urls: SitemapUrl[] = [];
  const lastModified = new Date().toISOString();

  // Homepage
  urls.push({ url: "", changefreq: "daily", priority: 1.0, lastmod: lastModified });

  // Main pages
  urls.push({ url: routes.pricing, changefreq: "weekly", priority: 0.8, lastmod: lastModified });

  // Auth pages
  urls.push({ url: routes.auth.login, changefreq: "monthly", priority: 0.5, lastmod: lastModified });
  urls.push({ url: routes.auth.register, changefreq: "monthly", priority: 0.6, lastmod: lastModified });

  // Alternatives index
  urls.push({ url: routes.alternatives.index, changefreq: "weekly", priority: 0.8, lastmod: lastModified });

  // Individual alternative pages
  for (const alt of ALTERNATIVES) {
    urls.push({ url: alt.url, changefreq: "weekly", priority: 0.7, lastmod: lastModified });
  }

  const urlsXml = urls.map(generateUrlXml).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlsXml}
</urlset>`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");
  res.setHeader("Content-Type", "text/xml");

  const sitemap = generateSiteMap();
  res.write(sitemap);
  res.end();
}
