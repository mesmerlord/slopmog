import type { GetServerSideProps } from "next";
import {
  Megaphone,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function CampaignsListPage() {
  return (
    <DashboardLayout>
      <Seo title="Campaigns -- SlopMog" noIndex />

      <PageHeader
        title="Campaigns"
        description="Your Reddit infiltration missions"
        action={{
          label: "New Campaign",
          href: routes.dashboard.campaigns.new,
        }}
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Campaigns" },
        ]}
      />

      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Time to get your brand on Reddit. Create your first campaign and let the shilling begin."
        actionLabel="Create Your First Campaign"
        href={routes.dashboard.campaigns.new}
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
