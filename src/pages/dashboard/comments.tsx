import type { GetServerSideProps } from "next";
import {
  MessageSquare,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function CommentsPage() {
  return (
    <DashboardLayout>
      <Seo title="Comments -- SlopMog" noIndex />

      <PageHeader
        title="Posted Comments"
        description="Your Reddit comment army, deployed and tracked"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Comments" },
        ]}
      />

      <EmptyState
        icon={MessageSquare}
        title="No comments posted yet"
        description="Once your campaigns find opportunities, comments will show up here."
        actionLabel="View Campaigns"
        href={routes.dashboard.campaigns.index}
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
