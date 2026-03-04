export const routes = {
  auth: {
    login: "/auth/login",
    register: "/auth/login",
  },
  dashboard: {
    index: "/dashboard",
    sites: {
      index: "/dashboard/sites",
      new: "/dashboard/sites/new",
      detail: (id: string) => `/dashboard/sites/${id}` as const,
    },
    queue: "/dashboard/queue",
    comments: "/dashboard/comments",
    billing: "/dashboard/billing",
    settings: "/dashboard/settings",
  },
  pricing: "/pricing",
  tools: {
    redditCommentGenerator: "/tools/reddit-comment-generator",
  },
  alternatives: {
    index: "/alternatives-to",
    crowdreply: "/alternatives-to/crowdreply",
  },
  legal: {
    terms: "/terms",
    privacy: "/privacy",
  },
} as const;

export interface AlternativeConfig {
  name: string;
  slug: string;
  description: string;
  image: string;
  url: string;
}

export const ALTERNATIVES: AlternativeConfig[] = [
  {
    name: "CrowdReply",
    slug: "crowdreply",
    description:
      "Reddit marketing platform with managed accounts. PRO plan at $99/mo includes $100 in credits.",
    image: "/alternatives-images/crowdreply-demo.png",
    url: "/alternatives-to/crowdreply",
  },
];
