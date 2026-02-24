import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import {
  Inbox,
  ExternalLink,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  ArrowUpCircle,
  MessageCircle,
  Reply,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ChevronUp,
  CornerDownRight,
  Brain,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type StatusFilter = "DISCOVERED" | "PENDING_REVIEW" | "READY_FOR_REVIEW" | "APPROVED" | "POSTED" | "ALL";
type SortOption = "newest" | "relevance" | "upvotes" | "postDate";

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "Scoring", value: "DISCOVERED" },
  { label: "Pending", value: "PENDING_REVIEW" },
  { label: "Ready", value: "READY_FOR_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Posted", value: "POSTED" },
  { label: "All", value: "ALL" },
];

const RELEVANCE_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "All", value: undefined },
  { label: "40%+", value: 0.4 },
  { label: "50%+", value: 0.5 },
  { label: "60%+", value: 0.6 },
  { label: "80%+", value: 0.8 },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Newest", value: "newest" },
  { label: "Post date", value: "postDate" },
  { label: "Relevance", value: "relevance" },
  { label: "Upvotes", value: "upvotes" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  DISCOVERED: { bg: "bg-lavender/10", text: "text-lavender-dark", label: "Scoring" },
  PENDING_REVIEW: { bg: "bg-sunny/20", text: "text-charcoal", label: "Pending" },
  READY_FOR_REVIEW: { bg: "bg-teal/10", text: "text-teal-dark", label: "Ready" },
  APPROVED: { bg: "bg-teal/20", text: "text-teal-dark", label: "Approved" },
  GENERATING: { bg: "bg-lavender/15", text: "text-lavender-dark", label: "Generating" },
  POSTING: { bg: "bg-lavender/15", text: "text-lavender-dark", label: "Posting" },
  POSTED: { bg: "bg-teal/10", text: "text-teal-dark", label: "Posted" },
  REJECTED: { bg: "bg-coral/10", text: "text-coral-dark", label: "Rejected" },
  SKIPPED: { bg: "bg-charcoal/10", text: "text-charcoal-light", label: "Skipped" },
};

const FUN_LOADING_TEXTS = [
  "Teaching the AI to be witty...",
  "Crafting the perfect comment...",
  "Consulting the shill handbook...",
  "Summoning the engagement gods...",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const timeAgo = (date: Date | string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 52) return `${diffWeeks}w ago`;
  return `${Math.floor(diffWeeks / 52)}y ago`;
};

const relevanceColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return "bg-charcoal/10 text-charcoal-light";
  if (score >= 0.8) return "bg-teal/15 text-teal-dark";
  if (score >= 0.6) return "bg-sunny/20 text-charcoal";
  if (score >= 0.4) return "bg-lavender/15 text-lavender-dark";
  return "bg-coral/10 text-coral-dark";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QueuePage() {
  const router = useRouter();
  const deepLinkId = typeof router.query.selected === "string" ? router.query.selected : null;
  const deepLinkConsumed = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING_REVIEW");
  const [campaignFilter, setCampaignFilter] = useState<string | undefined>(undefined);
  const [minRelevance, setMinRelevance] = useState<number | undefined>(0.5);
  const [sort, setSort] = useState<SortOption>("newest");

  // Deep-link: if ?selected=<id>, switch to ALL / no relevance filter so the item is visible
  useEffect(() => {
    if (deepLinkId && !deepLinkConsumed.current) {
      deepLinkConsumed.current = true;
      setStatusFilter("ALL");
      setMinRelevance(undefined);
      setSelectedId(deepLinkId);
      setMobileDetailOpen(true);
      // Clean URL without re-render
      router.replace(routes.dashboard.queue, undefined, { shallow: true });
    }
  }, [deepLinkId, router]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedComment, setEditedComment] = useState("");
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false);
  const [relevanceDropdownOpen, setRelevanceDropdownOpen] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);
  const relevanceDropdownRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: Event) => {
      const target = e.target as Node;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setSortDropdownOpen(false);
      }
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(target)) {
        setCampaignDropdownOpen(false);
      }
      if (relevanceDropdownRef.current && !relevanceDropdownRef.current.contains(target)) {
        setRelevanceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  // ---- Data fetching ----
  const planQuery = trpc.user.getPlanInfo.useQuery();
  const userPlan = planQuery.data;
  const isFreeUser = userPlan ? !userPlan.canPost : false;

  const campaignsQuery = trpc.campaign.list.useQuery();
  const campaigns = campaignsQuery.data ?? [];

  const listQuery = trpc.opportunity.list.useInfiniteQuery(
    {
      campaignId: campaignFilter,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      minRelevance: minRelevance,
      sort,
      limit: 25,
    },
    {
      getNextPageParam: (last) => last.nextCursor,
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
    }
  );

  const allItems = useMemo(() => {
    if (!listQuery.data) return [];
    return listQuery.data.pages.flatMap((p) => p.items);
  }, [listQuery.data]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return allItems.find((item) => item.id === selectedId) ?? null;
  }, [allItems, selectedId]);

  // Detail query for the selected opportunity (gets fresh data)
  const detailQuery = trpc.opportunity.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const detail = detailQuery.data ?? selectedItem;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
    setMobileDetailOpen(false);
  }, [statusFilter, campaignFilter, minRelevance, sort]);

  // Initialize edited comment when detail loads
  useEffect(() => {
    if (detail?.generatedComment) {
      setEditedComment(detail.generatedComment);
      setIsEditingComment(false);
    }
  }, [detail?.id, detail?.generatedComment]);

  // Auto-advance to next item when current one leaves the list
  const advanceSelection = useCallback((removedId: string) => {
    const idx = allItems.findIndex((item) => item.id === removedId);
    const remaining = allItems.filter((item) => item.id !== removedId);
    if (remaining.length === 0) {
      setSelectedId(null);
      setMobileDetailOpen(false);
    } else {
      // Pick the next item, or the previous if we were at the end
      const nextIdx = Math.min(idx, remaining.length - 1);
      setSelectedId(remaining[nextIdx].id);
    }
  }, [allItems]);

  // ---- Mutations ----
  const approveMutation = trpc.opportunity.approve.useMutation({
    onMutate: ({ id }) => {
      utils.opportunity.list.setInfiniteData(
        { campaignId: campaignFilter, status: statusFilter === "ALL" ? undefined : statusFilter, minRelevance, sort, limit: 25 },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, status: "APPROVED" } : item
              ),
            })),
          };
        }
      );
    },
    onSuccess: (_, { id }) => {
      toast.success("Opportunity approved!");
      if (statusFilter !== "ALL") advanceSelection(id);
      utils.opportunity.list.invalidate();
      utils.opportunity.unreadCount.invalidate();
    },
    onError: () => {
      toast.error("Failed to approve. Try again?");
      utils.opportunity.list.invalidate();
    },
  });

  const rejectMutation = trpc.opportunity.reject.useMutation({
    onMutate: ({ id }) => {
      utils.opportunity.list.setInfiniteData(
        { campaignId: campaignFilter, status: statusFilter === "ALL" ? undefined : statusFilter, minRelevance, sort, limit: 25 },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, status: "REJECTED" } : item
              ),
            })),
          };
        }
      );
    },
    onSuccess: (_, { id }) => {
      toast.success("Opportunity rejected.");
      if (statusFilter !== "ALL") advanceSelection(id);
      utils.opportunity.list.invalidate();
      utils.opportunity.unreadCount.invalidate();
    },
    onError: () => {
      toast.error("Failed to reject. Try again?");
      utils.opportunity.list.invalidate();
    },
  });

  const bulkApproveMutation = trpc.opportunity.bulkApprove.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`${(variables as { ids: string[] }).ids.length} opportunities approved!`);
      setSelectedIds(new Set());
      utils.opportunity.list.invalidate();
      utils.opportunity.unreadCount.invalidate();
    },
    onError: () => {
      toast.error("Bulk approve failed. Try again?");
    },
  });

  const bulkRejectMutation = trpc.opportunity.bulkReject.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`${(variables as { ids: string[] }).ids.length} opportunities rejected.`);
      setSelectedIds(new Set());
      utils.opportunity.list.invalidate();
      utils.opportunity.unreadCount.invalidate();
    },
    onError: () => {
      toast.error("Bulk reject failed. Try again?");
    },
  });

  const approveCommentMutation = trpc.opportunity.approveComment.useMutation({
    onSuccess: () => {
      toast.success("Comment approved & queued for posting!");
      if (selectedId && statusFilter !== "ALL") advanceSelection(selectedId);
      utils.opportunity.list.invalidate();
      if (selectedId) utils.opportunity.getById.invalidate({ id: selectedId });
    },
    onError: () => {
      toast.error("Failed to approve comment. Try again?");
    },
  });

  const regenerateMutation = trpc.opportunity.regenerateComment.useMutation({
    onSuccess: () => {
      toast.success("Regenerating comment...");
      utils.opportunity.getById.invalidate({ id: selectedId! });
      utils.opportunity.list.invalidate();
    },
    onError: () => {
      toast.error("Failed to regenerate. Try again?");
    },
  });

  const editCommentMutation = trpc.opportunity.editComment.useMutation({
    onSuccess: () => {
      toast.success("Comment updated!");
      setIsEditingComment(false);
      utils.opportunity.getById.invalidate({ id: selectedId! });
    },
    onError: () => {
      toast.error("Failed to save edit. Try again?");
    },
  });

  // ---- Handlers ----
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowFullBody(false);
    setMobileDetailOpen(true);
  }, []);

  const handleCheckboxToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allItems.map((item) => item.id)));
    }
  }, [allItems, selectedIds.size]);

  const handleBulkApprove = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkApproveMutation.mutate({ ids });
  }, [selectedIds, bulkApproveMutation]);

  const handleBulkReject = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkRejectMutation.mutate({ ids });
  }, [selectedIds, bulkRejectMutation]);

  const handleApproveComment = useCallback(() => {
    if (!selectedId) return;
    if (isEditingComment && editedComment !== detail?.generatedComment) {
      editCommentMutation.mutate({ id: selectedId, comment: editedComment });
    }
    approveCommentMutation.mutate({ id: selectedId });
  }, [selectedId, isEditingComment, editedComment, detail?.generatedComment, editCommentMutation, approveCommentMutation]);

  const handleSaveEdit = useCallback(() => {
    if (!selectedId) return;
    editCommentMutation.mutate({ id: selectedId, comment: editedComment });
  }, [selectedId, editedComment, editCommentMutation]);

  // ---- Render helpers ----
  const renderStatusBadge = (status: string) => {
    const badge = STATUS_BADGE[status] ?? { bg: "bg-charcoal/10", text: "text-charcoal-light", label: status };
    const isScoring = status === "DISCOVERED";
    return (
      <span className={`inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
        {isScoring && <Loader2 size={10} className="animate-spin" />}
        {badge.label}
      </span>
    );
  };

  const renderRelevanceBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return null;
    return (
      <span className={`inline-flex items-center text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${relevanceColor(score)}`}>
        {Math.round(score * 100)}%
      </span>
    );
  };

  // ---- Loading & empty states ----
  if (listQuery.isLoading && !listQuery.data) {
    return (
      <DashboardLayout>
        <Seo title="Opportunity Queue -- SlopMog" noIndex />
        <LoadingState variant="page" text="Loading your opportunity queue..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Seo title="Opportunity Queue -- SlopMog" noIndex />

      {/* Header */}
      <PageHeader
        title="Opportunity Queue"
        description="Review, approve, and manage your Reddit engagement opportunities"
      />

      {/* Filter bar */}
      <div className="mb-4 space-y-3">
        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                statusFilter === tab.value
                  ? "bg-teal text-white shadow-brand-sm"
                  : "bg-white text-charcoal-light border border-charcoal/[0.1] hover:bg-charcoal/[0.04] hover:text-charcoal"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Campaign filter + sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Campaign dropdown */}
          <div ref={campaignDropdownRef} className="relative">
            <button
              onClick={() => setCampaignDropdownOpen(!campaignDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-white border border-charcoal/[0.1] text-charcoal-light hover:text-charcoal transition-colors"
            >
              {campaignFilter
                ? campaigns.find((c) => c.id === campaignFilter)?.name ?? "Campaign"
                : "All Campaigns"}
              <ChevronDown size={14} />
            </button>
            {campaignDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-brand-sm shadow-brand-md border border-charcoal/[0.08] py-1 z-50">
                <button
                  onClick={() => { setCampaignFilter(undefined); setCampaignDropdownOpen(false); }}
                  className={`w-full text-left px-3.5 py-2 text-sm hover:bg-charcoal/[0.04] transition-colors ${
                    !campaignFilter ? "font-bold text-teal" : "text-charcoal"
                  }`}
                >
                  All Campaigns
                </button>
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => { setCampaignFilter(campaign.id); setCampaignDropdownOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-charcoal/[0.04] transition-colors ${
                      campaignFilter === campaign.id ? "font-bold text-teal" : "text-charcoal"
                    }`}
                  >
                    {campaign.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Relevance filter dropdown */}
          <div ref={relevanceDropdownRef} className="relative">
            <button
              onClick={() => setRelevanceDropdownOpen(!relevanceDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-white border border-charcoal/[0.1] text-charcoal-light hover:text-charcoal transition-colors"
            >
              {RELEVANCE_OPTIONS.find((o) => o.value === minRelevance)?.label ?? "All"} relevance
              <ChevronDown size={14} />
            </button>
            {relevanceDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-brand-sm shadow-brand-md border border-charcoal/[0.08] py-1 z-50">
                {RELEVANCE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => { setMinRelevance(option.value); setRelevanceDropdownOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-charcoal/[0.04] transition-colors ${
                      minRelevance === option.value ? "font-bold text-teal" : "text-charcoal"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div ref={sortDropdownRef} className="relative">
            <button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-white border border-charcoal/[0.1] text-charcoal-light hover:text-charcoal transition-colors"
            >
              {SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Sort"}
              <ChevronDown size={14} />
            </button>
            {sortDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-brand-sm shadow-brand-md border border-charcoal/[0.08] py-1 z-50">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setSort(option.value); setSortDropdownOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-charcoal/[0.04] transition-colors ${
                      sort === option.value ? "font-bold text-teal" : "text-charcoal"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Select all toggle */}
          {allItems.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="ml-auto text-xs font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              {selectedIds.size === allItems.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {allItems.length === 0 && !listQuery.isLoading ? (
        <EmptyState
          icon={Inbox}
          title="No opportunities here"
          description="When we find Reddit posts matching your campaign keywords, they'll show up right here. Go set up a campaign if you haven't already!"
          actionLabel="View Campaigns"
          href={routes.dashboard.campaigns.index}
        />
      ) : (
        <>
          {/* Split pane layout */}
          <div className="flex gap-0 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>

            {/* Left: Opportunity list */}
            <div className={`w-full lg:w-[45%] border-r border-charcoal/[0.06] overflow-y-auto h-full ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
              {allItems.map((item) => {
                const isSelected = selectedId === item.id;
                const isChecked = selectedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`relative flex items-start gap-2.5 px-4 py-2.5 border-b border-charcoal/[0.04] cursor-pointer transition-all hover:bg-charcoal/[0.02] ${
                      isSelected ? "bg-teal/[0.04] border-l-[3px] border-l-teal" : "border-l-[3px] border-l-transparent"
                    }`}
                    onClick={() => handleSelect(item.id)}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCheckboxToggle(item.id); }}
                      className={`mt-1 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                        isChecked
                          ? "bg-teal border-teal text-white"
                          : "border-charcoal/20 hover:border-teal/50"
                      }`}
                      style={{ width: 16, height: 16 }}
                    >
                      {isChecked && <Check size={10} strokeWidth={3} />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Title + status badge */}
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-charcoal leading-snug truncate">
                          {item.title}
                        </p>
                        <span className="shrink-0">{renderStatusBadge(item.status)}</span>
                      </div>

                      {/* Row 2: Compact meta */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center text-[0.6rem] font-bold px-1.5 py-0 rounded-full bg-lavender/10 text-lavender-dark">
                          r/{item.subreddit}
                        </span>
                        {renderRelevanceBadge(item.relevanceScore)}
                        {item.matchedKeyword && (
                          <span className="inline-flex items-center text-[0.6rem] font-medium px-1.5 py-0 rounded-full bg-teal/[0.08] text-teal-dark truncate max-w-[100px]">
                            {item.matchedKeyword}
                          </span>
                        )}
                        {item.parentCommentId && (
                          <Reply size={10} className="text-charcoal-light shrink-0" />
                        )}
                        <span className="text-[0.6rem] text-charcoal-light ml-auto shrink-0">
                          {timeAgo(item.discoveredAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {listQuery.hasNextPage && (
                <div className="p-4 text-center">
                  <button
                    onClick={() => listQuery.fetchNextPage()}
                    disabled={listQuery.isFetchingNextPage}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-teal border border-teal/30 hover:bg-teal/[0.06] transition-all disabled:opacity-50"
                  >
                    {listQuery.isFetchingNextPage ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Right: Detail pane */}
            <div className={`w-full lg:w-[55%] overflow-y-auto h-full ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
              {!detail ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-charcoal/[0.04] mb-4">
                    <Inbox size={28} className="text-charcoal-light" strokeWidth={1.5} />
                  </div>
                  <p className="font-heading font-bold text-charcoal text-lg mb-1">Select an opportunity</p>
                  <p className="text-sm text-charcoal-light max-w-xs">
                    Click on an item from the list to see the full details and take action.
                  </p>
                </div>
              ) : (
                <div className="p-5 lg:p-6">
                  {/* Mobile back button */}
                  <button
                    onClick={() => { setMobileDetailOpen(false); setSelectedId(null); }}
                    className="lg:hidden flex items-center gap-1.5 text-sm font-semibold text-teal mb-4 hover:text-teal-dark transition-colors"
                  >
                    <ChevronUp size={16} className="rotate-[-90deg]" />
                    Back to list
                  </button>

                  {/* Post title */}
                  <a
                    href={detail.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 mb-3"
                  >
                    <h2 className="font-heading font-bold text-lg text-charcoal group-hover:text-teal transition-colors leading-snug">
                      {detail.title}
                    </h2>
                    <ExternalLink size={16} className="shrink-0 mt-1 text-charcoal-light group-hover:text-teal transition-colors" />
                  </a>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-lavender/10 text-lavender-dark">
                      r/{detail.subreddit}
                    </span>
                    {renderRelevanceBadge(detail.relevanceScore)}
                    {renderStatusBadge(detail.status)}
                    <span className="flex items-center gap-1 text-xs text-charcoal-light">
                      <ArrowUpCircle size={12} />
                      {detail.score ?? 0}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-charcoal-light">
                      <MessageCircle size={12} />
                      {detail.numComments ?? 0}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-charcoal-light">
                      <Clock size={12} />
                      {timeAgo(detail.discoveredAt)}
                    </span>
                  </div>

                  {/* ---- Action area (MOVED UP — visible immediately) ---- */}

                  {/* PENDING_REVIEW */}
                  {detail.status === "PENDING_REVIEW" && (
                    <div className="space-y-3 mb-5">
                      {isFreeUser ? (
                        <div className="bg-coral/[0.06] border border-coral/20 rounded-brand-sm p-4 text-center">
                          <Zap size={20} className="text-coral mx-auto mb-2" />
                          <p className="text-sm font-bold text-charcoal mb-1">
                            Upgrade to post comments
                          </p>
                          <p className="text-[0.82rem] text-charcoal-light mb-3">
                            You can see opportunities for free, but you need a paid plan to actually post comments. Pretty sneaky, huh?
                          </p>
                          <a
                            href={routes.pricing}
                            className="inline-flex items-center gap-1.5 bg-coral text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-coral-dark transition-all"
                          >
                            View Plans
                          </a>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-charcoal-light">
                            This opportunity is waiting for your review. Approve it to generate a comment, or reject it.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => approveMutation.mutate({ id: detail.id })}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1.5 bg-teal text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-teal-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 size={15} />
                              Approve
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate({ id: detail.id })}
                              disabled={rejectMutation.isPending}
                              className="inline-flex items-center gap-1.5 border border-charcoal/[0.15] text-charcoal-light px-5 py-2 rounded-full font-bold text-sm hover:bg-charcoal/[0.04] hover:text-charcoal transition-all disabled:opacity-50"
                            >
                              <XCircle size={15} />
                              Reject
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* READY_FOR_REVIEW */}
                  {detail.status === "READY_FOR_REVIEW" && (
                    <div className="space-y-3 mb-5">
                      {/* Sticky action buttons */}
                      <div className="sticky top-0 z-10 bg-white pt-1 pb-3 border-b border-charcoal/[0.04] -mx-5 px-5 lg:-mx-6 lg:px-6">
                        {isFreeUser ? (
                          <div className="bg-coral/[0.06] border border-coral/20 rounded-brand-sm p-4 text-center">
                            <Zap size={20} className="text-coral mx-auto mb-2" />
                            <p className="text-sm font-bold text-charcoal mb-1">Upgrade to post</p>
                            <p className="text-[0.82rem] text-charcoal-light mb-3">
                              The comment is ready, but you need a paid plan to post it.
                            </p>
                            <a
                              href={routes.pricing}
                              className="inline-flex items-center gap-1.5 bg-coral text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-coral-dark transition-all"
                            >
                              View Plans
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={handleApproveComment}
                              disabled={approveCommentMutation.isPending}
                              className="inline-flex items-center gap-1.5 bg-coral text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <Send size={14} />
                              {approveCommentMutation.isPending ? "Posting..." : "Approve"}
                            </button>
                            <button
                              onClick={() => regenerateMutation.mutate({ id: detail.id })}
                              disabled={regenerateMutation.isPending}
                              className="inline-flex items-center gap-1.5 border border-teal/30 text-teal px-5 py-2 rounded-full font-bold text-sm hover:bg-teal/[0.06] transition-all disabled:opacity-50"
                            >
                              <RefreshCw size={14} className={regenerateMutation.isPending ? "animate-spin" : ""} />
                              Regenerate
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate({ id: detail.id })}
                              disabled={rejectMutation.isPending}
                              className="text-sm font-semibold text-charcoal-light hover:text-coral transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-teal" />
                          <span className="text-sm font-semibold text-charcoal">Generated Comment</span>
                        </div>
                        {detail.commentVersion && (
                          <span className="text-[0.65rem] text-charcoal-light">
                            v{detail.commentVersion}
                          </span>
                        )}
                      </div>

                      {/* Editable comment area */}
                      <div className="relative">
                        <textarea
                          value={editedComment}
                          onChange={(e) => { setEditedComment(e.target.value); setIsEditingComment(true); }}
                          rows={6}
                          className="w-full bg-charcoal/[0.02] border border-charcoal/[0.1] rounded-brand-sm p-4 text-sm text-charcoal leading-relaxed font-body resize-y focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal/40 transition-all"
                        />
                        {isEditingComment && editedComment !== detail.generatedComment && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={editCommentMutation.isPending}
                              className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors disabled:opacity-50"
                            >
                              {editCommentMutation.isPending ? "Saving..." : "Save edit"}
                            </button>
                            <button
                              onClick={() => { setEditedComment(detail.generatedComment ?? ""); setIsEditingComment(false); }}
                              className="text-xs font-semibold text-charcoal-light hover:text-charcoal transition-colors"
                            >
                              Discard
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GENERATING / POSTING */}
                  {(detail.status === "GENERATING" || detail.status === "POSTING") && (
                    <div className="flex flex-col items-center py-8 text-center mb-5">
                      <Loader2 size={32} className="text-teal animate-spin mb-3" />
                      <p className="font-heading font-bold text-charcoal mb-1">
                        {detail.status === "GENERATING" ? "Generating comment..." : "Posting comment..."}
                      </p>
                      <p className="text-sm text-charcoal-light">
                        {FUN_LOADING_TEXTS[Math.floor(Math.random() * FUN_LOADING_TEXTS.length)]}
                      </p>
                    </div>
                  )}

                  {/* APPROVED */}
                  {detail.status === "APPROVED" && (
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-teal" />
                        <span className="text-sm font-semibold text-charcoal">Approved</span>
                      </div>
                      {detail.generatedComment && (
                        <div className="bg-teal/[0.04] border border-teal/[0.1] rounded-brand-sm p-4">
                          <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                            {detail.generatedComment}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-charcoal-light">
                        This comment has been approved and is in the posting queue.
                      </p>
                    </div>
                  )}

                  {/* POSTED */}
                  {detail.status === "POSTED" && (
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-teal" />
                        <span className="text-sm font-semibold text-teal-dark">Posted</span>
                        {detail.postedAt && (
                          <span className="text-xs text-charcoal-light">
                            {timeAgo(detail.postedAt)}
                          </span>
                        )}
                      </div>

                      {detail.generatedComment && (
                        <div className="bg-teal/[0.04] border border-teal/[0.1] rounded-brand-sm p-4">
                          <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                            {detail.generatedComment}
                          </p>
                        </div>
                      )}

                      {detail.postedCommentUrl && (
                        <a
                          href={detail.postedCommentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-teal-dark transition-colors"
                        >
                          <ExternalLink size={14} />
                          View on Reddit
                        </a>
                      )}
                    </div>
                  )}

                  {/* REJECTED */}
                  {detail.status === "REJECTED" && (
                    <div className="flex items-center gap-2 py-4 mb-5">
                      <XCircle size={16} className="text-coral" />
                      <span className="text-sm font-semibold text-charcoal-light">This opportunity was rejected.</span>
                    </div>
                  )}

                  {/* ---- Secondary info (context) ---- */}
                  <hr className="border-charcoal/[0.06] mb-4" />

                  {/* Keyword + Campaign inline */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs">
                    {detail.matchedKeyword && (
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-charcoal-light">Keyword:</span>
                        <span className="font-medium px-2 py-0.5 rounded-full bg-teal/[0.08] text-teal-dark">
                          {detail.matchedKeyword}
                        </span>
                      </span>
                    )}
                    {detail.campaign && (
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-charcoal-light">Campaign:</span>
                        <span className="font-medium text-charcoal">{detail.campaign.name}</span>
                        {detail.campaign.automationMode && (
                          <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-sunny/20 text-charcoal">
                            {detail.campaign.automationMode}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Relevance reasoning from LLM */}
                  {"relevanceReasoning" in detail && detail.relevanceReasoning && (
                    <div className="flex items-start gap-2 mb-4 bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-3">
                      <Brain size={14} className="text-charcoal-light shrink-0 mt-0.5" />
                      <p className="text-[0.78rem] text-charcoal-light leading-relaxed">
                        {String(detail.relevanceReasoning)}
                      </p>
                    </div>
                  )}

                  {/* Post body */}
                  {detail.postBody && (
                    <div className="mb-4 bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-4">
                      <p className={`text-sm text-charcoal-light leading-relaxed whitespace-pre-wrap ${showFullBody ? "" : "line-clamp-4"}`}>
                        {detail.postBody}
                      </p>
                      {detail.postBody.length > 300 && (
                        <button
                          onClick={() => setShowFullBody(!showFullBody)}
                          className="mt-2 text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
                        >
                          {showFullBody ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Parent comment context */}
                  {detail.parentCommentId && detail.parentCommentBody && (
                    <div className="mb-4 border-l-[3px] border-lavender/40 pl-4 py-2 bg-lavender/[0.04] rounded-r-brand-sm">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CornerDownRight size={13} className="text-lavender" />
                        <span className="text-xs font-semibold text-lavender-dark">
                          Replying to u/{detail.parentCommentAuthor}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal-light leading-relaxed whitespace-pre-wrap line-clamp-4">
                        {detail.parentCommentBody}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white rounded-full shadow-brand-lg border border-charcoal/[0.1] px-6 py-3">
              <span className="text-sm font-bold text-charcoal">
                {selectedIds.size} selected
              </span>
              {isFreeUser ? (
                <a
                  href={routes.pricing}
                  className="inline-flex items-center gap-1.5 bg-coral text-white px-4 py-1.5 rounded-full font-bold text-sm hover:bg-coral-dark transition-all"
                >
                  <Zap size={14} />
                  Upgrade to approve
                </a>
              ) : (
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                  className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-1.5 rounded-full font-bold text-sm hover:bg-teal-dark transition-all disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve {selectedIds.size}
                </button>
              )}
              <button
                onClick={handleBulkReject}
                disabled={bulkRejectMutation.isPending}
                className="inline-flex items-center gap-1.5 border border-coral/30 text-coral px-4 py-1.5 rounded-full font-bold text-sm hover:bg-coral/[0.06] transition-all disabled:opacity-50"
              >
                <X size={14} />
                Reject {selectedIds.size}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-semibold text-charcoal-light hover:text-charcoal transition-colors ml-1"
              >
                Clear
              </button>
            </div>
          )}
        </>
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
