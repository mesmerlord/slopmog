import { useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  Search,
  MessageSquare,
  Clock,
  Coins,
  Hash,
  Globe,
  Play,
  Pause,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-teal/10 text-teal-dark",
  DRAFT: "bg-charcoal/10 text-charcoal-light",
  PAUSED: "bg-sunny/20 text-charcoal",
  COMPLETED: "bg-lavender/10 text-lavender",
  FAILED: "bg-coral/10 text-coral-dark",
};

const OPPORTUNITY_STATUS_COLORS: Record<string, string> = {
  DISCOVERED: "bg-charcoal/[0.08] text-charcoal-light",
  PENDING_REVIEW: "bg-sunny/20 text-charcoal",
  APPROVED: "bg-teal/10 text-teal-dark",
  GENERATING: "bg-lavender/10 text-lavender",
  READY_FOR_REVIEW: "bg-coral/10 text-coral-dark",
  POSTING: "bg-teal/10 text-teal-dark",
  POSTED: "bg-teal/15 text-teal-dark",
  REJECTED: "bg-charcoal/[0.06] text-charcoal-light",
  SKIPPED: "bg-charcoal/[0.06] text-charcoal-light",
  FAILED: "bg-coral/10 text-coral-dark",
  EXPIRED: "bg-charcoal/[0.06] text-charcoal-light",
};

