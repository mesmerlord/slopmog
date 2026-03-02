import { useState } from "react";
import { useRouter } from "next/router";
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
  Trash2,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
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
        Done
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
    { siteId, limit: 5 },
    { enabled: !!siteId },
  );
  const opportunitiesQuery = trpc.opportunity.list.useQuery(
    { siteId, limit: 5 },
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

  const deleteSite = trpc.site.delete.useMutation({
    onSuccess: () => {
      toast.success("Site deleted.");
      router.push(routes.dashboard.sites.index);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const isAuto = site.mode === "AUTO";

  return (
    <DashboardLayout>
      <Seo title={`${site.name} -- SlopMog`} noIndex />

      <PageHeader
        title={site.name}
        breadcrumbs={[
          { label: "Sites", href: routes.dashboard.sites.index },
          { label: site.name },
        ]}
      />

      {/* Top bar: meta + actions in one line */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: meta info */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-dark font-semibold transition-colors"
            >
              {new URL(site.url).hostname}
              <ExternalLink size={12} />
            </a>
            <span className="w-px h-4 bg-charcoal/10" />
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isAuto ? "bg-teal/8 text-teal-dark" : "bg-lavender/15 text-lavender-dark"
            }`}>
              {isAuto ? "Auto" : "Manual"}
            </span>
            {site.platforms.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-charcoal/[0.04] text-charcoal-light">
                {p === "REDDIT" ? "Reddit" : "YouTube"}
              </span>
            ))}
            <span className="w-px h-4 bg-charcoal/10" />
            <span className="text-xs text-charcoal-light flex items-center gap-1">
              <Eye size={12} /> {site._count.opportunities}
            </span>
            <span className="text-xs text-charcoal-light flex items-center gap-1">
              <MessageSquare size={12} /> {site._count.comments}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => triggerDiscovery.mutate({ siteId: site.id })}
              disabled={triggerDiscovery.isPending}
              className="inline-flex items-center gap-1.5 bg-coral text-white px-4 py-2 rounded-full font-bold text-xs hover:bg-coral-dark transition-all disabled:opacity-40"
            >
              <Play size={12} fill="currentColor" />
              {triggerDiscovery.isPending ? "Starting..." : "Run Discovery"}
            </button>
            <button
              onClick={() => updateSite.mutate({
                id: site.id,
                mode: isAuto ? "MANUAL" : "AUTO",
              })}
              className="inline-flex items-center gap-1.5 border border-charcoal/[0.12] text-charcoal-light px-3 py-2 rounded-full text-xs font-bold hover:text-charcoal hover:border-charcoal/[0.2] transition-all"
            >
              <Zap size={12} />
              Switch to {isAuto ? "Manual" : "Auto"}
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-2 rounded-full border border-charcoal/[0.08] text-charcoal-light/40 hover:text-coral hover:border-coral/30 transition-all"
              title="Delete site"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Keywords */}
      {(() => {
        const kc = site.keywordConfig as { features?: string[]; competitors?: string[]; brand?: string[]; reddit?: string[]; youtube?: string[] } | null;
        if (kc) {
          return (
            <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kc.features && kc.features.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-charcoal-light uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag size={10} /> Features
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {kc.features.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full bg-teal/5 border border-teal/10 text-[11px] text-charcoal font-medium">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {kc.competitors && kc.competitors.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-charcoal-light uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag size={10} /> Competitors
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {kc.competitors.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full bg-coral/5 border border-coral/10 text-[11px] text-charcoal font-medium">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {kc.brand && kc.brand.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-charcoal-light uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag size={10} /> Brand
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {kc.brand.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full bg-sunny/10 border border-sunny/20 text-[11px] text-charcoal font-medium">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
        // Fallback for old sites without keywordConfig
        if (site.keywords.length > 0) {
          return (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag size={12} /> Keywords
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {site.keywords.map((kw) => (
                  <span key={kw} className="px-2.5 py-1 rounded-full bg-white border border-charcoal/[0.06] text-xs text-charcoal font-medium shadow-brand-sm">{kw}</span>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Two-column: Runs + Opportunities */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Discovery Runs */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
          <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock size={12} />
            Recent Runs
          </h3>
          {runsQuery.isLoading ? (
            <LoadingState variant="skeleton" />
          ) : !runsQuery.data?.length ? (
            <p className="text-sm text-charcoal-light/60 py-4 text-center">
              No runs yet — hit "Run Discovery" above
            </p>
          ) : (
            <div className="space-y-2">
              {runsQuery.data.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between py-2 px-3 rounded-brand-sm bg-charcoal/[0.015] border border-charcoal/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    <RunStatusBadge status={run.status} />
                    <span className="text-[11px] font-bold text-charcoal-light uppercase">
                      {run.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-charcoal-light">
                    <span>{run.foundCount} found</span>
                    <span className="text-charcoal/10">·</span>
                    <span>{run.postedCount} posted</span>
                    <span className="text-charcoal/10">·</span>
                    <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opportunities */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
          <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Eye size={12} />
            Recent Opportunities
          </h3>
          {opportunitiesQuery.isLoading ? (
            <LoadingState variant="skeleton" />
          ) : !opportunitiesQuery.data?.items.length ? (
            <p className="text-sm text-charcoal-light/60 py-4 text-center">
              No opportunities discovered yet
            </p>
          ) : (
            <div className="space-y-2">
              {opportunitiesQuery.data.items.map((opp) => (
                <div
                  key={opp.id}
                  className="py-2 px-3 rounded-brand-sm bg-charcoal/[0.015] border border-charcoal/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={opp.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-charcoal hover:text-teal transition-colors line-clamp-1 flex-1 min-w-0"
                    >
                      {opp.title}
                    </a>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      opp.status === "POSTED" ? "bg-teal/10 text-teal-dark"
                        : opp.status === "PENDING_REVIEW" ? "bg-sunny/20 text-sunny-dark"
                        : opp.status === "FAILED" ? "bg-coral/10 text-coral-dark"
                        : "bg-charcoal/[0.04] text-charcoal-light"
                    }`}>
                      {opp.status === "PENDING_REVIEW" ? "PENDING" : opp.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-charcoal-light">
                    <span>{opp.sourceContext}</span>
                    <span className="text-charcoal/10">·</span>
                    <span>{(opp.relevanceScore * 100).toFixed(0)}% match</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${site.name}?`}
        description="This permanently deletes the site along with all its discovery runs, opportunities, and comments. Can't undo this one."
        confirmLabel="Delete Site"
        variant="danger"
        onConfirm={() => deleteSite.mutate({ id: site.id })}
      />
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
