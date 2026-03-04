import { useState, useEffect, useRef } from "react";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Inbox,
  Check,
  X,
  Pencil,
  ExternalLink,
  RefreshCw,
  Search,
  ArrowUpDown,
  Globe,
  Loader2,
  Lock,
  Sparkles,
  ArrowUp,
  MessageSquare,
  Eye,
  ThumbsUp,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import GeneratingMascotV1 from "@/components/illustrations/GeneratingMascotV1";
import UpgradeUpsellMascot from "@/components/illustrations/UpgradeUpsellMascot";
import { PERSONAS } from "@/constants/personas";
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

function formatPostedDate(value: Date | string | null | undefined): string {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type OpportunityMetadata = {
  score?: number;
  permalink?: string;
  subredditSubscribers?: number;
  likeCount?: number;
  channelId?: string;
  thumbnail?: string;
};

function parseMetadata(value: unknown): OpportunityMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as OpportunityMetadata;
  }
  return {};
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

type PlatformFilter = "ALL" | "REDDIT" | "YOUTUBE";
type QueueSort = "best_match" | "posted_newest" | "posted_oldest" | "queue_newest" | "queue_oldest";

interface QueueItemProps {
  opportunity: {
    id: string;
    title: string;
    contentUrl: string;
    platform: string;
    sourceContext: string;
    publishedAt: Date | string | null;
    relevanceScore: number;
    matchedKeyword: string;
    viewCount?: number | null;
    commentCount?: number | null;
    metadata?: unknown;
    site: { id: string; name: string; url: string };
    comments: Array<{ id: string; text: string; qualityScore: number; persona: string }>;
  };
  onApprove: (commentId: string) => void;
  onSkip: (commentId: string) => void;
  onEdit: (commentId: string, text: string) => void;
  onRegenerate: (commentId: string, persona: string) => void;
  onGenerate: (opportunityId: string) => void;
  isActing: boolean;
  isRegenerating: boolean;
  isGenerating: boolean;
}

