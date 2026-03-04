import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import {
  MessageSquare,
  ExternalLink,
  Search,
  ArrowUpDown,
  Globe,
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

type PlatformFilter = "ALL" | "REDDIT" | "YOUTUBE";
type CommentSort = "newest" | "oldest" | "quality";

export default function CommentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<CommentSort>("newest");

  const sitesQuery = trpc.site.list.useQuery();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const postedQuery = trpc.comment.listPosted.useQuery({
    limit: 20,
    search: debouncedSearchTerm || undefined,
    platform: platformFilter === "ALL" ? undefined : platformFilter,
    siteId: siteFilter === "ALL" ? undefined : siteFilter,
    sortBy,
  }, {
    placeholderData: (previousData) => previousData,
  });

  const queryData = postedQuery.data;
  const comments = queryData?.items ?? [];
  const filteredCount = queryData?.filteredCount ?? 0;
  const totalCount = queryData?.totalCount ?? 0;

  const hasActiveControls =
    searchTerm.trim().length > 0 ||
    platformFilter !== "ALL" ||
    siteFilter !== "ALL" ||
    sortBy !== "newest";
  const hasAnyComments = totalCount > 0;

  const resetControls = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setPlatformFilter("ALL");
    setSiteFilter("ALL");
    setSortBy("newest");
  };

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

      {!queryData && postedQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading comments..." />
      ) : !hasAnyComments ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments posted yet"
          description="Once you approve opportunities in the queue, posted comments will show up here."
          actionLabel="View Queue"
          href={routes.dashboard.queue}
        />
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, keyword, source..."
                  className="h-9 w-full rounded-full border border-charcoal/[0.12] bg-white pl-9 pr-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              <div className="flex items-center gap-2">
                {(["ALL", "REDDIT", "YOUTUBE"] as const).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setPlatformFilter(platform)}
                    className={`h-8 rounded-full px-3 text-xs font-bold transition-all ${
                      platformFilter === platform
                        ? "bg-teal text-white"
                        : "border border-charcoal/[0.12] text-charcoal-light hover:border-charcoal/[0.2] hover:text-charcoal"
                    }`}
                  >
                    {platform === "ALL" ? "All" : platform === "REDDIT" ? "Reddit" : "YouTube"}
                  </button>
                ))}
              </div>

              {sitesQuery.data && sitesQuery.data.length > 1 && (
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-charcoal-light shrink-0" />
                  <select
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                    className="h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                  >
                    <option value="ALL">All Sites</option>
                    {sitesQuery.data.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-light">
                  <ArrowUpDown size={12} />
                  Sort
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CommentSort)}
                  className="h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  <option value="newest">Posted: Newest</option>
                  <option value="oldest">Posted: Oldest</option>
                  <option value="quality">Quality Score</option>
                </select>
                <button
                  onClick={resetControls}
                  disabled={!hasActiveControls}
                  className={`h-8 rounded-full border border-charcoal/[0.12] px-3 text-xs font-bold transition-all ${
                    hasActiveControls
                      ? "text-charcoal-light hover:text-charcoal hover:border-charcoal/[0.2]"
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-charcoal-light">
              {hasActiveControls
                ? `Showing ${comments.length} of ${filteredCount} matches (${totalCount} total posted)`
                : `Showing ${comments.length} of ${totalCount}`}
              {postedQuery.isFetching ? " · Updating..." : ""}
            </p>
          </div>

          {/* Comments list */}
          {!comments.length ? (
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-8 text-center">
              <p className="text-sm font-semibold text-charcoal">No comments match these filters.</p>
              <p className="text-xs text-charcoal-light mt-1">Try broadening your search or resetting filters.</p>
              <button
                onClick={resetControls}
                disabled={!hasActiveControls}
                className={`mt-3 inline-flex h-8 items-center rounded-full border border-charcoal/[0.12] px-3 text-xs font-bold transition-all ${
                  hasActiveControls
                    ? "text-charcoal-light hover:text-charcoal hover:border-charcoal/[0.2]"
                    : "opacity-50"
                }`}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
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
                      {comment.opportunity.matchedKeyword && (
                        <>
                          <span className="text-xs text-charcoal-light/50">|</span>
                          <span className="text-xs text-charcoal-light">
                            Keyword: <span className="font-semibold">{comment.opportunity.matchedKeyword}</span>
                          </span>
                        </>
                      )}
                    </div>
                    {comment.postedAt && (
                      <span className="text-xs text-charcoal-light shrink-0 ml-2">
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
