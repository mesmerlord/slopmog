import Head from "next/head";
import { useRouter } from "next/router";
import React, { useMemo } from "react";

interface OpenGraphImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

interface OpenGraphData {
  title?: string;
  description?: string;
  images?: OpenGraphImage[];
  type?: string;
  locale?: string;
  site_name?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
    tags?: string[];
  };
}

interface TwitterData {
  card?: "summary" | "summary_large_image" | "app" | "player";
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

interface LinkTag {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
}

interface JsonLd {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

interface SeoProps {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  noIndex?: boolean;
  openGraph?: OpenGraphData;
  twitter?: TwitterData;
  additionalMetaTags?: MetaTag[];
  additionalLinkTags?: LinkTag[];
  jsonLd?: JsonLd | JsonLd[];
}

const DEFAULT_SITE_NAME = "SlopMog";
const DEFAULT_DESCRIPTION =
  "SlopMog posts Reddit comments about your brand so AI recommends you. It's not manipulation. It's just really, really good marketing.";

const Seo = ({
  title,
  description,
  url,
  image,
  siteName = DEFAULT_SITE_NAME,
  noIndex,
  openGraph,
  twitter,
  additionalMetaTags,
  additionalLinkTags,
  jsonLd,
}: SeoProps) => {
  const router = useRouter();

  const [locationUrl, siteDescription] = useMemo(() => {
    const pathWithoutQuery = router.asPath.split("?")[0].split("#")[0];
    const locationUrl =
      url || `${process.env.NEXT_PUBLIC_SITE_URL}${pathWithoutQuery}`;
    const siteDescription = description || DEFAULT_DESCRIPTION;
    return [locationUrl, siteDescription];
  }, [router.asPath, description, url]);

  const ogImages = useMemo(() => {
    if (openGraph?.images?.length) return openGraph.images;
    return image ? [{ url: image, width: 1200, height: 630 }] : [];
  }, [image, openGraph?.images]);

  const jsonLdItems = useMemo(() => {
    if (!jsonLd) return [];
    return Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  }, [jsonLd]);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={siteDescription} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <link rel="canonical" href={locationUrl} />

      {/* OpenGraph */}
      <meta property="og:locale" content={openGraph?.locale || "en_US"} />
      <meta property="og:type" content={openGraph?.type || "website"} />
      <meta property="og:title" content={openGraph?.title || title} />
      <meta
        property="og:description"
        content={openGraph?.description || siteDescription}
      />
      <meta property="og:url" content={locationUrl} />
      <meta
        property="og:site_name"
        content={openGraph?.site_name || siteName}
      />

      {openGraph?.article && (
        <>
          {openGraph.article.publishedTime && (
            <meta
              property="article:published_time"
              content={openGraph.article.publishedTime}
            />
          )}
          {openGraph.article.modifiedTime && (
            <meta
              property="article:modified_time"
              content={openGraph.article.modifiedTime}
            />
          )}
          {openGraph.article.authors?.map((author, index) => (
            <meta key={index} property="article:author" content={author} />
          ))}
          {openGraph.article.tags?.map((tag, index) => (
            <meta key={index} property="article:tag" content={tag} />
          ))}
        </>
      )}

      {ogImages.map((ogImage, index) => (
        <React.Fragment key={index}>
          <meta property="og:image" content={ogImage.url} />
          {ogImage.width && (
            <meta property="og:image:width" content={String(ogImage.width)} />
          )}
          {ogImage.height && (
            <meta property="og:image:height" content={String(ogImage.height)} />
          )}
          {ogImage.alt && (
            <meta property="og:image:alt" content={ogImage.alt} />
          )}
          {ogImage.type && (
            <meta property="og:image:type" content={ogImage.type} />
          )}
        </React.Fragment>
      ))}

      {/* Twitter */}
      <meta
        name="twitter:card"
        content={twitter?.card || "summary_large_image"}
      />
      {twitter?.site && <meta name="twitter:site" content={twitter.site} />}
      {twitter?.creator && (
        <meta name="twitter:creator" content={twitter.creator} />
      )}
      <meta name="twitter:title" content={twitter?.title || title} />
      <meta
        name="twitter:description"
        content={twitter?.description || siteDescription}
      />
      {(twitter?.image || ogImages[0]) && (
        <meta
          name="twitter:image"
          content={twitter?.image || ogImages[0].url}
        />
      )}

      {/* Additional tags */}
      {additionalMetaTags?.map((tag, index) => (
        <meta
          key={index}
          {...(tag.name ? { name: tag.name } : {})}
          {...(tag.property ? { property: tag.property } : {})}
          content={tag.content}
        />
      ))}

      {additionalLinkTags?.map((tag, index) => (
        <link
          key={index}
          rel={tag.rel}
          href={tag.href}
          {...(tag.type ? { type: tag.type } : {})}
          {...(tag.sizes ? { sizes: tag.sizes } : {})}
        />
      ))}

      {/* JSON-LD */}
      {jsonLdItems.map((item, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </Head>
  );
};

export default React.memo(Seo);
