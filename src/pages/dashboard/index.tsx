import { useEffect } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Coins,
  Play,
  Hash,
  Calendar,
  ArrowRight,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import EmptyState from "@/components/shared/EmptyState";
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

export default function DashboardIndexPage() {
  const router = useRouter();

  // Success toast after Stripe checkout
  useEffect(() => {
    if (router.query.success === "true") {
      toast.success("Payment successful! Your credits have been updated.");
      router.replace(routes.dashboard.index, undefined, { shallow: true });
    }
  }, [router.query.success, router]);

  const campaignsQuery = trpc.campaign.list.useQuery();
  const creditsQuery = trpc.user.getCredits.useQuery();

  const campaigns = campaignsQuery.data ?? [];
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalCommentsPosted = campaigns.reduce(
    (sum, c) => sum + (c._count?.posts ?? 0),
    0
  );
  const credits = creditsQuery.data?.amount ?? 0;

  const isLoading = campaignsQuery.isLoading || creditsQuery.isLoading;

  return (
    <DashboardLayout>
      <Seo title="Dashboard -- SlopMog" noIndex />

      <PageHeader
        title="Dashboard"
        description="Your command center for AI-powered Reddit shilling"
      />

      {isLoading ? (
        <LoadingState variant="spinner" text="Loading your empire..." />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              icon={Megaphone}
              value={totalCampaigns}
              label="Total Campaigns"
            />
            <StatsCard
              icon={Play}
              value={activeCampaigns}
              label="Active Campaigns"
            />
            <StatsCard
              icon={MessageSquare}
              value={totalCommentsPosted}
              label="Comments Posted"
            />
            <StatsCard
              icon={Coins}
              value={credits.toLocaleString()}
              label="Credits Remaining"
            />
          </div>

          {/* Campaign cards or empty state */}
          {campaigns.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="No campaigns yet"
              description="Your competitors are sleeping -- don't let them. Create your first campaign and start showing up where it matters."
              actionLabel="Create Your First Campaign"
              href={routes.dashboard.campaigns.new}
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg text-charcoal">
                  Your Campaigns
                </h2>
                <Link
                  href={routes.dashboard.campaigns.index}
                  className="text-sm font-semibold text-teal hover:text-teal-dark transition-colors flex items-center gap-1"
                >
                  View all
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.slice(0, 4).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={routes.dashboard.campaigns.detail(campaign.id)}
                    className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 hover:-translate-y-0.5 hover:shadow-brand-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading font-bold text-charcoal group-hover:text-teal transition-colors">
                        {campaign.name}
                      </h3>
                      <span
                        className={`text-[0.7rem] font-bold px-2.5 py-0.5 rounded-full ${
                          STATUS_COLORS[campaign.status] ?? STATUS_COLORS.DRAFT
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[0.82rem] text-charcoal-light">
                      <span className="flex items-center gap-1">
                        <Hash size={13} />
                        {campaign.keywords.length} keyword{campaign.keywords.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={13} />
                        {campaign._count?.posts ?? 0} post{(campaign._count?.posts ?? 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
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
