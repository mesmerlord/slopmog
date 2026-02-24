import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  Megaphone,
  Hash,
  Globe,
  Calendar,
  Plus,
  Trash2,
  MessageSquare,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

const STATUS_CONFIG: Record<string, { badge: string; dot: string; accent: string; label: string }> = {
  ACTIVE: {
    badge: "bg-teal/10 text-teal-dark",
    dot: "bg-teal",
    accent: "from-teal to-teal-dark",
    label: "Active",
  },
  DRAFT: {
    badge: "bg-charcoal/[0.07] text-charcoal-light",
    dot: "bg-charcoal-light",
    accent: "from-charcoal/30 to-charcoal/50",
    label: "Draft",
  },
  PAUSED: {
    badge: "bg-sunny/20 text-sunny-dark",
    dot: "bg-sunny-dark",
    accent: "from-sunny to-sunny-dark",
    label: "Paused",
  },
  COMPLETED: {
    badge: "bg-lavender/10 text-lavender-dark",
    dot: "bg-lavender",
    accent: "from-lavender to-lavender-dark",
    label: "Completed",
  },
  FAILED: {
    badge: "bg-coral/10 text-coral-dark",
    dot: "bg-coral",
    accent: "from-coral to-coral-dark",
    label: "Failed",
  },
};

const DEFAULT_STATUS = STATUS_CONFIG.DRAFT;

export default function CampaignsListPage() {
  const utils = trpc.useUtils();
  const campaignsQuery = trpc.campaign.list.useQuery();
  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete campaign");
    },
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* New campaign card */}
          <Link
            href={routes.dashboard.campaigns.new}
            className="flex flex-col items-center justify-center bg-white rounded-brand shadow-brand-sm border-2 border-dashed border-charcoal/[0.1] p-8 hover:border-teal/40 hover:-translate-y-1 hover:shadow-brand-md transition-all group min-h-[220px]"
          >
            <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center mb-3 group-hover:bg-teal/20 group-hover:scale-110 transition-all">
              <Plus size={26} className="text-teal" />
            </div>
            <span className="font-heading font-bold text-charcoal text-sm">
              New Campaign
            </span>
            <span className="text-xs text-charcoal-light mt-1">
              Launch another infiltration
            </span>
          </Link>

          {/* Campaign cards */}
          {campaigns.map((campaign) => {
            const status = STATUS_CONFIG[campaign.status] ?? DEFAULT_STATUS;
            return (
              <div
                key={campaign.id}
                className="relative bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] overflow-hidden hover:-translate-y-1 hover:shadow-brand-md transition-all group flex flex-col"
              >
                {/* Status accent bar */}
                <div className={`h-1 w-full bg-gradient-to-r ${status.accent}`} />

                {/* Card body — clickable */}
                <Link
                  href={routes.dashboard.campaigns.detail(campaign.id)}
                  className="flex flex-col flex-1 p-5 pb-0"
                >
                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="font-heading font-bold text-charcoal group-hover:text-teal transition-colors line-clamp-1 text-[1.05rem]">
                      {campaign.name}
                    </h3>
                    <span
                      className={`flex items-center gap-1.5 text-[0.68rem] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${status.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[0.82rem] text-charcoal-light line-clamp-2 mb-4 min-h-[2.5rem]">
                    {campaign.description || "No description yet"}
                  </p>

                  {/* Stats pills */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold bg-teal/[0.07] text-teal-dark px-2.5 py-1 rounded-full">
                      <Search size={11} />
                      {campaign._count.opportunities} opportunities
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold bg-coral/[0.07] text-coral-dark px-2.5 py-1 rounded-full">
                      <MessageSquare size={11} />
                      {campaign._count.posts} posts
                    </span>
                  </div>
                </Link>

                {/* Footer row */}
                <div className="mx-5 pt-3 pb-4 border-t border-charcoal/[0.06] flex items-center gap-3.5 text-[0.75rem] text-charcoal-light">
                  <span className="flex items-center gap-1" title="Keywords">
                    <Hash size={12} className="text-teal/60" />
                    {campaign.keywords.length} keywords
                  </span>
                  <span className="flex items-center gap-1" title="Subreddits">
                    <Globe size={12} className="text-lavender/80" />
                    {campaign.subreddits.length} subs
                  </span>
                  <span className="flex items-center gap-1 ml-auto" title="Created">
                    <Calendar size={12} />
                    {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget({ id: campaign.id, name: campaign.name });
                    }}
                    className="p-1.5 rounded-lg text-charcoal/20 hover:text-coral hover:bg-coral/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete campaign"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete campaign?"
        description={`This will permanently nuke "${deleteTarget?.name ?? ""}" and all its opportunities, posts, and keywords. No take-backs.`}
        confirmLabel="Delete it"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
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
