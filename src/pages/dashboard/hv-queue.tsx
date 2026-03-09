import { useState, useEffect, useRef } from "react";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Sparkles,
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
  Zap,
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
import { PERSONAS } from "@/constants/personas";
import { CREDIT_COSTS } from "@/constants/credits";
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

function ModelPills({ models }: { models: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {models.map((model) => (
        <span
          key={model}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${MODEL_COLORS[model] ?? "bg-charcoal/10 text-charcoal"}`}
        >
          {model}
        </span>
      ))}
    </div>
  );
}

function CitationBadge({ score, modelCount }: { score: number; modelCount: number }) {
  const strength = score >= 0.7 ? "text-teal bg-teal/10 border-teal/20"
    : score >= 0.4 ? "text-sunny-dark bg-sunny/10 border-sunny/20"
    : "text-charcoal-light bg-charcoal/[0.04] border-charcoal/10";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${strength}`}>
      <Zap size={10} />
      {modelCount}/4 AI models
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

type HVOpportunityMetadata = {
  score?: number;
  permalink?: string;
  subredditSubscribers?: number;
  likeCount?: number;
  channelId?: string;
  thumbnail?: string;
};

function parseMetadata(value: unknown): HVOpportunityMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as HVOpportunityMetadata;
  }
  return {};
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

type PlatformFilter = "ALL" | "REDDIT" | "YOUTUBE";
type HVSort = "citation_score" | "posted_newest" | "posted_oldest" | "queue_newest" | "queue_oldest";

interface HVQueueItemProps {
  opportunity: {
    id: string;
    title: string;
    contentUrl: string;
    platform: string;
    sourceContext: string;
    citationScore: number;
    citingModels: string[];
    citingQueries: string[];
    citationCount: number;
    isLocked: boolean;
    isArchived: boolean;
    viewCount?: number | null;
    commentCount?: number | null;
    metadata?: unknown;
    publishedAt?: Date | string | null;
    site: { id: string; name: string; url: string };
    hvComments: Array<{ id: string; text: string; qualityScore: number; persona: string }>;
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

function HVQueueItem({
  opportunity,
  onApprove,
  onSkip,
  onEdit,
  onRegenerate,
  onGenerate,
  isActing,
  isRegenerating,
  isGenerating,
}: HVQueueItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [persona, setPersona] = useState("auto");
  const [showQueries, setShowQueries] = useState(false);
  const comment = opportunity.hvComments[0];

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
  const platformKey = opportunity.platform.toLowerCase() as "reddit" | "youtube";
  const creditCost = CREDIT_COSTS.highValue[platformKey];

  return (
    <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 min-h-[280px] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <PlatformBadge platform={opportunity.platform} />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-teal/10 to-sunny/10 text-teal border border-teal/20">
              <Sparkles size={10} />
              High Value
            </span>
            <CitationBadge score={opportunity.citationScore} modelCount={opportunity.citingModels.length} />
            {opportunity.isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coral/10 text-coral border border-coral/20">
                <Lock size={10} /> Locked
              </span>
            )}
          </div>

          {/* Model pills + metadata */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <ModelPills models={opportunity.citingModels} />
            <span className="text-xs text-charcoal-light">
              Score: {(opportunity.citationScore * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-charcoal-light/50">|</span>
            <span className="text-xs text-charcoal-light">{opportunity.sourceContext}</span>
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
            Site: {opportunity.site.name}
            {" | "}
            {creditCost} credits to post
          </p>

          {/* Expandable queries */}
          {opportunity.citingQueries.length > 0 && (
            <button
              onClick={() => setShowQueries(!showQueries)}
              className="mt-1 text-xs text-teal hover:text-teal-dark font-semibold transition-colors"
            >
              {showQueries ? "Hide" : "Show"} citing queries ({opportunity.citingQueries.length})
            </button>
          )}
          {showQueries && (
            <div className="mt-1.5 pl-3 border-l-2 border-teal/20 space-y-0.5">
              {opportunity.citingQueries.map((q, i) => (
                <p key={i} className="text-xs text-charcoal-light italic">"{q}"</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment section */}
      {comment ? (
        <>
          <div className="bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-4 mb-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-charcoal-light uppercase">
                HV Comment ({comment.persona})
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
                <p className="text-xs font-semibold text-charcoal-light">Regenerating HV comment...</p>
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
              Approve ({creditCost} credits)
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
              <p className="text-xs font-semibold text-charcoal-light">Generating HV comment...</p>
            </>
          ) : (
            <>
              <p className="text-sm text-charcoal-light">No comment yet for this opportunity.</p>
              <button
                onClick={() => onGenerate(opportunity.id)}
                className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-teal-dark transition-all"
              >
                <RefreshCw size={14} />
                Generate HV Comment
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function HVQueuePage() {
  const utils = trpc.useUtils();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [regeneratingOn, setRegeneratingOn] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<HVSort>("citation_score");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const sitesQuery = trpc.site.list.useQuery();
  const discoveryStatusQuery = trpc.hvOpportunity.hasRunningDiscovery.useQuery();
  const discoveryRunning = discoveryStatusQuery.data?.isRunning ?? false;
  const discoveryRuns = discoveryStatusQuery.data?.runs ?? [];

  // Poll discovery status while running
  useEffect(() => {
    if (!discoveryRunning) return;
    const interval = setInterval(() => {
      discoveryStatusQuery.refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [discoveryRunning, discoveryStatusQuery]);

  // Poll pending list while discovery is running
  useEffect(() => {
    if (!discoveryRunning) return;
    const interval = setInterval(() => {
      utils.hvOpportunity.listPending.invalidate();
    }, 8000);
    return () => clearInterval(interval);
  }, [discoveryRunning, utils]);

  // Auto-invalidate when discovery finishes
  const prevRunningRef = useRef(discoveryRunning);
  useEffect(() => {
    if (prevRunningRef.current && !discoveryRunning) {
      utils.hvOpportunity.listPending.invalidate();
    }
    prevRunningRef.current = discoveryRunning;
  }, [discoveryRunning, utils]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const pendingQuery = trpc.hvOpportunity.listPending.useInfiniteQuery(
    {
      limit: 10,
      search: debouncedSearchTerm || undefined,
      platform: platformFilter === "ALL" ? undefined : platformFilter,
      siteId: siteFilter === "ALL" ? undefined : siteFilter,
      sortBy,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const approveMutation = trpc.hvComment.approve.useMutation({
    onSuccess: () => {
      toast.success("HV comment approved and queued for posting!");
      utils.hvOpportunity.listPending.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        setShowUpgradeModal(true);
      }
      toast.error(err.message);
    },
    onSettled: () => setActingOn(null),
  });

  const skipMutation = trpc.hvComment.skip.useMutation({
    onSuccess: () => {
      toast.success("Skipped.");
      utils.hvOpportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setActingOn(null),
  });

  const editMutation = trpc.hvComment.edit.useMutation({
    onSuccess: () => {
      toast.success("Comment updated.");
      utils.hvOpportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateMutation = trpc.hvComment.regenerate.useMutation({
    onSuccess: () => {
      toast.success("HV comment regenerated.");
      utils.hvOpportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setRegeneratingOn(null),
  });

  const [generatingOn, setGeneratingOn] = useState<string | null>(null);
  const generateMutation = trpc.hvOpportunity.generate.useMutation({
    onSuccess: () => {
      toast.success("HV comment generated!");
      utils.hvOpportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setGeneratingOn(null),
  });

  const allPages = pendingQuery.data?.pages ?? [];
  const allQueueItems = allPages.flatMap((p) => p.items);
  const totalPendingCount = allPages[0]?.totalPendingCount ?? 0;
  const filteredCount = allPages[0]?.filteredCount ?? 0;

  const hasActiveControls =
    searchTerm.trim().length > 0 ||
    platformFilter !== "ALL" ||
    siteFilter !== "ALL" ||
    sortBy !== "citation_score";
  const hasAnyPending = totalPendingCount > 0;

  const resetControls = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setPlatformFilter("ALL");
    setSiteFilter("ALL");
    setSortBy("citation_score");
  };

  return (
    <DashboardLayout>
      <Seo title="HV Queue -- SlopMog" noIndex />

      <PageHeader
        title="High Value Queue"
        description="Threads with real AI chat juice"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "HV Queue" },
        ]}
      />

      {/* Discovery in-progress banner */}
      {discoveryRunning && (
        <div className="bg-gradient-to-r from-teal/[0.06] to-sunny/[0.06] border border-teal/20 rounded-brand p-4 mb-4 flex items-start gap-3">
          <Loader2 size={18} className="animate-spin text-teal mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-charcoal">HV Discovery in progress</p>
            {discoveryRuns.map((run) => (
              <p key={run.id} className="text-xs text-charcoal-light mt-0.5">
                Scanning for {run.site.name}
              </p>
            ))}
            <p className="text-xs text-charcoal-light/60 mt-1">
              Checking what AI chatbots actually recommend...
            </p>
          </div>
        </div>
      )}

      {!allPages.length && pendingQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading HV queue..." />
      ) : !hasAnyPending && discoveryRunning ? (
        <div className="flex flex-col items-center justify-center text-center px-6 py-12 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06]">
          <Loader2 size={32} className="animate-spin text-teal mb-4" />
          <h3 className="font-heading text-lg font-bold text-charcoal mb-1">
            Finding the good stuff
          </h3>
          <p className="text-sm text-charcoal-light max-w-sm">
            Checking what AI chatbots are actually citing. Hang tight, this takes a few minutes.
          </p>
        </div>
      ) : !hasAnyPending && !hasActiveControls ? (
        <EmptyState
          icon={Sparkles}
          title="No high-value opportunities yet"
          description="Run HV Discovery from a site page to find threads that AI chatbots are actually citing."
          actionLabel="View Sites"
          href={routes.dashboard.sites.index}
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
                  placeholder="Search title, source..."
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
                  onChange={(e) => setSortBy(e.target.value as HVSort)}
                  className="h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  <option value="citation_score">Citation Score</option>
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
                ? `Showing ${allQueueItems.length} of ${filteredCount} matches (${totalPendingCount} total pending)`
                : `Showing ${allQueueItems.length} of ${totalPendingCount}`}
              {pendingQuery.isFetching ? " · Updating..." : ""}
            </p>
          </div>

          {!allQueueItems.length ? (
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-8 text-center">
              <p className="text-sm font-semibold text-charcoal">No HV queue items match these filters.</p>
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
              {allQueueItems.map((opp) => (
                <HVQueueItem
                  key={opp.id}
                  opportunity={opp}
                  onApprove={(commentId) => {
                    setActingOn(commentId);
                    approveMutation.mutate({ hvCommentId: commentId });
                  }}
                  onSkip={(commentId) => {
                    setActingOn(commentId);
                    skipMutation.mutate({ hvCommentId: commentId });
                  }}
                  onEdit={(commentId, text) => {
                    editMutation.mutate({ hvCommentId: commentId, text });
                  }}
                  onRegenerate={(commentId, persona) => {
                    setRegeneratingOn(commentId);
                    regenerateMutation.mutate({ hvCommentId: commentId, persona });
                  }}
                  onGenerate={(opportunityId) => {
                    setGeneratingOn(opportunityId);
                    generateMutation.mutate({ hvOpportunityId: opportunityId });
                  }}
                  isActing={actingOn !== null}
                  isRegenerating={regeneratingOn === opp.hvComments[0]?.id}
                  isGenerating={generatingOn === opp.id}
                />
              ))}

              {pendingQuery.hasNextPage && (
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
            </>
          )}
        </div>
      )}

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Posting requires a paid plan"
        description="Upgrade to approve and publish HV comments across platforms."
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
