import type { GetServerSideProps } from "next";
import {
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

function PlatformBadge({ platform }: { platform: string }) {
  const colors = platform === "REDDIT"
    ? "bg-orange-100 text-orange-700"
    : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors}`}>
      {platform === "REDDIT" ? "Reddit" : "YouTube"}
    </span>
  );
}

export default function CommentsPage() {
  const postedQuery = trpc.comment.listPosted.useQuery({ limit: 20 });

  return (
    <DashboardLayout>
      <Seo title="Comments -- SlopMog" noIndex />

      <PageHeader
        title="Posted Comments"
        description="Your army of comments, deployed across the internet"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Comments" },
        ]}
      />

      {postedQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading comments..." />
      ) : !postedQuery.data?.items.length ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments posted yet"
          description="Once you approve opportunities in the queue, posted comments will show up here."
          actionLabel="View Queue"
          href={routes.dashboard.queue}
        />
      ) : (
        <div className="space-y-3">
          {postedQuery.data.items.map((comment) => (
            <div
              key={comment.id}
              className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={comment.opportunity.platform} />
                  <span className="text-xs text-charcoal-light">
                    {comment.opportunity.sourceContext}
                  </span>
                  <span className="text-xs text-charcoal-light/50">|</span>
                  <span className="text-xs text-charcoal-light">
                    {comment.site.name}
                  </span>
                </div>
                {comment.postedAt && (
                  <span className="text-xs text-charcoal-light">
                    {new Date(comment.postedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <a
                href={comment.opportunity.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-charcoal hover:text-teal transition-colors flex items-center gap-1 mb-2"
              >
                {comment.opportunity.title}
                <ExternalLink size={12} className="shrink-0 text-charcoal-light" />
              </a>

              <div className="bg-charcoal/[0.02] rounded-brand-sm p-3 border border-charcoal/[0.04]">
                <p className="text-sm text-charcoal whitespace-pre-wrap">{comment.text}</p>
              </div>
            </div>
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
