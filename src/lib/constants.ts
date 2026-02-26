export const routes = {
  auth: {
    login: "/auth/login",
    register: "/auth/login",
  },
  dashboard: {
    index: "/dashboard",
    campaigns: {
      index: "/dashboard/campaigns",
      new: "/dashboard/campaigns/new",
      detail: (id: string) => `/dashboard/campaigns/${id}` as const,
    },
    queue: "/dashboard/queue",
    comments: "/dashboard/comments",
    billing: "/dashboard/billing",
    settings: "/dashboard/settings",
  },
  pricing: "/pricing",
  campaigns: "/campaigns",
  tools: {
    redditCommentGenerator: "/tools/reddit-comment-generator",
  },
  alternatives: {
    index: "/alternatives-to",
    crowdreply: "/alternatives-to/crowdreply",
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
