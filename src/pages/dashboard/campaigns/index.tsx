import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  Megaphone,
  Hash,
  Globe,
  Calendar,
  Plus,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
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

export default function CampaignsListPage() {
  const campaignsQuery = trpc.campaign.list.useQuery();

  const campaigns = campaignsQuery.data ?? [];
  const isLoading = campaignsQuery.isLoading;

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

      {isLoading ? (
        <LoadingState variant="spinner" text="Rounding up your campaigns..." />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Time to get your brand on Reddit. Create your first campaign and let the shilling begin."
          actionLabel="Create Your First Campaign"
          href={routes.dashboard.campaigns.new}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* New campaign card */}
          <Link
            href={routes.dashboard.campaigns.new}
            className="flex flex-col items-center justify-center bg-white rounded-brand shadow-brand-sm border-2 border-dashed border-charcoal/[0.1] p-8 hover:border-teal/40 hover:-translate-y-0.5 hover:shadow-brand-md transition-all group min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center mb-3 group-hover:bg-teal/20 transition-colors">
              <Plus size={24} className="text-teal" />
            </div>
            <span className="font-heading font-bold text-charcoal text-sm">
              New Campaign
            </span>
          </Link>

          {/* Campaign cards */}
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={routes.dashboard.campaigns.detail(campaign.id)}
              className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 hover:-translate-y-0.5 hover:shadow-brand-md transition-all group flex flex-col"
            >
              {/* Top row: name + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-heading font-bold text-charcoal group-hover:text-teal transition-colors line-clamp-1">
                  {campaign.name}
                </h3>
                <span
                  className={`text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                    STATUS_COLORS[campaign.status] ?? STATUS_COLORS.DRAFT
                  }`}
                >
                  {campaign.status}
                </span>
              </div>

              {/* Description if present */}
              {campaign.description && (
                <p className="text-[0.82rem] text-charcoal-light line-clamp-2 mb-3">
                  {campaign.description}
                </p>
              )}

              {/* Meta row */}
              <div className="mt-auto pt-3 border-t border-charcoal/[0.06] flex items-center gap-4 text-[0.78rem] text-charcoal-light">
                <span className="flex items-center gap-1" title="Keywords">
                  <Hash size={12} />
                  {campaign.keywords.length}
                </span>
                <span className="flex items-center gap-1" title="Subreddits">
                  <Globe size={12} />
                  {campaign.subreddits.length}
                </span>
                <span className="flex items-center gap-1 ml-auto" title="Created">
                  <Calendar size={12} />
                  {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
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
