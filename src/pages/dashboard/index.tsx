import { useEffect } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  LayoutDashboard,
  Coins,
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

  const credits = creditsQuery.data?.amount ?? 0;

  const isLoading = creditsQuery.isLoading;

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
              icon={Coins}
              value={credits.toLocaleString()}
              label="Credits Remaining"
            />
          </div>

          {/* Empty state */}
          <EmptyState
            icon={LayoutDashboard}
            title="No campaigns yet"
            description="Your competitors are sleeping -- don't let them. Create your first campaign and start showing up where it matters."
            actionLabel="Create Your First Campaign"
            href={routes.dashboard.campaigns.new}
          />
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
