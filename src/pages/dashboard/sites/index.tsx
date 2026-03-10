import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Globe,
  Play,
  ExternalLink,
  MessageSquare,
  Eye,
  Trash2,
  MoreVertical,
  Plus,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function SitesListPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const sitesQuery = trpc.site.list.useQuery();
  const planQuery = trpc.user.getPlanInfo.useQuery();

  const triggerDiscovery = trpc.site.triggerDiscovery.useMutation({
    onSuccess: () => {
      toast.success("Discovery started! Check back in a few minutes.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSite = trpc.site.delete.useMutation({
    onSuccess: () => {
      toast.success("Site deleted.");
      utils.site.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleAddSite = () => {
    const maxSites = planQuery.data?.maxSites ?? 1;
    const currentSites = sitesQuery.data?.length ?? 0;
    if (Number.isFinite(maxSites) && currentSites >= maxSites) {
      setShowUpgradeModal(true);
      return;
    }
    router.push(routes.dashboard.sites.new);
  };

  const handleRunDiscovery = (siteId: string) => {
    setRunningIds((prev) => new Set(prev).add(siteId));
    triggerDiscovery.mutate({ siteId }, {
      onSettled: () => setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(siteId);
        return next;
      }),
    });
  };

  return (
    <DashboardLayout>
      <Seo title="Sites -- SlopMog" noIndex />

      <PageHeader
        title="Sites"
        description="Your brands, auto-discovered across the internet"
        action={{ label: "Add Site", onClick: handleAddSite }}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sitesQuery.data.map((site) => {
            let hostname: string;
            try { hostname = new URL(site.url).hostname; } catch { hostname = site.url; }
            const initial = site.name.charAt(0).toUpperCase();
            const isAuto = site.mode === "AUTO";

            return (
              <Link
                key={site.id}
                href={routes.dashboard.sites.detail(site.id)}
                className="group block bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
              >
                <div className="p-5">
                  {/* Top row: avatar + name + menu */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="shrink-0 w-10 h-10 rounded-brand-sm bg-coral/10 flex items-center justify-center">
                      <span className="text-coral font-heading font-bold text-lg leading-none">{initial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-bold text-charcoal group-hover:text-teal transition-colors text-base truncate">
                        {site.name}
                      </h3>
                      <span className="text-xs text-charcoal-light flex items-center gap-1 mt-0.5">
                        {hostname}
                        <ExternalLink size={10} />
                      </span>
                    </div>
                    {/* Overflow menu */}
                    <div className="relative shrink-0 -mt-0.5 -mr-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === site.id ? null : site.id);
                        }}
                        onBlur={() => setTimeout(() => setMenuOpenId(null), 150)}
                        className="p-1.5 rounded-full text-charcoal-light/40 hover:text-charcoal hover:bg-charcoal/[0.04] transition-colors"
                        aria-label="Site options"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpenId === site.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-brand-sm shadow-brand-md border border-charcoal/[0.08] py-1 z-10">
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setDeleteTarget({ id: site.id, name: site.name });
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-coral hover:bg-coral/[0.04] flex items-center gap-2 transition-colors"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
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
                  </div>

                  {/* Stats + action */}
                  <div className="flex items-center justify-between pt-3 border-t border-charcoal/[0.06]">
                    <div className="flex items-center gap-4 text-xs text-charcoal-light">
                      <span className="flex items-center gap-1.5">
                        <Eye size={13} className="text-charcoal-light/50" />
                        <span className="font-bold text-charcoal">{site._count.opportunities}</span>
                        opps
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-charcoal-light/50" />
                        <span className="font-bold text-charcoal">{site._count.comments}</span>
                        posted
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRunDiscovery(site.id);
                      }}
                      disabled={runningIds.has(site.id) || !site.active}
                      className="inline-flex items-center gap-1 bg-coral text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-coral-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={11} fill="currentColor" />
                      {runningIds.has(site.id) ? "Starting..." : "Discover"}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Add Site card */}
          <button
            onClick={handleAddSite}
            className="group flex flex-col items-center justify-center gap-3 bg-white rounded-brand border-2 border-dashed border-charcoal/[0.12] hover:border-teal/40 hover:bg-teal/[0.02] hover:-translate-y-0.5 transition-all p-8 min-h-[200px] cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-charcoal/[0.04] group-hover:bg-teal/10 flex items-center justify-center transition-colors">
              <Plus size={20} className="text-charcoal-light group-hover:text-teal transition-colors" />
            </div>
            <span className="text-sm font-bold text-charcoal-light group-hover:text-teal transition-colors">
              Add a site
            </span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget?.name ?? "site"}?`}
        description="This permanently deletes the site along with all its discovery runs, opportunities, and comments. Can't undo this one."
        confirmLabel="Delete Site"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteSite.mutate({ id: deleteTarget.id });
        }}
      />

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Site limit reached"
        description="Upgrade your plan to add more sites."
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