function QueueItem({
  opportunity,
  onApprove,
  onSkip,
  onEdit,
  onRegenerate,
  onGenerate,
  isActing,
  isRegenerating,
  isGenerating,
}: QueueItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [persona, setPersona] = useState("auto");
  const comment = opportunity.comments[0];

  useEffect(() => {
    if (comment) setPersona(comment.persona || "auto");
  }, [comment?.persona, comment?.id]);

  const handleStartEdit = () => {
    if (!comment) return;
    setEditText(comment.text);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!comment) return;
    onEdit(comment.id, editText);
    setEditing(false);
  };

  const disabled = isActing || isRegenerating;

  return (
    <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 min-h-[280px] flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PlatformBadge platform={opportunity.platform} />
            <span className="text-xs text-charcoal-light">{opportunity.sourceContext}</span>
            <span className="text-xs text-charcoal-light/50">|</span>
            <span className="text-xs text-charcoal-light">
              Score: {(opportunity.relevanceScore * 100).toFixed(0)}%
            </span>
            {(() => {
              const meta = parseMetadata(opportunity.metadata);
              return (
                <>
                  {opportunity.platform === "REDDIT" && (
                    <>
                      {meta.score != null && meta.score > 0 && (
                        <>
                          <span className="text-xs text-charcoal-light/50">|</span>
                          <span className="text-xs text-charcoal-light flex items-center gap-0.5">
                            <ArrowUp size={11} /> {formatCompact(meta.score)}
                          </span>
                        </>
                      )}
                      {opportunity.commentCount != null && opportunity.commentCount > 0 && (
                        <>
                          <span className="text-xs text-charcoal-light/50">|</span>
                          <span className="text-xs text-charcoal-light flex items-center gap-0.5">
                            <MessageSquare size={11} /> {formatCompact(opportunity.commentCount)}
                          </span>
                        </>
                      )}
                    </>
                  )}
                  {opportunity.platform === "YOUTUBE" && (
                    <>
                      {opportunity.viewCount != null && opportunity.viewCount > 0 && (
                        <>
                          <span className="text-xs text-charcoal-light/50">|</span>
                          <span className="text-xs text-charcoal-light flex items-center gap-0.5">
                            <Eye size={11} /> {formatCompact(opportunity.viewCount)}
                          </span>
                        </>
                      )}
                      {meta.likeCount != null && meta.likeCount > 0 && (
                        <>
                          <span className="text-xs text-charcoal-light/50">|</span>
                          <span className="text-xs text-charcoal-light flex items-center gap-0.5">
                            <ThumbsUp size={11} /> {formatCompact(meta.likeCount)}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </>
              );
            })()}
            <span className="text-xs text-charcoal-light/50">|</span>
            <span className="text-xs font-semibold text-charcoal">
              Posted: {formatPostedDate(opportunity.publishedAt)}
            </span>
          </div>
          <a
            href={opportunity.contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading font-bold text-charcoal hover:text-teal transition-colors text-base flex items-center gap-1 line-clamp-1"
          >
            <span className="truncate">{opportunity.title}</span>
            <ExternalLink size={14} className="shrink-0 text-charcoal-light" />
          </a>
          <p className="text-xs text-charcoal-light mt-0.5">
            Keyword: <span className="font-semibold">{opportunity.matchedKeyword}</span>
            {" | "}Site: {opportunity.site.name}
          </p>
        </div>
      </div>

      {comment ? (
        <>
          {/* Comment */}
          <div className="bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-4 mb-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-charcoal-light uppercase">
                Generated Comment ({comment.persona})
              </span>
              <span className="text-xs text-charcoal-light">
                Quality: {(comment.qualityScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                disabled={disabled}
                className="h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30 disabled:opacity-60"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onRegenerate(comment.id, persona)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 px-3 py-1.5 text-xs font-bold text-teal hover:bg-teal/5 transition-all disabled:opacity-50"
              >
                <RefreshCw size={13} className={isRegenerating ? "animate-spin" : ""} />
                Regenerate
              </button>
            </div>
            {isRegenerating ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <div className="h-20 w-20">
                  <GeneratingMascotV1 className="h-full w-full" />
                </div>
                <p className="text-xs font-semibold text-charcoal-light">Regenerating comment...</p>
              </div>
            ) : editing ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-3 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y min-h-[80px]"
                  rows={4}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={disabled}
                    className="px-3 py-1.5 bg-teal text-white rounded-full text-xs font-bold hover:bg-teal-dark transition-all"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={disabled}
                    className="px-3 py-1.5 border border-charcoal/[0.1] text-charcoal-light rounded-full text-xs font-bold hover:bg-charcoal/[0.04] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-charcoal whitespace-pre-wrap line-clamp-6">{comment.text}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(comment.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-teal-dark transition-all disabled:opacity-50"
            >
              <Check size={14} />
              Approve
            </button>
            {!editing && (
              <button
                onClick={handleStartEdit}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 border border-charcoal/[0.12] text-charcoal px-4 py-2 rounded-full text-sm font-bold hover:bg-charcoal/[0.04] transition-all"
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
            <button
              onClick={() => onSkip(comment.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 border border-coral/30 text-coral px-4 py-2 rounded-full text-sm font-bold hover:bg-coral/5 transition-all disabled:opacity-50"
            >
              <X size={14} />
              Skip
            </button>
          </div>
        </>
      ) : (
        <div className="bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-4 flex-1 flex flex-col items-center justify-center gap-3">
          {isGenerating ? (
            <>
              <div className="h-16 w-16">
                <GeneratingMascotV1 className="h-full w-full" />
              </div>
              <p className="text-xs font-semibold text-charcoal-light">Generating comment...</p>
            </>
          ) : (
            <>
              <p className="text-sm text-charcoal-light">No comment yet for this opportunity.</p>
              <button
                onClick={() => onGenerate(opportunity.id)}
                className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-teal-dark transition-all"
              >
                <RefreshCw size={14} />
                Generate Comment
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function QueuePage() {
  const utils = trpc.useUtils();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [regeneratingOn, setRegeneratingOn] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<QueueSort>("best_match");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const sitesQuery = trpc.site.list.useQuery();
  const planQuery = trpc.user.getPlanInfo.useQuery();
  const isPaid = planQuery.data?.isPaid ?? false;
  const discoveryStatusQuery = trpc.site.hasRunningDiscovery.useQuery();
  const discoveryRunning = discoveryStatusQuery.data?.isRunning ?? false;
  const discoveryRuns = discoveryStatusQuery.data?.runs ?? [];

  // Poll discovery status while running
  useEffect(() => {
    if (!discoveryRunning) return;
    const interval = setInterval(() => {
      discoveryStatusQuery.refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [discoveryRunning, discoveryStatusQuery]);

  // Poll pending list while discovery is running so items appear incrementally
  useEffect(() => {
    if (!discoveryRunning) return;
    const interval = setInterval(() => {
      utils.opportunity.listPending.invalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [discoveryRunning, utils]);

  // Auto-invalidate pending list when discovery finishes
  const prevRunningRef = useRef(discoveryRunning);
  useEffect(() => {
    if (prevRunningRef.current && !discoveryRunning) {
      utils.opportunity.listPending.invalidate();
    }
    prevRunningRef.current = discoveryRunning;
  }, [discoveryRunning, utils]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const pendingQuery = trpc.opportunity.listPending.useInfiniteQuery(
    {
      limit: 20,
      search: debouncedSearchTerm || undefined,
      platform: platformFilter === "ALL" ? undefined : platformFilter,
      siteId: siteFilter === "ALL" ? undefined : siteFilter,
      sortBy,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const approveMutation = trpc.comment.approve.useMutation({
    onSuccess: () => {
      toast.success("Comment approved and queued for posting!");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        setShowUpgradeModal(true);
      }
      toast.error(err.message);
    },
    onSettled: () => setActingOn(null),
  });

  const skipMutation = trpc.comment.skip.useMutation({
    onSuccess: () => {
      toast.success("Skipped.");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setActingOn(null),
  });

  const editMutation = trpc.comment.edit.useMutation({
    onSuccess: () => {
      toast.success("Comment updated.");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateMutation = trpc.comment.regenerate.useMutation({
    onSuccess: () => {
      toast.success("Comment regenerated.");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setRegeneratingOn(null),
  });

  const [generatingOn, setGeneratingOn] = useState<string | null>(null);
  const generateMutation = trpc.opportunity.generate.useMutation({
    onSuccess: () => {
      toast.success("Comment generated!");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setGeneratingOn(null),
  });

  const allPages = pendingQuery.data?.pages ?? [];
  const queueItems = allPages.flatMap((p) => p.items);
  const filteredCount = allPages[0]?.filteredCount ?? 0;
  const totalPendingCount = allPages[0]?.totalPendingCount ?? 0;

  const hasActiveControls =
    searchTerm.trim().length > 0 ||
    platformFilter !== "ALL" ||
    siteFilter !== "ALL" ||
    sortBy !== "best_match";
  const hasAnyPending = totalPendingCount > 0;

  const resetControls = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setPlatformFilter("ALL");
    setSiteFilter("ALL");
    setSortBy("best_match");
  };

  return (
    <DashboardLayout>
      <Seo title="Queue -- SlopMog" noIndex />

      <PageHeader
        title="Review Queue"
        description="Approve, edit, or skip discovered opportunities"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Queue" },
        ]}
      />

      {/* Discovery in-progress banner */}
      {discoveryRunning && (
        <div className="bg-teal/[0.06] border border-teal/20 rounded-brand p-4 mb-4 flex items-start gap-3">
          <Loader2 size={18} className="animate-spin text-teal mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-charcoal">Discovery in progress</p>
            {discoveryRuns.map((run) => (
              <p key={run.id} className="text-xs text-charcoal-light mt-0.5">
                Scanning {run.platform === "REDDIT" ? "Reddit" : "YouTube"} for {run.site.name}
              </p>
            ))}
            <p className="text-xs text-charcoal-light/60 mt-1">
              New opportunities will appear here automatically
            </p>
          </div>
        </div>
      )}

      {!allPages.length && pendingQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading queue..." />
      ) : !hasAnyPending && discoveryRunning ? (
        <div className="flex flex-col items-center justify-center text-center px-6 py-12 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06]">
          <Loader2 size={32} className="animate-spin text-teal mb-4" />
          <h3 className="font-heading text-lg font-bold text-charcoal mb-1">
            Discovery is working its magic
          </h3>
          <p className="text-sm text-charcoal-light max-w-sm">
            We're scanning platforms for conversations about your brand. Items will start appearing here shortly.
          </p>
        </div>
      ) : !hasAnyPending ? (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="No opportunities waiting for review. Run discovery on a site to find new ones."
          actionLabel="View Sites"
          href={routes.dashboard.sites.index}
        />
      ) : (
        <div className="space-y-4">
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
                  onChange={(e) => setSortBy(e.target.value as QueueSort)}
                  className="h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  <option value="best_match">Best Match</option>
                  <option value="posted_newest">Posted Date: Newest</option>
                  <option value="posted_oldest">Posted Date: Oldest</option>
                  <option value="queue_newest">Added To Queue: Newest</option>
                  <option value="queue_oldest">Added To Queue: Oldest</option>
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
                ? `Showing ${queueItems.length} of ${filteredCount} matches (${totalPendingCount} total pending)`
                : `Showing ${queueItems.length} of ${totalPendingCount}`}
              {pendingQuery.isFetching ? " · Updating..." : ""}
            </p>
          </div>

          {!queueItems.length ? (
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-8 text-center">
              <p className="text-sm font-semibold text-charcoal">No queue items match these filters.</p>
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
            <>
              {queueItems.map((opp) => (
                <QueueItem
                  key={opp.id}
                  opportunity={opp}
                  onApprove={(commentId) => {
                    setActingOn(commentId);
                    approveMutation.mutate({ commentId });
                  }}
                  onSkip={(commentId) => {
                    setActingOn(commentId);
                    skipMutation.mutate({ commentId });
                  }}
                  onEdit={(commentId, text) => {
                    editMutation.mutate({ commentId, text });
                  }}
                  onRegenerate={(commentId, persona) => {
                    setRegeneratingOn(commentId);
                    regenerateMutation.mutate({ commentId, persona });
                  }}
                  onGenerate={(opportunityId) => {
                    setGeneratingOn(opportunityId);
                    generateMutation.mutate({ opportunityId });
                  }}
                  isActing={actingOn !== null}
                  isRegenerating={regeneratingOn === opp.comments[0]?.id}
                  isGenerating={generatingOn === opp.id}
                />
              ))}

              {/* Load More for paid users */}
              {isPaid && pendingQuery.hasNextPage && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => pendingQuery.fetchNextPage()}
                    disabled={pendingQuery.isFetchingNextPage}
                    className="inline-flex items-center gap-2 bg-teal text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-teal-dark transition-all disabled:opacity-60"
                  >
                    {pendingQuery.isFetchingNextPage ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}

              {/* Free-user upsell: See More */}
              {!isPaid && totalPendingCount > queueItems.length && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="group w-full bg-gradient-to-b from-white to-sunny/[0.08] rounded-brand shadow-brand-sm border border-sunny/20 hover:border-sunny/40 p-8 flex flex-col items-center gap-4 transition-all hover:shadow-brand-md"
                >
                  <div className="h-28 w-44">
                    <UpgradeUpsellMascot className="h-full w-full" />
                  </div>
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 mb-1.5">
                      <Sparkles size={16} className="text-sunny" />
                      <span className="font-heading font-bold text-charcoal text-lg">
                        {totalPendingCount - queueItems.length} more opportunities waiting
                      </span>
                      <Sparkles size={16} className="text-sunny" />
                    </div>
                    <p className="text-sm text-charcoal-light max-w-md mx-auto">
                      We found more conversations where your brand fits naturally. Upgrade to unlock the full queue and auto-generated comments.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 bg-coral text-white px-6 py-2.5 rounded-full text-sm font-bold group-hover:bg-coral-dark transition-all">
                    <Lock size={14} />
                    Upgrade to See More
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Posting requires a paid plan"
        description="Upgrade to approve and publish comments across platforms."
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
