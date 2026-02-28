import { useEffect } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  LayoutDashboard,
  Coins,
  Globe,
  Inbox,
  MessageSquare,
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

export default function DashboardIndexPage() {
  const router = useRouter();

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

  const credits = creditsQuery.data?.amount ?? 0;
  const sitesCount = sitesQuery.data?.length ?? 0;
  const pendingCount = oppStatsQuery.data?.pending ?? 0;
  const postedCount = commentStatsQuery.data?.posted ?? 0;

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
          ) : pendingCount > 0 ? (
            <div className="bg-sunny/10 border border-sunny/30 rounded-brand p-5">
              <h3 className="font-heading font-bold text-charcoal mb-1">
                {pendingCount} {pendingCount === 1 ? "opportunity" : "opportunities"} waiting for review
              </h3>
              <p className="text-sm text-charcoal-light mb-3">
                Head to the queue to approve or skip discovered opportunities.
              </p>
              <a
                href={routes.dashboard.queue}
                className="inline-flex items-center justify-center bg-coral text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                Review Queue
              </a>
            </div>
          ) : null}
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
