import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Globe,
  Play,
  Plus,
  ExternalLink,
  MessageSquare,
  Eye,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

function PlatformBadge({ platform }: { platform: string }) {
  const colors = platform === "REDDIT"
    ? "bg-orange-100 text-orange-700"
    : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors}`}>
      {platform === "REDDIT" ? "Reddit" : "YouTube"}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const isAuto = mode === "AUTO";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
      isAuto ? "bg-teal/10 text-teal-dark" : "bg-lavender/20 text-lavender-dark"
    }`}>
      {isAuto ? "Auto" : "Manual"}
    </span>
  );
}

export default function SitesListPage() {
  const sitesQuery = trpc.site.list.useQuery();
  const triggerDiscovery = trpc.site.triggerDiscovery.useMutation({
    onSuccess: () => {
      toast.success("Discovery started! Check back in a few minutes.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRunDiscovery = (siteId: string) => {
    setRunningId(siteId);
    triggerDiscovery.mutate({ siteId }, {
      onSettled: () => setRunningId(null),
    });
  };

  return (
    <DashboardLayout>
      <Seo title="Sites -- SlopMog" noIndex />

      <PageHeader
        title="Sites"
        description="Your brands, auto-discovered across the internet"
        action={{ label: "Add Site", href: routes.dashboard.sites.new }}
      />

      {sitesQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading your sites..." />
      ) : !sitesQuery.data?.length ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Add your website and we'll analyze it, find opportunities, and write comments that make your brand look good."
          actionLabel="Add Your First Site"
          href={routes.dashboard.sites.new}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sitesQuery.data.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={routes.dashboard.sites.detail(site.id)}
                    className="font-heading font-bold text-charcoal hover:text-teal transition-colors text-base truncate block"
                  >
                    {site.name}
                  </Link>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-charcoal-light hover:text-teal flex items-center gap-1 mt-0.5"
                  >
                    {new URL(site.url).hostname}
                    <ExternalLink size={10} />
                  </a>
                </div>
                <ModeBadge mode={site.mode} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {site.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-charcoal-light mb-4">
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  {site._count.opportunities}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={14} />
                  {site._count.comments}
                </span>
              </div>

              <div className="flex gap-2">
                <Link
                  href={routes.dashboard.sites.detail(site.id)}
                  className="flex-1 inline-flex items-center justify-center border border-teal text-teal px-4 py-2 rounded-full text-sm font-bold hover:bg-teal/5 transition-all"
                >
                  View
                </Link>
                <button
                  onClick={() => handleRunDiscovery(site.id)}
                  disabled={runningId === site.id || !site.active}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-coral text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-coral-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={14} />
                  {runningId === site.id ? "Starting..." : "Discover"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerAuthSession(ctx);

  if (!session) {
    return {
      redirect: {
        destination: `/auth/login?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  return { props: {} };
};
