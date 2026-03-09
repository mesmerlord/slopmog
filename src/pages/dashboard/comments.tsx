import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import {
  MessageSquare,
  ExternalLink,
  Search,
  ArrowUpDown,
  Globe,
  Sparkles,
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

const MODEL_COLORS: Record<string, string> = {
  gemini: "bg-blue-100 text-blue-700",
  claude: "bg-orange-100 text-orange-700",
  gpt: "bg-green-100 text-green-700",
  grok: "bg-purple-100 text-purple-700",
};

function CitationBadge({ models, score }: { models: string[]; score: number }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {models.map((m) => (
        <span
          key={m}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${MODEL_COLORS[m] ?? "bg-gray-100 text-gray-600"}`}
        >
          {m}
        </span>
      ))}
      <span className="text-[10px] font-semibold text-charcoal-light">
        {Math.round(score * 100)}% citation
      </span>
    </div>
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

  const filterInput = {
    limit: 20,
    search: debouncedSearchTerm || undefined,
    platform: platformFilter === "ALL" ? undefined : platformFilter,
    siteId: siteFilter === "ALL" ? undefined : siteFilter,
    sortBy,
  } as const;

  const postedQuery = trpc.comment.listPosted.useQuery(filterInput, {
    placeholderData: (previousData) => previousData,
  });

  const hvPostedQuery = trpc.hvComment.listPosted.useQuery(filterInput, {
    placeholderData: (previousData) => previousData,
  });

  const queryData = postedQuery.data;
  const comments = queryData?.items ?? [];
  const filteredCount = queryData?.filteredCount ?? 0;
  const totalCount = queryData?.totalCount ?? 0;

  const hvData = hvPostedQuery.data;
  const hvComments = hvData?.items ?? [];
  const hvFilteredCount = hvData?.filteredCount ?? 0;
  const hvTotalCount = hvData?.totalCount ?? 0;

  const hasActiveControls =
    searchTerm.trim().length > 0 ||
    platformFilter !== "ALL" ||
    siteFilter !== "ALL" ||
    sortBy !== "newest";
  const hasAnyComments = totalCount > 0 || hvTotalCount > 0;

  const isLoading = (!queryData && postedQuery.isLoading) || (!hvData && hvPostedQuery.isLoading);

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

      {isLoading ? (
        <LoadingState variant="spinner" text="Loading comments..." />
      ) : !hasAnyComments && !hasActiveControls ? (
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
          </div>

          {/* Regular Comments Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-teal" />
                <h2 className="text-sm font-bold text-charcoal">Daily Comments</h2>
              </div>
              <p className="text-xs text-charcoal-light">
                {hasActiveControls
                  ? `${comments.length} of ${filteredCount} matches (${totalCount} total)`
                  : `${comments.length} of ${totalCount}`}
                {postedQuery.isFetching ? " · Updating..." : ""}
              </p>
            </div>

            {!comments.length ? (
              <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-6 text-center">
                <p className="text-sm font-semibold text-charcoal">
                  {totalCount === 0 ? "No daily comments posted yet." : "No daily comments match these filters."}
                </p>
                {hasActiveControls && totalCount > 0 && (
                  <button
                    onClick={resetControls}
                    className="mt-2 inline-flex h-8 items-center rounded-full border border-charcoal/[0.12] px-3 text-xs font-bold text-charcoal-light hover:text-charcoal hover:border-charcoal/[0.2] transition-all"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
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

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-charcoal/[0.08]" />
            </div>
          </div>

          {/* HV Comments Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-sunny" />
                <h2 className="text-sm font-bold text-charcoal">High-Value Comments</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sunny/20 text-yellow-700">
                  HV
                </span>
              </div>
              <p className="text-xs text-charcoal-light">
                {hasActiveControls
                  ? `${hvComments.length} of ${hvFilteredCount} matches (${hvTotalCount} total)`
                  : `${hvComments.length} of ${hvTotalCount}`}
                {hvPostedQuery.isFetching ? " · Updating..." : ""}
              </p>
            </div>

            {!hvComments.length ? (
              <div className="bg-white rounded-brand shadow-brand-sm border border-sunny/20 p-6 text-center">
                <p className="text-sm font-semibold text-charcoal">
                  {hvTotalCount === 0 ? "No high-value comments posted yet." : "No high-value comments match these filters."}
                </p>
                <p className="text-xs text-charcoal-light mt-1">
                  {hvTotalCount === 0
                    ? "Run HV Discovery to find threads AI chatbots are citing, then approve them from the HV Queue."
                    : "Try broadening your search or resetting filters."}
                </p>
                {hasActiveControls && hvTotalCount > 0 && (
                  <button
                    onClick={resetControls}
                    className="mt-2 inline-flex h-8 items-center rounded-full border border-charcoal/[0.12] px-3 text-xs font-bold text-charcoal-light hover:text-charcoal hover:border-charcoal/[0.2] transition-all"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {hvComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-brand shadow-brand-sm border border-sunny/20 p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlatformBadge platform={comment.hvOpportunity.platform} />
                        <span className="text-xs text-charcoal-light">
                          {comment.hvOpportunity.sourceContext}
                        </span>
                        <span className="text-xs text-charcoal-light/50">|</span>
                        <span className="text-xs text-charcoal-light">
                          {comment.site.name}
                        </span>
                      </div>
                      {comment.postedAt && (
                        <span className="text-xs text-charcoal-light shrink-0 ml-2">
                          {new Date(comment.postedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <a
                      href={comment.hvOpportunity.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-charcoal hover:text-teal transition-colors flex items-center gap-1 mb-2"
                    >
                      {comment.hvOpportunity.title}
                      <ExternalLink size={12} className="shrink-0 text-charcoal-light" />
                    </a>

                    <div className="mb-2">
                      <CitationBadge
                        models={comment.hvOpportunity.citingModels}
                        score={comment.hvOpportunity.citationScore}
                      />
                    </div>

                    <div className="bg-sunny/[0.04] rounded-brand-sm p-3 border border-sunny/[0.1]">
                      <p className="text-sm text-charcoal whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
