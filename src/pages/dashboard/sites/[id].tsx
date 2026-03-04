import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Play,
  ExternalLink,
  Eye,
  MessageSquare,
  Search,
  AlertTriangle,
  Loader2,
  Tag,
  Zap,
  Trash2,
  Plus,
  Activity,
  X,
  ArrowRight,
  Settings,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import DiscoverySettingsModal from "@/components/DiscoverySettingsModal";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { timeAgo } from "@/utils/format-time";
import { getServerAuthSession } from "@/server/utils/auth";

type KeywordCategory = "features" | "competitors" | "brand";

type SiteKeywordConfig = {
  features: string[];
  competitors: string[];
  brand: string[];
  reddit: string[];
  youtube: string[];
};

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeKeywords(keywords: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSiteKeywordConfig(
  keywordConfig: unknown,
  fallbackKeywords: string[],
): SiteKeywordConfig {
  const raw = keywordConfig && typeof keywordConfig === "object"
    ? keywordConfig as Record<string, unknown>
    : {};

  const features = dedupeKeywords(readStringArray(raw.features));
  const competitors = dedupeKeywords(readStringArray(raw.competitors));
  const brand = dedupeKeywords(readStringArray(raw.brand));
  const reddit = dedupeKeywords(readStringArray(raw.reddit));
  const youtube = dedupeKeywords(readStringArray(raw.youtube));

  if (features.length || competitors.length || brand.length || reddit.length || youtube.length) {
    return {
      features,
      competitors,
      brand,
      reddit,
      youtube,
    };
  }

  return {
    features: dedupeKeywords(fallbackKeywords),
    competitors: [],
    brand: [],
    reddit: [],
    youtube: [],
  };
}

type ActivityItem = {
  type: "discovery_running" | "discovery_completed" | "discovery_failed" | "comment_posted";
  id: string;
  timestamp: string;
  platform: string;
  keywords?: string[];
  foundCount?: number;
  generatedCount?: number;
  error?: string | null;
  title?: string;
  sourceContext?: string;
  contentUrl?: string;
};

function ActivityTimelineItem({ item, isLast }: { item: ActivityItem; isLast: boolean }) {
  const config = {
    discovery_running: {
      icon: <Loader2 size={14} className="animate-spin" />,
      bg: "bg-sunny/20",
      text: "text-sunny-dark",
    },
    discovery_completed: {
      icon: <Search size={14} />,
      bg: "bg-teal/10",
      text: "text-teal-dark",
    },
    discovery_failed: {
      icon: <AlertTriangle size={14} />,
      bg: "bg-coral/10",
      text: "text-coral-dark",
    },
    comment_posted: {
      icon: <MessageSquare size={14} />,
      bg: "bg-lavender/15",
      text: "text-lavender-dark",
    },
  }[item.type];

  const keywordLabel = item.keywords?.length
    ? item.keywords.length === 1
      ? `"${item.keywords[0]}"`
      : `${item.keywords.length} keywords`
    : "";

  const description = (() => {
    if (item.type === "discovery_running")
      return `Scouting ${item.platform} for ${keywordLabel}...`;
    if (item.type === "discovery_completed")
      return `Scouted ${item.platform} — found ${item.foundCount ?? 0} threads, generated ${item.generatedCount ?? 0} for review`;
    if (item.type === "discovery_failed")
      return "Discovery hit a snag — we'll retry automatically";
    return `Posted on ${item.sourceContext}: ${item.title}`;
  })();

  return (
    <div className="relative flex gap-3">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[13px] top-8 bottom-0 w-px bg-charcoal/[0.08]" />
      )}

      {/* Icon circle */}
      <div className={`relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${config.bg} ${config.text}`}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <p className="text-sm text-charcoal leading-snug">
          {item.type === "comment_posted" && item.contentUrl ? (
            <>
              Posted on {item.sourceContext}:{" "}
              <a
                href={item.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-charcoal hover:text-teal transition-colors"
              >
                {item.title}
                <ExternalLink size={10} className="inline ml-1 -mt-0.5" />
              </a>
            </>
          ) : item.type === "discovery_completed" ? (
            <>
              {description}{" "}
              <Link
                href={routes.dashboard.queue}
                className="text-teal hover:text-teal-dark font-semibold transition-colors"
              >
                View queue
              </Link>
            </>
          ) : (
            description
          )}
        </p>
        <p className="text-[11px] text-charcoal-light mt-0.5">
          {timeAgo(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function SiteDetailPage() {
  const router = useRouter();
  const siteId = router.query.id as string;

  const isNewSite = router.query.new === "1";
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Set onboarding banner on first render when ?new=1 is present
  const onboardingInitRef = useRef(false);
  useEffect(() => {
    if (isNewSite && !onboardingInitRef.current) {
      onboardingInitRef.current = true;
      setShowOnboarding(true);
      // Clean up the query param
      router.replace(routes.dashboard.sites.detail(siteId), undefined, { shallow: true });
    }
  }, [isNewSite, siteId, router]);

  const siteQuery = trpc.site.getById.useQuery({ id: siteId }, { enabled: !!siteId });
  const activityQuery = trpc.site.getActivityFeed.useQuery(
    { siteId, limit: 15 },
    { enabled: !!siteId },
  );

  const activityItems = (activityQuery.data ?? []) as ActivityItem[];
  const hasRunningDiscovery = activityItems.some((i) => i.type === "discovery_running");
  const hasAnyDiscovery = activityItems.some((i) =>
    i.type === "discovery_completed" || i.type === "discovery_failed" || i.type === "discovery_running",
  );

  // Poll activity while discovery is running
  useEffect(() => {
    if (!hasRunningDiscovery || !siteId) return;
    const interval = setInterval(() => {
      activityQuery.refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [hasRunningDiscovery, siteId, activityQuery]);

  const autoStatsQuery = trpc.site.getDailyAutoStats.useQuery(
    { siteId },
    { enabled: !!siteId },
  );

  const planQuery = trpc.user.getPlanInfo.useQuery();
  const canUseAuto = planQuery.data?.canPost ?? false;

  const utils = trpc.useUtils();

  const triggerDiscovery = trpc.site.triggerDiscovery.useMutation({
    onSuccess: () => {
      toast.success("Discovery started!");
      utils.site.getActivityFeed.invalidate({ siteId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSite = trpc.site.update.useMutation({
    onSuccess: () => {
      toast.success("Site updated!");
      utils.site.getById.invalidate({ id: siteId });
      utils.site.getDailyAutoStats.invalidate({ siteId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSite = trpc.site.delete.useMutation({
    onSuccess: () => {
      toast.success("Site deleted.");
      router.push(routes.dashboard.sites.index);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeKeywordTerm = trpc.site.removeKeywordTerm.useMutation({
    onSuccess: (result) => {
      toast.success(`Removed "${result.term}".`);
      utils.site.getById.invalidate({ id: siteId });
    },
    onError: (err) => toast.error(err.message),
  });

  const addKeywordTerm = trpc.site.addKeywordTerm.useMutation({
    onSuccess: (result, variables) => {
      if (result.alreadyExists) {
        toast.info(`"${result.term}" is already in this list.`);
      } else if (result.queued) {
        toast.success(`Added "${result.term}" and started targeted discovery.`);
      } else {
        toast.success(`Added "${result.term}".`);
      }

      setKeywordDrafts((prev) => ({ ...prev, [variables.category]: "" }));
      utils.site.getById.invalidate({ id: siteId });
      utils.site.getActivityFeed.invalidate({ siteId });
    },
    onError: (err) => {
      if (
        err.data?.code === "FORBIDDEN" &&
        err.message.toLowerCase().includes("keyword limit")
      ) {
        setShowUpgradeModal(true);
      }
      toast.error(err.message);
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDiscoverySettings, setShowDiscoverySettings] = useState(false);
  const [keywordDrafts, setKeywordDrafts] = useState<Record<KeywordCategory, string>>({
    features: "",
    competitors: "",
    brand: "",
  });
  const [localDailyLimit, setLocalDailyLimit] = useState<number | null>(null);
  const dailyLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedUpdateLimit = useCallback((value: number) => {
    if (dailyLimitTimerRef.current) clearTimeout(dailyLimitTimerRef.current);
    dailyLimitTimerRef.current = setTimeout(() => {
      updateSite.mutate({ id: siteId, dailyAutoLimit: value });
    }, 800);
  }, [siteId, updateSite]);

  const site = siteQuery.data;

  if (siteQuery.isLoading) {
    return (
      <DashboardLayout>
        <LoadingState variant="page" text="Loading site..." />
      </DashboardLayout>
    );
  }

  if (!site) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-charcoal-light">Site not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const isAuto = site.mode === "AUTO";
  const keywordConfig = parseSiteKeywordConfig(site.keywordConfig, site.keywords);
  const trackedKeywordsCount = dedupeKeywords([
    ...keywordConfig.features,
    ...keywordConfig.competitors,
    ...keywordConfig.brand,
  ]).length;

  const keywordSections: Array<{
    category: KeywordCategory;
    label: string;
    tags: string[];
    tagClassName: string;
    placeholder: string;
  }> = [
    {
      category: "features",
      label: "Features",
      tags: keywordConfig.features,
      tagClassName: "bg-teal/5 border-teal/10",
      placeholder: "Add feature keyword",
    },
    {
      category: "competitors",
      label: "Competitors",
      tags: keywordConfig.competitors,
      tagClassName: "bg-coral/5 border-coral/10",
      placeholder: "Add competitor keyword",
    },
    {
      category: "brand",
      label: "Brand",
      tags: keywordConfig.brand,
      tagClassName: "bg-sunny/10 border-sunny/20",
      placeholder: "Add brand keyword",
    },
  ];

  const handleAddKeyword = (category: KeywordCategory) => {
    const term = normalizeKeyword(keywordDrafts[category]);
    if (!term || addKeywordTerm.isPending) return;

    addKeywordTerm.mutate({
      siteId: site.id,
      category,
      term,
    });
  };

  return (
    <DashboardLayout>
      <Seo title={`${site.name} -- SlopMog`} noIndex />

      <PageHeader
        title={site.name}
        breadcrumbs={[
          { label: "Sites", href: routes.dashboard.sites.index },
          { label: site.name },
        ]}
      />

      {/* Onboarding banner for new sites */}
      {showOnboarding && (
        <div className="relative bg-teal/[0.06] border border-teal/20 rounded-brand p-5 mb-6">
          <button
            onClick={() => setShowOnboarding(false)}
            className="absolute top-3 right-3 p-1 rounded-full text-charcoal-light hover:text-charcoal hover:bg-charcoal/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
          <h3 className="font-heading font-bold text-charcoal mb-1">
            Your site is all set up
          </h3>
          <p className="text-sm text-charcoal-light mb-4 max-w-lg">
            We're scouting Reddit and YouTube for conversations about your brand. Once we find matches, we'll generate comment drafts for you to review.
          </p>
          <Link
            href={routes.dashboard.queue}
            className="inline-flex items-center gap-2 bg-coral text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            Go to Review Queue
            <ArrowRight size={14} />
          </Link>
          <p className="text-xs text-charcoal-light/70 mt-2">
            Items will appear there as discovery completes
          </p>
        </div>
      )}

      {/* Top bar: meta + actions in one line */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: meta info */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-dark font-semibold transition-colors"
            >
              {new URL(site.url).hostname}
              <ExternalLink size={12} />
            </a>
            <span className="w-px h-4 bg-charcoal/10" />
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isAuto ? "bg-teal/8 text-teal-dark" : "bg-lavender/15 text-lavender-dark"
            }`}>
              {isAuto ? "Auto" : "Manual"}
            </span>
            {site.platforms.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-charcoal/[0.04] text-charcoal-light">
                {p === "REDDIT" ? "Reddit" : "YouTube"}
              </span>
            ))}
            <span className="w-px h-4 bg-charcoal/10" />
            <span className="text-xs text-charcoal-light flex items-center gap-1">
              <Eye size={12} /> {site._count.opportunities}
            </span>
            <span className="text-xs text-charcoal-light flex items-center gap-1">
              <MessageSquare size={12} /> {site._count.comments}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => triggerDiscovery.mutate({ siteId: site.id })}
              disabled={triggerDiscovery.isPending || hasRunningDiscovery}
              className="inline-flex items-center gap-1.5 bg-coral text-white px-4 py-2 rounded-full font-bold text-xs hover:bg-coral-dark transition-all disabled:opacity-40"
            >
              {hasRunningDiscovery ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Discovery Running...
                </>
              ) : triggerDiscovery.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  {hasAnyDiscovery ? "Re-run Discovery" : "Run Discovery"}
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (!isAuto && !canUseAuto) {
                  setShowUpgradeModal(true);
                  return;
                }
                updateSite.mutate({
                  id: site.id,
                  mode: isAuto ? "MANUAL" : "AUTO",
                });
              }}
              className="inline-flex items-center gap-1.5 border border-charcoal/[0.12] text-charcoal-light px-3 py-2 rounded-full text-xs font-bold hover:text-charcoal hover:border-charcoal/[0.2] transition-all"
            >
              <Zap size={12} />
              Switch to {isAuto ? "Manual" : "Auto"}
            </button>
            <button
              onClick={() => setShowDiscoverySettings(true)}
              className="p-2 rounded-full border border-charcoal/[0.08] text-charcoal-light/40 hover:text-teal hover:border-teal/30 transition-all"
              title="Discovery settings"
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-2 rounded-full border border-charcoal/[0.08] text-charcoal-light/40 hover:text-coral hover:border-coral/30 transition-all"
              title="Delete site"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Auto Settings */}
      {isAuto && (
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 mb-6">
          <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Settings size={12} /> Auto Settings
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Daily limit input */}
            <div className="flex-shrink-0">
              <label className="block text-sm font-semibold text-charcoal mb-1">
                Posts per day
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={localDailyLimit ?? site.dailyAutoLimit}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 100) {
                    setLocalDailyLimit(val);
                    debouncedUpdateLimit(val);
                  }
                }}
                className="w-24 h-9 rounded-full border border-charcoal/[0.12] bg-white px-3 text-sm text-charcoal text-center focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            {/* Usage indicator */}
            {autoStatsQuery.data && (
              <div className="flex-1">
                <p className="text-sm text-charcoal">
                  <span className="font-bold">{autoStatsQuery.data.postedToday}</span>
                  {" / "}
                  <span className="font-bold">{localDailyLimit ?? autoStatsQuery.data.dailyAutoLimit}</span>
                  {" "}posted today
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-charcoal/[0.06] overflow-hidden max-w-xs">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{
                      width: `${Math.min(100, (autoStatsQuery.data.postedToday / (localDailyLimit ?? autoStatsQuery.data.dailyAutoLimit)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Credit warnings */}
          {autoStatsQuery.data && autoStatsQuery.data.totalCredits <= 0 && (
            <div className="mt-4 flex items-start gap-2 bg-coral/[0.06] border border-coral/20 rounded-brand px-4 py-3">
              <AlertCircle size={16} className="text-coral flex-shrink-0 mt-0.5" />
              <p className="text-sm text-charcoal">
                No credits remaining — auto mode won&apos;t post.{" "}
                <Link href={routes.dashboard.billing} className="text-teal font-bold hover:text-teal-dark transition-colors">
                  Go to billing
                </Link>
              </p>
            </div>
          )}
          {autoStatsQuery.data && autoStatsQuery.data.totalCredits > 0 && autoStatsQuery.data.totalCredits < (localDailyLimit ?? autoStatsQuery.data.dailyAutoLimit) && (
            <div className="mt-4 flex items-start gap-2 bg-sunny/[0.08] border border-sunny/20 rounded-brand px-4 py-3">
              <AlertTriangle size={16} className="text-sunny-dark flex-shrink-0 mt-0.5" />
              <p className="text-sm text-charcoal">
                You have {autoStatsQuery.data.totalCredits} credit{autoStatsQuery.data.totalCredits === 1 ? "" : "s"} left — auto-posting will stop after {autoStatsQuery.data.totalCredits} comment{autoStatsQuery.data.totalCredits === 1 ? "" : "s"}.{" "}
                <Link href={routes.dashboard.billing} className="text-teal font-bold hover:text-teal-dark transition-colors">
                  Buy more credits
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Keywords */}
      <div className="mb-6 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={12} /> Keywords
          </h3>
          <span className="text-xs text-charcoal-light">
            {trackedKeywordsCount} tracked
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {keywordSections.map((section) => {
            const draft = keywordDrafts[section.category];
            const normalizedDraft = normalizeKeyword(draft);
            const isAdding = addKeywordTerm.isPending && addKeywordTerm.variables?.category === section.category;

            return (
              <div key={section.category} className="flex flex-col">
                <h4 className="text-[11px] font-bold text-charcoal-light uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag size={10} /> {section.label}
                </h4>

                <div className="flex flex-wrap gap-1 min-h-6 flex-1">
                  {section.tags.length > 0 ? section.tags.map((kw) => (
                    <span
                      key={kw}
                      className={`group/tag inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[11px] text-charcoal font-medium self-start ${section.tagClassName}`}
                    >
                      {kw}
                      <button
                        onClick={() => removeKeywordTerm.mutate({ siteId: site.id, category: section.category, term: kw })}
                        disabled={removeKeywordTerm.isPending}
                        className="opacity-0 group-hover/tag:opacity-100 ml-0.5 p-0.5 rounded-full text-charcoal-light hover:text-coral hover:bg-coral/10 transition-all disabled:opacity-50"
                        title={`Remove "${kw}"`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )) : (
                    <span className="text-[11px] text-charcoal-light/60">None yet</span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setKeywordDrafts((prev) => ({
                      ...prev,
                      [section.category]: e.target.value,
                    }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword(section.category);
                      }
                    }}
                    placeholder={section.placeholder}
                    className="w-full h-8 rounded-full border border-charcoal/[0.12] bg-white px-3 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <button
                    onClick={() => handleAddKeyword(section.category)}
                    disabled={!normalizedDraft || addKeywordTerm.isPending}
                    className="inline-flex items-center gap-1.5 h-8 rounded-full bg-teal text-white px-3 text-xs font-bold hover:bg-teal-dark transition-all disabled:opacity-50"
                  >
                    {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-charcoal-light/70 mt-3">
          Adding a keyword immediately runs targeted discovery and scoring for that term.
        </p>
      </div>

      {/* Site Activity */}
      <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
        <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Activity size={12} />
          Site Activity
        </h3>
        {activityQuery.isLoading ? (
          <LoadingState variant="skeleton" />
        ) : !activityQuery.data?.length ? (
          <p className="text-sm text-charcoal-light/60 py-6 text-center">
            No activity yet — discovery will kick off shortly
          </p>
        ) : (
          <div>
            {(activityQuery.data as ActivityItem[]).map((item, i) => (
              <ActivityTimelineItem
                key={item.id}
                item={item}
                isLast={i === activityQuery.data!.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${site.name}?`}
        description="This permanently deletes the site along with all its discovery runs, opportunities, and comments. Can't undo this one."
        confirmLabel="Delete Site"
        variant="danger"
        onConfirm={() => deleteSite.mutate({ id: site.id })}
      />

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
      />

      <DiscoverySettingsModal
        mode="persisted"
        open={showDiscoverySettings}
        onOpenChange={setShowDiscoverySettings}
        siteId={site.id}
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
