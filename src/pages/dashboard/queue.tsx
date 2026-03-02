import { useState, useEffect } from "react";
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
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import GeneratingMascotV1 from "@/components/illustrations/GeneratingMascotV1";
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
    site: { id: string; name: string; url: string };
    comments: Array<{ id: string; text: string; qualityScore: number; persona: string }>;
  };
  onApprove: (commentId: string) => void;
  onSkip: (commentId: string) => void;
  onEdit: (commentId: string, text: string) => void;
  onRegenerate: (commentId: string, persona: string) => void;
  isActing: boolean;
  isRegenerating: boolean;
}

function QueueItem({
  opportunity,
  onApprove,
  onSkip,
  onEdit,
  onRegenerate,
  isActing,
  isRegenerating,
}: QueueItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [persona, setPersona] = useState("auto");
  const comment = opportunity.comments[0];

  if (!comment) return null;

  useEffect(() => {
    setPersona(comment.persona || "auto");
  }, [comment.persona, comment.id]);

  const handleStartEdit = () => {
    setEditText(comment.text);
    setEditing(true);
  };

  const handleSaveEdit = () => {
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
  const [sortBy, setSortBy] = useState<QueueSort>("best_match");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const pendingQuery = trpc.opportunity.listPending.useQuery({
    limit: 20,
    search: debouncedSearchTerm || undefined,
    platform: platformFilter === "ALL" ? undefined : platformFilter,
    sortBy,
  }, {
    placeholderData: (previousData) => previousData,
  });

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

  const queryData = pendingQuery.data;
  const queueItems = queryData?.items ?? [];
  const filteredCount = queryData?.filteredCount ?? 0;
  const totalPendingCount = queryData?.totalPendingCount ?? 0;

  const hasActiveControls =
    searchTerm.trim().length > 0 ||
    platformFilter !== "ALL" ||
    sortBy !== "best_match";
  const hasAnyPending = totalPendingCount > 0;

  const resetControls = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setPlatformFilter("ALL");
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

      {!queryData && pendingQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading queue..." />
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
          ) : queueItems.map((opp) => (
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
              isActing={actingOn !== null}
              isRegenerating={regeneratingOn === opp.comments[0]?.id}
            />
          ))}
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
