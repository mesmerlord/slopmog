import { useState, useCallback } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Filter,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function CommentsPage() {
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined);
  const [subreddit, setSubreddit] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const campaignsQuery = trpc.campaign.list.useQuery();
  const campaigns = campaignsQuery.data ?? [];

  const commentsQuery = trpc.comment.list.useInfiniteQuery(
    {
      campaignId: campaignId || undefined,
      subreddit: subreddit.trim() || undefined,
      limit: 20,
    },
    {
      getNextPageParam: (last) => last.nextCursor,
    }
  );

  const allComments = commentsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const isLoading = commentsQuery.isLoading;

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-charcoal-light shrink-0" />
          <select
            value={campaignId ?? ""}
            onChange={(e) => setCampaignId(e.target.value || undefined)}
            className="px-4 py-2 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal focus:outline-none focus:border-teal transition-colors"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Filter by subreddit..."
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
          className="px-4 py-2 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors sm:w-56"
        />
      </div>

      {isLoading ? (
        <LoadingState variant="spinner" text="Fetching your comment history..." />
      ) : allComments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments posted yet"
          description="Once your campaigns find opportunities, comments will show up here."
          actionLabel="View Campaigns"
          href={routes.dashboard.campaigns.index}
        />
      ) : (
        <div className="space-y-3">
          {allComments.map((item) => {
            const isExpanded = expandedIds.has(item.id);

            return (
              <div
                key={item.id}
                className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 hover:shadow-brand-md transition-shadow"
              >
                {/* Top row: title + subreddit */}
                <div className="flex flex-wrap items-start gap-2 mb-2">
                  <a
                    href={item.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-heading font-bold text-charcoal text-[0.95rem] hover:text-teal transition-colors flex items-center gap-1.5 leading-snug"
                  >
                    {item.title}
                    <ExternalLink size={13} className="shrink-0 text-charcoal-light" />
                  </a>
                  <span className="shrink-0 text-[0.72rem] font-bold bg-lavender/10 text-lavender px-2.5 py-0.5 rounded-full">
                    r/{item.subreddit}
                  </span>
                </div>

                {/* Comment text */}
                {item.generatedComment && (
                  <div className="mb-3">
                    <p
                      className={`text-sm text-charcoal-light leading-relaxed ${
                        isExpanded ? "" : "line-clamp-3"
                      }`}
                    >
                      {item.generatedComment}
                    </p>
                    {item.generatedComment.length > 200 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-[0.78rem] font-semibold text-teal hover:text-teal-dark transition-colors mt-1 flex items-center gap-0.5"
                      >
                        {isExpanded ? (
                          <>
                            Show less <ChevronUp size={13} />
                          </>
                        ) : (
                          <>
                            Read more <ChevronDown size={13} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-charcoal-light">
                  {item.postedAt && (
                    <span>
                      Posted{" "}
                      {new Date(item.postedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}

                  {item.score > 0 && (
                    <span className="font-semibold">
                      {item.score} point{item.score !== 1 ? "s" : ""}
                    </span>
                  )}

                  {item.postedCommentUrl && (
                    <a
                      href={item.postedCommentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal font-semibold hover:text-teal-dark transition-colors flex items-center gap-1"
                    >
                      View on Reddit
                      <ExternalLink size={11} />
                    </a>
                  )}

                  {item.campaign && (
                    <span className="ml-auto text-[0.7rem] font-bold bg-teal/10 text-teal-dark px-2.5 py-0.5 rounded-full">
                      {item.campaign.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {commentsQuery.hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => commentsQuery.fetchNextPage()}
                disabled={commentsQuery.isFetchingNextPage}
                className="inline-flex items-center gap-2 border-2 border-teal text-teal px-6 py-2.5 rounded-full font-bold text-sm hover:bg-teal/10 transition-colors disabled:opacity-50"
              >
                {commentsQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
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
