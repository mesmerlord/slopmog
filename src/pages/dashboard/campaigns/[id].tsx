import Link from "next/link";
import type { GetServerSideProps } from "next";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function CampaignDetailPage() {
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
