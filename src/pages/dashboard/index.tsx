import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  LayoutDashboard,
  Coins,
  Globe,
  Inbox,
  MessageSquare,
  Loader2,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { timeAgo } from "@/utils/format-time";
import { getServerAuthSession } from "@/server/utils/auth";
import { useTrackPayment } from "@/hooks/useTrackPayment";

export default function DashboardIndexPage() {
  const router = useRouter();

  // Track GA4 purchase event after Stripe checkout
  useTrackPayment();

  // Success toast after Stripe checkout
  useEffect(() => {
    if (router.query.success === "true") {
      toast.success("Payment successful! Your credits have been updated.");
      router.replace(routes.dashboard.index, undefined, { shallow: true });
    }
  }, [router.query.success, router]);

  const creditsQuery = trpc.user.getCredits.useQuery();
  const sitesQuery = trpc.site.list.useQuery();
  const oppStatsQuery = trpc.opportunity.getStats.useQuery();
  const commentStatsQuery = trpc.comment.getStats.useQuery();
  const discoveryStatusQuery = trpc.site.hasRunningDiscovery.useQuery();
  const globalActivityQuery = trpc.site.getGlobalActivityFeed.useQuery({ limit: 5 });

  const credits = creditsQuery.data?.amount ?? 0;
  const sitesCount = sitesQuery.data?.length ?? 0;
  const pendingCount = oppStatsQuery.data?.pending ?? 0;
  const postedCount = commentStatsQuery.data?.posted ?? 0;
  const discoveryRunning = discoveryStatusQuery.data?.isRunning ?? false;
  const discoveryRuns = discoveryStatusQuery.data?.runs ?? [];
  const recentActivity = globalActivityQuery.data ?? [];

  // Poll discovery status while running
  const refetchDiscoveryStatus = discoveryStatusQuery.refetch;
  useEffect(() => {
    if (!discoveryRunning) return;
    const interval = setInterval(() => {
      refetchDiscoveryStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [discoveryRunning, refetchDiscoveryStatus]);

  const isLoading = creditsQuery.isLoading;

  return (
    <DashboardLayout>
      <Seo title="Dashboard -- SlopMog" noIndex />

      <PageHeader
        title="Dashboard"
        description="Your command center for multi-platform brand discovery"
      />

      {isLoading ? (
        <LoadingState variant="spinner" text="Loading your empire..." />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              icon={Globe}
              value={sitesCount}
              label="Sites Active"
            />
            <StatsCard
              icon={Inbox}
              value={pendingCount}
              label="Pending Review"
            />
            <StatsCard
              icon={MessageSquare}
              value={postedCount}
              label="Comments Posted"
            />
            <StatsCard
              icon={Coins}
              value={credits.toLocaleString()}
              label="Credits Remaining"
            />
          </div>

          {sitesCount === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="No sites yet"
              description="Add your website and we'll start finding opportunities to mention your brand across Reddit and YouTube."
              actionLabel="Add Your First Site"
              href={routes.dashboard.sites.new}
            />
          ) : (
            <>
              {/* Discovery running banner */}
              {discoveryRunning && (
                <div className="bg-teal/[0.06] border border-teal/20 rounded-brand p-4 mb-6 flex items-start gap-3">
                  <Loader2 size={18} className="animate-spin text-teal mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-charcoal">Discovery in progress</p>
                    {discoveryRuns.map((run) => (
                      <p key={run.id} className="text-xs text-charcoal-light mt-0.5">
                        Scanning {run.platform === "REDDIT" ? "Reddit" : "YouTube"} for {run.site.name} — new opportunities incoming
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending review banner */}
              {pendingCount > 0 && (
                <div className="bg-sunny/10 border border-sunny/30 rounded-brand p-5 mb-6">
                  <h3 className="font-heading font-bold text-charcoal mb-1">
                    {pendingCount} {pendingCount === 1 ? "opportunity" : "opportunities"} waiting for review
                  </h3>
                  <p className="text-sm text-charcoal-light mb-3">
                    Head to the queue to approve or skip discovered opportunities.
                  </p>
                  <Link
                    href={routes.dashboard.queue}
                    className="inline-flex items-center justify-center bg-coral text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    Review Queue
                  </Link>
                </div>
              )}

              {/* Quick actions row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Link
                  href={routes.dashboard.sites.index}
                  className="group bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal/10 flex items-center justify-center">
                      <Search size={16} className="text-teal" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-charcoal group-hover:text-teal transition-colors">Run Discovery</p>
                      <p className="text-xs text-charcoal-light">Find new opportunities</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto text-charcoal-light/40 group-hover:text-teal transition-colors" />
                  </div>
                </Link>
                <Link
                  href={routes.dashboard.queue}
                  className="group bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-coral/10 flex items-center justify-center">
                      <Inbox size={16} className="text-coral" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-charcoal group-hover:text-teal transition-colors">
                        Review Queue
                        {pendingCount > 0 && (
                          <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-coral text-white text-[10px] font-bold px-1">
                            {pendingCount}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-charcoal-light">Approve or edit comments</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto text-charcoal-light/40 group-hover:text-teal transition-colors" />
                  </div>
                </Link>
                <Link
                  href={routes.dashboard.sites.new}
                  className="group bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-lavender/15 flex items-center justify-center">
                      <Plus size={16} className="text-lavender-dark" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-charcoal group-hover:text-teal transition-colors">Add Another Site</p>
                      <p className="text-xs text-charcoal-light">Track more brands</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto text-charcoal-light/40 group-hover:text-teal transition-colors" />
                  </div>
                </Link>
              </div>

              {/* Recent activity feed */}
              {recentActivity.length > 0 && (
                <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
                  <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          item.type === "discovery_running"
                            ? "bg-sunny/20 text-sunny-dark"
                            : item.type === "discovery_completed"
                              ? "bg-teal/10 text-teal-dark"
                              : "bg-lavender/15 text-lavender-dark"
                        }`}>
                          {item.type === "discovery_running" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : item.type === "discovery_completed" ? (
                            <Search size={14} />
                          ) : (
                            <MessageSquare size={14} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-charcoal leading-snug">
                            {item.type === "discovery_running" && (
                              <>Scouting {item.platform} for <span className="font-semibold">{item.siteName}</span>...</>
                            )}
                            {item.type === "discovery_completed" && (
                              <>
                                Discovery for <span className="font-semibold">{item.siteName}</span> found {"foundCount" in item ? item.foundCount : 0} threads, generated {"generatedCount" in item ? item.generatedCount : 0} for review
                              </>
                            )}
                            {item.type === "comment_posted" && (
                              <>
                                Posted on {item.sourceContext}: {" "}
                                <a
                                  href={item.contentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-charcoal hover:text-teal transition-colors"
                                >
                                  {item.title}
                                  <ExternalLink size={10} className="inline ml-1 -mt-0.5" />
                                </a>
                              </>
                            )}
                          </p>
                          <p className="text-[11px] text-charcoal-light mt-0.5">
                            {timeAgo(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
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
