import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Play,
  ExternalLink,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Tag,
  Zap,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

function RunStatusBadge({ status }: { status: string }) {
  if (status === "RUNNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sunny/20 text-sunny-dark">
        <Loader2 size={12} className="animate-spin" />
        Running
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal/10 text-teal-dark">
        <CheckCircle2 size={12} />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-coral/10 text-coral-dark">
      <XCircle size={12} />
      Failed
    </span>
  );
}

export default function SiteDetailPage() {
  const router = useRouter();
  const siteId = router.query.id as string;

  const siteQuery = trpc.site.getById.useQuery({ id: siteId }, { enabled: !!siteId });
  const runsQuery = trpc.site.getDiscoveryRuns.useQuery(
    { siteId, limit: 10 },
    { enabled: !!siteId },
  );
  const opportunitiesQuery = trpc.opportunity.list.useQuery(
    { siteId, limit: 10 },
    { enabled: !!siteId },
  );

  const utils = trpc.useUtils();

  const triggerDiscovery = trpc.site.triggerDiscovery.useMutation({
    onSuccess: () => {
      toast.success("Discovery started!");
      utils.site.getDiscoveryRuns.invalidate({ siteId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSite = trpc.site.update.useMutation({
    onSuccess: () => {
      toast.success("Site updated!");
      utils.site.getById.invalidate({ id: siteId });
    },
    onError: (err) => toast.error(err.message),
  });

  const site = siteQuery.data;

  if (siteQuery.isLoading) {
    return (
      <DashboardLayout>
        <LoadingState variant="page" text="Loading site..." />
      </DashboardLayout>
    );
  }

  if (!site) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-charcoal-light">Site not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Seo title={`${site.name} -- SlopMog`} noIndex />

      <PageHeader
        title={site.name}
        description={site.description}
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Sites", href: routes.dashboard.sites.index },
          { label: site.name },
        ]}
      />

      {/* Site info row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-dark font-semibold transition-colors"
        >
          {new URL(site.url).hostname}
          <ExternalLink size={14} />
        </a>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
          site.mode === "AUTO" ? "bg-teal/10 text-teal-dark" : "bg-lavender/20 text-lavender-dark"
        }`}>
          {site.mode === "AUTO" ? "Auto Mode" : "Manual Review"}
        </span>
        {site.platforms.map((p) => (
          <span
            key={p}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              p === "REDDIT" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
            }`}
          >
            {p === "REDDIT" ? "Reddit" : "YouTube"}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => triggerDiscovery.mutate({ siteId: site.id })}
          disabled={triggerDiscovery.isPending}
          className="inline-flex items-center gap-2 bg-coral text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark transition-all disabled:opacity-50"
        >
          <Play size={16} />
          {triggerDiscovery.isPending ? "Starting..." : "Run Discovery"}
        </button>
        <button
          onClick={() => updateSite.mutate({
            id: site.id,
            mode: site.mode === "AUTO" ? "MANUAL" : "AUTO",
          })}
          className="inline-flex items-center gap-2 border border-teal text-teal px-5 py-2.5 rounded-full font-bold text-sm hover:bg-teal/5 transition-all"
        >
          <Zap size={16} />
          Switch to {site.mode === "AUTO" ? "Manual" : "Auto"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard icon={Eye} value={site._count.opportunities} label="Opportunities" />
        <StatsCard icon={MessageSquare} value={site._count.comments} label="Comments Posted" />
      </div>

      {/* Keywords */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 mb-6">
        <h3 className="font-heading font-bold text-charcoal mb-3 flex items-center gap-2">
          <Tag size={16} className="text-teal" />
          Keywords
        </h3>
        <div className="flex flex-wrap gap-2">
          {site.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center px-3 py-1 rounded-full bg-charcoal/[0.04] text-sm text-charcoal"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Discovery Runs */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 mb-6">
        <h3 className="font-heading font-bold text-charcoal mb-3 flex items-center gap-2">
          <Clock size={16} className="text-teal" />
          Recent Discovery Runs
        </h3>
        {runsQuery.isLoading ? (
          <LoadingState variant="skeleton" />
        ) : !runsQuery.data?.length ? (
          <p className="text-sm text-charcoal-light">No discovery runs yet. Click "Run Discovery" to start.</p>
        ) : (
          <div className="space-y-3">
            {runsQuery.data.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 rounded-brand-sm bg-charcoal/[0.02] border border-charcoal/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <RunStatusBadge status={run.status} />
                  <span className="text-xs font-semibold text-charcoal-light uppercase">
                    {run.platform}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-charcoal-light">
                  <span>Found: {run.foundCount}</span>
                  <span>Scored: {run.scoredCount}</span>
                  <span>Generated: {run.generatedCount}</span>
                  <span>Posted: {run.postedCount}</span>
                  <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Opportunities */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
        <h3 className="font-heading font-bold text-charcoal mb-3 flex items-center gap-2">
          <Eye size={16} className="text-teal" />
          Recent Opportunities
        </h3>
        {opportunitiesQuery.isLoading ? (
          <LoadingState variant="skeleton" />
        ) : !opportunitiesQuery.data?.items.length ? (
          <p className="text-sm text-charcoal-light">No opportunities discovered yet.</p>
        ) : (
          <div className="space-y-2">
            {opportunitiesQuery.data.items.map((opp) => (
              <div
                key={opp.id}
                className="flex items-start justify-between p-3 rounded-brand-sm bg-charcoal/[0.02] border border-charcoal/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={opp.contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-charcoal hover:text-teal transition-colors line-clamp-1"
                  >
                    {opp.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-xs text-charcoal-light">
                    <span>{opp.sourceContext}</span>
                    <span className="text-charcoal/20">|</span>
                    <span>Score: {(opp.relevanceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <span className={`shrink-0 ml-3 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  opp.status === "POSTED" ? "bg-teal/10 text-teal-dark"
                    : opp.status === "PENDING_REVIEW" ? "bg-sunny/20 text-sunny-dark"
                    : opp.status === "FAILED" ? "bg-coral/10 text-coral-dark"
                    : "bg-charcoal/[0.06] text-charcoal-light"
                }`}>
                  {opp.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