const AUTOMATION_LABELS: Record<string, string> = {
  FULL_MANUAL: "Full Control",
  SEMI_AUTO: "Semi-Auto",
  AUTOPILOT: "Autopilot",
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const id = router.query.id as string;

  const utils = trpc.useUtils();

  const campaignQuery = trpc.campaign.getById.useQuery(
    { id },
    { enabled: !!id }
  );
  const statsQuery = trpc.campaign.getStats.useQuery(
    { id },
    { enabled: !!id }
  );

  const activateMutation = trpc.campaign.activate.useMutation({
    onSuccess: () => {
      toast.success("Campaign activated! Let the shilling begin.");
      utils.campaign.getById.invalidate({ id });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to activate campaign.");
    },
  });

  const pauseMutation = trpc.campaign.pause.useMutation({
    onSuccess: () => {
      toast.success("Campaign paused.");
      utils.campaign.getById.invalidate({ id });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to pause campaign.");
    },
  });

  const campaign = campaignQuery.data;
  const stats = statsQuery.data;
  const isLoading = campaignQuery.isLoading;

  const handleToggleStatus = useCallback(() => {
    if (!campaign) return;
    if (campaign.status === "ACTIVE") {
      pauseMutation.mutate({ id });
    } else {
      activateMutation.mutate({ id });
    }
  }, [campaign, id, activateMutation, pauseMutation]);

  const isToggling = activateMutation.isPending || pauseMutation.isPending;

  if (isLoading || !id) {
    return (
      <DashboardLayout>
        <Seo title="Campaign -- SlopMog" noIndex />
        <LoadingState variant="page" text="Loading campaign..." />
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <Seo title="Campaign Not Found -- SlopMog" noIndex />
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="font-heading font-bold text-xl text-charcoal mb-2">
            Campaign not found
          </h2>
          <p className="text-sm text-charcoal-light mb-4">
            This campaign doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link
            href={routes.dashboard.campaigns.index}
            className="text-teal font-semibold text-sm hover:text-teal-dark transition-colors"
          >
            Back to campaigns
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isActive = campaign.status === "ACTIVE";
  const toggleLabel = isActive ? "Pause" : "Activate";
  const ToggleIcon = isActive ? Pause : Play;

  return (
    <DashboardLayout>
      <Seo title={`${campaign.name} -- SlopMog`} noIndex />

      <PageHeader
        title={campaign.name}
        description={campaign.description || undefined}
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Campaigns", href: routes.dashboard.campaigns.index },
          { label: campaign.name },
        ]}
        action={{
          label: toggleLabel,
          onClick: handleToggleStatus,
        }}
      />

      {/* Status badge + automation mode */}
      <div className="flex flex-wrap items-center gap-3 mb-6 -mt-4">
        <span
          className={`text-[0.72rem] font-bold px-3 py-1 rounded-full ${
            STATUS_COLORS[campaign.status] ?? STATUS_COLORS.DRAFT
          }`}
        >
          {campaign.status}
        </span>
        <span className="flex items-center gap-1.5 text-[0.82rem] text-charcoal-light">
          <SlidersHorizontal size={13} />
          {AUTOMATION_LABELS[campaign.automationMode] ?? campaign.automationMode}
        </span>
        {campaign.websiteUrl && (
          <a
            href={campaign.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[0.82rem] text-teal font-semibold hover:text-teal-dark transition-colors"
          >
            {campaign.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            icon={Search}
            value={stats.opportunitiesFound}
            label="Opportunities Found"
          />
          <StatsCard
            icon={MessageSquare}
            value={stats.commentsPosted}
            label="Comments Posted"
          />
          <StatsCard
            icon={Clock}
            value={stats.pendingReview}
            label="Pending Review"
          />
          <StatsCard
            icon={Coins}
            value={stats.creditsUsed}
            label="Credits Used"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Keywords section */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash size={16} className="text-teal" />
            <h3 className="font-heading font-bold text-charcoal text-sm">
              Keywords
            </h3>
            <span className="ml-auto text-[0.72rem] font-bold bg-teal/10 text-teal px-2 py-0.5 rounded-full">
              {campaign.keywords.length}
            </span>
          </div>
          {campaign.keywords.length === 0 ? (
            <p className="text-sm text-charcoal-light italic">
              No keywords configured.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {campaign.keywords.map((kw) => (
                <span
                  key={kw.id}
                  className="inline-block bg-teal/10 text-teal-dark text-[0.82rem] font-semibold px-3 py-1.5 rounded-full"
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subreddits section */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-lavender" />
            <h3 className="font-heading font-bold text-charcoal text-sm">
              Subreddits
            </h3>
            <span className="ml-auto text-[0.72rem] font-bold bg-lavender/10 text-lavender px-2 py-0.5 rounded-full">
              {campaign.subreddits.length}
            </span>
          </div>
          {campaign.subreddits.length === 0 ? (
            <p className="text-sm text-charcoal-light italic">
              No subreddits configured.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {campaign.subreddits.map((sub) => (
                <span
                  key={sub.id}
                  className="inline-block bg-lavender/10 text-lavender text-[0.82rem] font-semibold px-3 py-1.5 rounded-full"
                >
                  r/{sub.subreddit}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Opportunities */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-charcoal text-sm">
            Recent Opportunities
          </h3>
          <Link
            href={routes.dashboard.queue}
            className="text-[0.78rem] font-semibold text-teal hover:text-teal-dark transition-colors flex items-center gap-1"
          >
            View queue
            <ArrowRight size={13} />
          </Link>
        </div>

        {campaign.opportunities.length === 0 ? (
          <p className="text-sm text-charcoal-light italic py-4 text-center">
            No opportunities found yet. Activate your campaign to start discovering threads.
          </p>
        ) : (
          <div className="space-y-2">
            {campaign.opportunities.slice(0, 10).map((opp) => (
              <div
                key={opp.id}
                className="flex items-start gap-3 py-3 border-b border-charcoal/[0.04] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={opp.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.88rem] font-semibold text-charcoal hover:text-teal transition-colors line-clamp-1"
                  >
                    {opp.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-[0.75rem] text-charcoal-light">
                    <span>r/{opp.subreddit}</span>
                    <span>
                      {new Date(opp.discoveredAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                    OPPORTUNITY_STATUS_COLORS[opp.status] ??
                    "bg-charcoal/[0.06] text-charcoal-light"
                  }`}
                >
                  {opp.status.replace(/_/g, " ")}
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
