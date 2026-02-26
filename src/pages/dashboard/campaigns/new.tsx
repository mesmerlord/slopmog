import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Plus,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Rocket,
  Sparkles,
  Search,
  Hash,
  Users,
  Shield,
  Swords,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";
import { SubscriptionModal } from "@/components/SubscriptionModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubredditEntry {
  name: string;
  memberCount?: number;
  expectedTone?: string;
  reason?: string;
}

interface KeywordEntry {
  value: string;
  enabled: boolean;
}

interface WizardForm {
  url: string;
  businessName: string;
  businessDescription: string;
  valueProps: { value: string }[];
  targetAudience: string;
  featureKeywords: KeywordEntry[];
  brandKeywords: KeywordEntry[];
  competitorKeywords: KeywordEntry[];
  featureStrategyEnabled: boolean;
  brandStrategyEnabled: boolean;
  competitorStrategyEnabled: boolean;
  subreddits: SubredditEntry[];
  automationMode: "FULL_MANUAL" | "SEMI_AUTO" | "AUTOPILOT";
}

const STEP_LABELS = [
  "Website",
  "Review Info",
  "Keywords",
  "Subreddits",
  "Automation",
  "Launch",
] as const;

const ANALYSIS_MESSAGES = [
  "Judging your design choices...",
  "Stalking your landing page...",
  "Finding your value props...",
  "Deciding if we'd use your product...",
  "Reading the fine print so you don't have to...",
  "Looking for skeletons in your about page...",
  "Calculating your vibe score...",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState(ANALYSIS_MESSAGES[0]);

  // Plan info for keyword limits
  const planQuery = trpc.user.getPlanInfo.useQuery();
  const maxKeywords = planQuery.data?.maxKeywords ?? 10;
  const planName = planQuery.data?.planName ?? "FREE";
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Suggested items from analysis (not directly in the form)
  const [suggestedSubreddits, setSuggestedSubreddits] = useState<SubredditEntry[]>([]);
  const [analysisRaw, setAnalysisRaw] = useState<Record<string, unknown> | null>(null);

  // -------------------------------------------------------------------------
  // Draft persistence (replaces sessionStorage)
  // -------------------------------------------------------------------------

  const draftIdRef = useRef<string | null>(null);
  const draftLoadedRef = useRef(false);
  const draftQuery = trpc.campaign.getLatestDraft.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // Form setup
  // -------------------------------------------------------------------------

  const defaultValues: WizardForm = {
    url: "",
    businessName: "",
    businessDescription: "",
    valueProps: [],
    targetAudience: "",
    featureKeywords: [],
    brandKeywords: [],
    competitorKeywords: [],
    featureStrategyEnabled: true,
    brandStrategyEnabled: true,
    competitorStrategyEnabled: true,
    subreddits: [],
    automationMode: "SEMI_AUTO",
  };

  const form = useForm<WizardForm>({ defaultValues });

  const { control, register, watch, setValue, getValues } = form;

  const valuePropFields = useFieldArray({ control, name: "valueProps" });
  const featureKeywordFields = useFieldArray({ control, name: "featureKeywords" });
  const brandKeywordFields = useFieldArray({ control, name: "brandKeywords" });
  const competitorKeywordFields = useFieldArray({ control, name: "competitorKeywords" });
  const subredditFields = useFieldArray({ control, name: "subreddits" });

  // Load draft into form (once)
  useEffect(() => {
    if (draftLoadedRef.current || !draftQuery.isSuccess) return;
    draftLoadedRef.current = true;

    const draft = draftQuery.data;
    if (!draft) return;

    draftIdRef.current = draft.id;
    setValue("url", draft.websiteUrl || "");
    setValue("businessName", draft.businessName || "");
    setValue("businessDescription", draft.businessDescription || "");
    setValue("targetAudience", draft.targetAudience || "");
    setValue("valueProps", ((draft.valueProps as string[]) || []).map((v) => ({ value: v })));
    setValue("automationMode", (draft.automationMode as WizardForm["automationMode"]) || "SEMI_AUTO");
    setValue("featureStrategyEnabled", draft.featureStrategyEnabled);
    setValue("brandStrategyEnabled", draft.brandStrategyEnabled);
    setValue("competitorStrategyEnabled", draft.competitorStrategyEnabled);

    const featureKw = draft.keywords.filter((k) => k.strategy === "FEATURE").map((k) => ({ value: k.keyword, enabled: k.enabled }));
    const brandKw = draft.keywords.filter((k) => k.strategy === "BRAND").map((k) => ({ value: k.keyword, enabled: k.enabled }));
    const compKw = draft.keywords.filter((k) => k.strategy === "COMPETITOR").map((k) => ({ value: k.keyword, enabled: k.enabled }));
    setValue("featureKeywords", featureKw);
    setValue("brandKeywords", brandKw);
    setValue("competitorKeywords", compKw);

    setValue("subreddits", draft.subreddits.map((s) => ({
      name: s.subreddit,
      memberCount: s.memberCount ?? undefined,
      expectedTone: s.expectedTone ?? undefined,
    })));

    if (draft.siteAnalysisData) {
      setAnalysisRaw(draft.siteAnalysisData as Record<string, unknown>);
    }

    // Determine which step to resume at
    const hasKeywords = draft.keywords.length > 0;
    const hasSubreddits = draft.subreddits.length > 0;
    if (hasKeywords && hasSubreddits) setStep(4);
    else if (hasKeywords) setStep(3);
    else if (draft.businessName) setStep(1);
  }, [draftQuery.isSuccess, draftQuery.data, setValue]);

  // -------------------------------------------------------------------------
  // Rotate analysis loading messages
  // -------------------------------------------------------------------------

  const analyzeSite = trpc.campaign.analyzeSite.useMutation();

  useEffect(() => {
    if (!analyzeSite.isPending) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % ANALYSIS_MESSAGES.length;
      setAnalysisMessage(ANALYSIS_MESSAGES[idx]);
    }, 2500);
    return () => clearInterval(interval);
  }, [analyzeSite.isPending]);

  // -------------------------------------------------------------------------
  // Draft save + activate mutations
  // -------------------------------------------------------------------------

  const saveDraftMutation = trpc.campaign.saveDraft.useMutation();

  const activateMutation = trpc.campaign.activate.useMutation({
    onSuccess: (data) => {
      toast.success("Campaign created! Let's go shill.");
      router.push(routes.dashboard.campaigns.detail(data.id));
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong launching the campaign.");
    },
  });

  const saveDraft = useCallback(async (analysisData?: Record<string, unknown>) => {
    try {
      const vals = getValues();
      const allKeywords = [
        ...vals.featureKeywords.map((k) => ({ keyword: k.value, strategy: "FEATURE" as const, enabled: k.enabled })),
        ...vals.brandKeywords.map((k) => ({ keyword: k.value, strategy: "BRAND" as const, enabled: k.enabled })),
        ...vals.competitorKeywords.map((k) => ({ keyword: k.value, strategy: "COMPETITOR" as const, enabled: k.enabled })),
      ].filter((k) => k.keyword);

      const result = await saveDraftMutation.mutateAsync({
        id: draftIdRef.current ?? undefined,
        websiteUrl: vals.url || undefined,
        businessName: vals.businessName || undefined,
        businessDescription: vals.businessDescription || undefined,
        valueProps: vals.valueProps.map((v) => v.value).filter(Boolean),
        targetAudience: vals.targetAudience || undefined,
        automationMode: vals.automationMode,
        featureStrategyEnabled: vals.featureStrategyEnabled,
        brandStrategyEnabled: vals.brandStrategyEnabled,
        competitorStrategyEnabled: vals.competitorStrategyEnabled,
        siteAnalysisData: (analysisData ?? analysisRaw) ?? undefined,
        keywords: allKeywords,
        subreddits: vals.subreddits.filter((s) => s.name).map((s) => ({
          name: s.name,
          memberCount: s.memberCount,
          expectedTone: s.expectedTone,
        })),
      });
      draftIdRef.current = result.id;
    } catch {
      // Don't block wizard navigation on draft save failure
    }
  }, [getValues, analysisRaw, saveDraftMutation]);

  // -------------------------------------------------------------------------
  // Step 0: Analyze site
  // -------------------------------------------------------------------------

  const handleAnalyzeSite = useCallback(async () => {
    const url = getValues("url").trim();
    if (!url) {
      toast.error("Please enter a URL first.");
      return;
    }

    // Ensure it starts with http
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Basic format check before hitting the backend
    try {
      const parsed = new URL(normalizedUrl);
      if (!parsed.hostname.includes(".")) {
        toast.error("Please enter a valid website URL (e.g. example.com).");
        return;
      }
    } catch {
      toast.error("That doesn't look like a valid URL. Try something like example.com");
      return;
    }

    setValue("url", normalizedUrl);

    try {
      const result = await analyzeSite.mutateAsync({ url: normalizedUrl });

      // Populate form
      setValue("businessName", result.businessName || "");
      setValue("businessDescription", result.description || "");
      setValue(
        "valueProps",
        (result.valueProps || []).map((v) => ({ value: v }))
      );
      setValue("targetAudience", result.targetAudience || "");

      // Feature keywords: primary + problem + long-tail
      const featureKw = [
        ...(result.primaryKeywords || []),
        ...(result.problemKeywords || []),
        ...(result.longTailKeywords || []),
      ];
      const brandKw = result.brandKeywords || [];
      const compKw = result.competitorKeywords || [];

      // All keywords are kept — first N (within plan limit) are enabled, rest disabled.
      // Priority: brand > feature > competitor (brand is most critical for identity).
      const limit = planQuery.data?.maxKeywords ?? 10;
      let slotsLeft = limit === Infinity ? Infinity : limit;

      const tagEnabled = (arr: string[]) =>
        arr.map((k) => {
          const on = slotsLeft > 0;
          if (on && slotsLeft !== Infinity) slotsLeft--;
          return { value: k, enabled: on };
        });

      const taggedBrand = tagEnabled(brandKw);
      const taggedFeature = tagEnabled(featureKw);
      const taggedComp = tagEnabled(compKw);

      setValue("brandKeywords", taggedBrand);
      setValue("featureKeywords", taggedFeature);
      setValue("competitorKeywords", taggedComp);

      // Subreddits
      const subs = (result.suggestedSubreddits || []).map((s) => ({
        name: s.name,
        memberCount: s.memberCount,
        expectedTone: s.expectedTone,
        reason: s.reason,
      }));
      // Put first 5 as active, rest as suggested
      setValue("subreddits", subs.slice(0, 5));
      setSuggestedSubreddits(subs.slice(5));

      // Store raw analysis
      const rawData = result as unknown as Record<string, unknown>;
      setAnalysisRaw(rawData);

      setStep(1);

      // Save draft so analysis data isn't lost
      await saveDraft(rawData);
    } catch (err) {
      const message = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : "";
      toast.error(message || "Failed to analyze site. Please check the URL and try again.");
    }
  }, [analyzeSite, getValues, setValue, saveDraft]);

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  const canProceed = useCallback(
    (fromStep: number): boolean => {
      const vals = getValues();
      if (fromStep === 2) {
        const enabledKw = vals.featureKeywords.filter((k) => k.enabled).length +
          vals.brandKeywords.filter((k) => k.enabled).length +
          vals.competitorKeywords.filter((k) => k.enabled).length;
        return enabledKw >= 1;
      }
      if (fromStep === 3) return vals.subreddits.length >= 1;
      return true;
    },
    [getValues, maxKeywords]
  );

  const goNext = useCallback(async () => {
    if (!canProceed(step)) {
      if (step === 2) toast.error("Add at least one keyword to continue.");
      if (step === 3) toast.error("Add at least one subreddit to continue.");
      return;
    }
    await saveDraft();
    setStep((s) => Math.min(s + 1, 5));
  }, [step, canProceed, saveDraft]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback(
    (target: number) => {
      // Only allow going back or to completed steps
      if (target < step) setStep(target);
    },
    [step]
  );

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onLaunch = useCallback(async () => {
    await saveDraft();
    const id = draftIdRef.current;
    if (!id) {
      toast.error("Please complete the wizard steps first.");
      return;
    }
    activateMutation.mutate({ id });
  }, [saveDraft, activateMutation]);

  // -------------------------------------------------------------------------
  // Tag input helpers
  // -------------------------------------------------------------------------

  const [newFeatureKwInput, setNewFeatureKwInput] = useState("");
  const [newBrandKwInput, setNewBrandKwInput] = useState("");
  const [newCompetitorKwInput, setNewCompetitorKwInput] = useState("");
  const [newSubredditInput, setNewSubredditInput] = useState("");
  const [newValuePropInput, setNewValuePropInput] = useState("");

  const enabledKeywordCount = useCallback(
    () => {
      const vals = getValues();
      return (
        vals.featureKeywords.filter((k) => k.enabled).length +
        vals.brandKeywords.filter((k) => k.enabled).length +
        vals.competitorKeywords.filter((k) => k.enabled).length
      );
    },
    [getValues]
  );

  const isAtKeywordLimit = useCallback(
    () => {
      if (maxKeywords === Infinity) return false;
      return enabledKeywordCount() >= maxKeywords;
    },
    [enabledKeywordCount, maxKeywords]
  );

  // Toggle a keyword between enabled/disabled. If enabling, check limit.
  const toggleKeyword = useCallback(
    (field: "featureKeywords" | "brandKeywords" | "competitorKeywords", idx: number) => {
      const keywords = getValues(field);
      const kw = keywords[idx];
      if (!kw) return;
      if (!kw.enabled) {
        // Trying to enable — check limit
        if (isAtKeywordLimit()) { setShowUpgradeModal(true); return; }
      }
      setValue(`${field}.${idx}.enabled`, !kw.enabled);
    },
    [getValues, setValue, isAtKeywordLimit]
  );

  const addFeatureKeyword = useCallback(
    (kw: string) => {
      const trimmed = kw.trim().toLowerCase();
      if (!trimmed) return;
      const existing = getValues("featureKeywords").map((k) => k.value.toLowerCase());
      if (existing.includes(trimmed)) return;
      const enabled = !isAtKeywordLimit();
      featureKeywordFields.append({ value: trimmed, enabled });
      if (!enabled) setShowUpgradeModal(true);
    },
    [getValues, featureKeywordFields, isAtKeywordLimit]
  );

  const addBrandKeyword = useCallback(
    (kw: string) => {
      const trimmed = kw.trim().toLowerCase();
      if (!trimmed) return;
      const existing = getValues("brandKeywords").map((k) => k.value.toLowerCase());
      if (existing.includes(trimmed)) return;
      const enabled = !isAtKeywordLimit();
      brandKeywordFields.append({ value: trimmed, enabled });
      if (!enabled) setShowUpgradeModal(true);
    },
    [getValues, brandKeywordFields, isAtKeywordLimit]
  );

  const addCompetitorKeyword = useCallback(
    (kw: string) => {
      const trimmed = kw.trim().toLowerCase();
      if (!trimmed) return;
      const existing = getValues("competitorKeywords").map((k) => k.value.toLowerCase());
      if (existing.includes(trimmed)) return;
      const enabled = !isAtKeywordLimit();
      competitorKeywordFields.append({ value: trimmed, enabled });
      if (!enabled) setShowUpgradeModal(true);
    },
    [getValues, competitorKeywordFields, isAtKeywordLimit]
  );

  const addSubreddit = useCallback(
    (sub: SubredditEntry) => {
      const name = sub.name.replace(/^r\//, "").trim().toLowerCase();
      if (!name) return;
      const existing = getValues("subreddits").map((s) => s.name.toLowerCase());
      if (existing.includes(name)) return;
      subredditFields.append({ ...sub, name });
    },
    [getValues, subredditFields]
  );

  // -------------------------------------------------------------------------
  // Watched values for rendering
  // -------------------------------------------------------------------------

  const urlValue = watch("url");
  const featureKeywordsValue = watch("featureKeywords");
  const brandKeywordsValue = watch("brandKeywords");
  const competitorKeywordsValue = watch("competitorKeywords");
  const featureStrategyEnabled = watch("featureStrategyEnabled");
  const brandStrategyEnabled = watch("brandStrategyEnabled");
  const competitorStrategyEnabled = watch("competitorStrategyEnabled");
  const subredditsValue = watch("subreddits");
  const automationMode = watch("automationMode");
  const valuePropsValue = watch("valueProps");

  const totalKeywords = featureKeywordsValue.length + brandKeywordsValue.length + competitorKeywordsValue.length;
  const activeKeywords = featureKeywordsValue.filter((k) => k.enabled).length + brandKeywordsValue.filter((k) => k.enabled).length + competitorKeywordsValue.filter((k) => k.enabled).length;

  // Filter suggested subreddits by what's already active
  const activeSubNames = new Set(subredditsValue.map((s) => s.name.toLowerCase()));
  const filteredSuggested = suggestedSubreddits.filter((s) => !activeSubNames.has(s.name.toLowerCase()));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Show loading while checking for existing draft
  if (draftQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 size={32} className="text-teal animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Seo title="New Campaign -- SlopMog" noIndex />

      <PageHeader
        title="Create Campaign"
        description="Set up your Reddit infiltration mission in a few easy steps"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Campaigns", href: routes.dashboard.campaigns.index },
          { label: "New Campaign" },
        ]}
      />

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEP_LABELS.map((label, i) => {
          const completed = i < step;
          const current = i === step;
          return (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-all ${
                current
                  ? "bg-teal text-white"
                  : completed
                    ? "bg-teal/10 text-teal cursor-pointer hover:bg-teal/20"
                    : "bg-charcoal/[0.06] text-charcoal-light cursor-default"
              }`}
              disabled={i > step}
            >
              {completed && <Check size={12} />}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* STEP 0: Enter URL */}
      {/* ============================================================= */}
      {step === 0 && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-teal/10 mx-auto mb-5">
              <Globe size={28} className="text-teal" />
            </div>
            <h2 className="font-heading font-bold text-xl text-charcoal text-center mb-2">
              What&apos;s your website?
            </h2>
            <p className="text-sm text-charcoal-light text-center mb-6">
              We&apos;ll analyze it and figure out the best keywords, subreddits, and strategy. You can skip this and set everything up manually, too.
            </p>

            <div className="space-y-4">
              <input
                type="url"
                placeholder="https://your-awesome-product.com"
                className="w-full px-5 py-4 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-base text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                {...register("url")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAnalyzeSite();
                  }
                }}
              />

              {analyzeSite.isPending ? (
                <div className="flex flex-col items-center py-6">
                  <Loader2
                    size={32}
                    className="text-teal animate-spin mb-3"
                  />
                  <p className="text-sm text-charcoal-light font-medium animate-pulse">
                    {analysisMessage}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAnalyzeSite}
                  disabled={!urlValue?.trim()}
                  className="w-full bg-coral text-white py-3.5 rounded-full font-bold text-[0.95rem] shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  Analyze My Site
                </button>
              )}

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-sm text-charcoal-light font-semibold hover:text-charcoal transition-colors py-2"
              >
                Skip -- I&apos;ll set it up manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 1: Review Site Info */}
      {/* ============================================================= */}
      {step === 1 && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-6 md:p-8 space-y-5">
            <h2 className="font-heading font-bold text-lg text-charcoal mb-1">
              Review Your Info
            </h2>
            <p className="text-sm text-charcoal-light mb-4">
              We pulled this from your website. Edit anything that looks off.
            </p>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                placeholder="Your company name"
                {...register("businessName")}
              />
            </div>

            {/* Business Description */}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors resize-none"
                placeholder="What does your business do?"
                {...register("businessDescription")}
              />
            </div>

            {/* Value Props (chip input) */}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1.5">
                Value Propositions
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {valuePropsValue.map((vp, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-teal/10 text-teal-dark text-[0.82rem] font-semibold px-3 py-1 rounded-full"
                  >
                    {vp.value}
                    <button
                      type="button"
                      onClick={() => valuePropFields.remove(idx)}
                      className="hover:text-coral transition-colors ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                  placeholder="Add a value prop"
                  value={newValuePropInput}
                  onChange={(e) => setNewValuePropInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newValuePropInput.trim()) {
                        valuePropFields.append({ value: newValuePropInput.trim() });
                        setNewValuePropInput("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newValuePropInput.trim()) {
                      valuePropFields.append({ value: newValuePropInput.trim() });
                      setNewValuePropInput("");
                    }
                  }}
                  className="px-4 py-2.5 bg-teal/10 text-teal font-bold text-sm rounded-brand-sm hover:bg-teal/20 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1.5">
                Target Audience
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                placeholder="Who is your ideal customer?"
                {...register("targetAudience")}
              />
            </div>
          </div>

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-teal-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              This looks right
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 2: Keywords (Strategy Buckets) */}
      {/* ============================================================= */}
      {step === 2 && (
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading font-bold text-lg text-charcoal text-center mb-2">
            Discovery Strategies
          </h2>
          <p className="text-sm text-charcoal-light text-center mb-6">
            We search Reddit using 3 different strategies. Toggle them on or off and edit the keywords for each.
          </p>

          <div className="space-y-4">
            {/* Feature Strategy Bucket */}
            <StrategyBucket
              icon={<Sparkles size={18} className="text-teal" />}
              label="Feature Keywords"
              description="What your product does — problems it solves, features it offers. Searched Reddit-wide and in your subreddits."
              color="teal"
              enabled={featureStrategyEnabled}
              onToggle={() => setValue("featureStrategyEnabled", !featureStrategyEnabled)}
              keywords={featureKeywordsValue}
              onRemove={(idx) => featureKeywordFields.remove(idx)}
              onToggleKeyword={(idx) => toggleKeyword("featureKeywords", idx)}
              inputValue={newFeatureKwInput}
              onInputChange={setNewFeatureKwInput}
              onAdd={(kw) => { addFeatureKeyword(kw); setNewFeatureKwInput(""); }}
              placeholder="e.g. project management tool"
            />

            {/* Brand Strategy Bucket */}
            <StrategyBucket
              icon={<Shield size={18} className="text-coral" />}
              label="Brand Keywords"
              description="Your brand name, product name, URLs, and common misspellings. Finds threads where people mention you directly."
              color="coral"
              enabled={brandStrategyEnabled}
              onToggle={() => setValue("brandStrategyEnabled", !brandStrategyEnabled)}
              keywords={brandKeywordsValue}
              onRemove={(idx) => brandKeywordFields.remove(idx)}
              onToggleKeyword={(idx) => toggleKeyword("brandKeywords", idx)}
              inputValue={newBrandKwInput}
              onInputChange={setNewBrandKwInput}
              onAdd={(kw) => { addBrandKeyword(kw); setNewBrandKwInput(""); }}
              placeholder="e.g. your product name"
            />

            {/* Competitor Strategy Bucket */}
            <StrategyBucket
              icon={<Swords size={18} className="text-lavender" />}
              label="Competitor Keywords"
              description="Competitor names and products. We search for 'alternative to X', 'X vs', and 'switch from X' patterns."
              color="lavender"
              enabled={competitorStrategyEnabled}
              onToggle={() => setValue("competitorStrategyEnabled", !competitorStrategyEnabled)}
              keywords={competitorKeywordsValue}
              onRemove={(idx) => competitorKeywordFields.remove(idx)}
              onToggleKeyword={(idx) => toggleKeyword("competitorKeywords", idx)}
              inputValue={newCompetitorKwInput}
              onInputChange={setNewCompetitorKwInput}
              onAdd={(kw) => { addCompetitorKeyword(kw); setNewCompetitorKwInput(""); }}
              placeholder="e.g. competitor name"
            />
          </div>

          {/* Keyword usage counter */}
          <div className="text-center mt-4">
            {maxKeywords === Infinity ? (
              <span className="text-[0.82rem] font-semibold text-charcoal-light">
                {totalKeywords} keyword{totalKeywords !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className={`text-[0.82rem] font-semibold ${
                activeKeywords >= maxKeywords ? "text-teal" : "text-charcoal-light"
              }`}>
                {activeKeywords} / {maxKeywords} active keywords
                {activeKeywords < totalKeywords && (
                  <span className="text-charcoal-light/50"> ({totalKeywords - activeKeywords} locked)</span>
                )}
                {activeKeywords >= maxKeywords && (
                  <>
                    {" "}&middot;{" "}
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="text-coral hover:text-coral-dark font-bold underline underline-offset-2 transition-colors"
                    >
                      Unlock more
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
          {activeKeywords === 0 && (
            <p className="text-center text-[0.82rem] text-coral font-medium mt-1">
              You need at least 1 active keyword to continue.
            </p>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={activeKeywords === 0}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-teal-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Next
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 3: Subreddits */}
      {/* ============================================================= */}
      {step === 3 && (
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active subreddits */}
            <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-teal" />
                <h3 className="font-heading font-bold text-charcoal">
                  Your Subreddits
                </h3>
                <span className="ml-auto text-[0.75rem] font-bold bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                  {subredditsValue.length}
                </span>
              </div>

              <div className="space-y-2 mb-4 min-h-[80px]">
                {subredditsValue.length === 0 && (
                  <p className="text-sm text-charcoal-light/60 italic">
                    No subreddits yet. Add some below or pick from suggestions.
                  </p>
                )}
                {subredditsValue.map((sub, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-teal/[0.06] rounded-brand-sm px-3 py-2"
                  >
                    <div>
                      <span className="text-[0.88rem] font-semibold text-charcoal">
                        r/{sub.name}
                      </span>
                      {sub.memberCount && (
                        <span className="text-[0.75rem] text-charcoal-light ml-2">
                          {sub.memberCount >= 1000000
                            ? `${(sub.memberCount / 1000000).toFixed(1)}M`
                            : sub.memberCount >= 1000
                              ? `${(sub.memberCount / 1000).toFixed(0)}K`
                              : sub.memberCount}{" "}
                          members
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => subredditFields.remove(idx)}
                      className="text-charcoal-light hover:text-coral transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                  placeholder="Subreddit name (without r/)"
                  value={newSubredditInput}
                  onChange={(e) => setNewSubredditInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubreddit({ name: newSubredditInput });
                      setNewSubredditInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    addSubreddit({ name: newSubredditInput });
                    setNewSubredditInput("");
                  }}
                  className="px-4 py-2.5 bg-teal/10 text-teal font-bold text-sm rounded-brand-sm hover:bg-teal/20 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Suggested subreddits */}
            <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-sunny-dark" />
                <h3 className="font-heading font-bold text-charcoal">
                  Suggested
                </h3>
              </div>

              {filteredSuggested.length === 0 ? (
                <p className="text-sm text-charcoal-light/60 italic">
                  {suggestedSubreddits.length > 0
                    ? "You've added all the suggestions. Thorough!"
                    : "Run site analysis to get subreddit suggestions."}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredSuggested.map((sub) => (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => addSubreddit(sub)}
                      className="w-full text-left bg-charcoal/[0.03] rounded-brand-sm px-3 py-2.5 hover:bg-teal/[0.06] transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Plus
                          size={14}
                          className="text-charcoal-light group-hover:text-teal transition-colors shrink-0"
                        />
                        <span className="text-[0.88rem] font-semibold text-charcoal">
                          r/{sub.name}
                        </span>
                        {sub.memberCount && (
                          <span className="text-[0.75rem] text-charcoal-light">
                            {sub.memberCount >= 1000000
                              ? `${(sub.memberCount / 1000000).toFixed(1)}M`
                              : sub.memberCount >= 1000
                                ? `${(sub.memberCount / 1000).toFixed(0)}K`
                                : sub.memberCount}
                          </span>
                        )}
                      </div>
                      {sub.reason && (
                        <p className="text-[0.75rem] text-charcoal-light ml-6 mt-0.5">
                          {sub.reason}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Minimum notice */}
          {subredditsValue.length === 0 && (
            <p className="text-center text-[0.82rem] text-coral font-medium mt-4">
              You need at least 1 subreddit to continue.
            </p>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={subredditsValue.length === 0}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-teal-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Next
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 4: Automation Mode */}
      {/* ============================================================= */}
      {step === 4 && (
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading font-bold text-lg text-charcoal text-center mb-2">
            How hands-on do you wanna be?
          </h2>
          <p className="text-sm text-charcoal-light text-center mb-8">
            You can always change this later. No commitment issues here.
          </p>

          <Controller
            control={control}
            name="automationMode"
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Full Control */}
                <button
                  type="button"
                  onClick={() => field.onChange("FULL_MANUAL")}
                  className={`relative bg-white rounded-brand-lg shadow-brand-sm border-2 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-brand-md ${
                    field.value === "FULL_MANUAL"
                      ? "border-teal ring-2 ring-teal/20"
                      : "border-charcoal/[0.06]"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                    <ShieldCheck size={24} className="text-teal" />
                  </div>
                  <h3 className="font-heading font-bold text-charcoal mb-1">
                    Full Control
                  </h3>
                  <p className="text-[0.82rem] text-charcoal-light leading-relaxed">
                    Review every opportunity and comment before posting. Maximum oversight.
                  </p>
                  {field.value === "FULL_MANUAL" && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>

                {/* Semi-Auto */}
                <button
                  type="button"
                  onClick={() => field.onChange("SEMI_AUTO")}
                  className={`relative bg-white rounded-brand-lg shadow-brand-sm border-2 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-brand-md ${
                    field.value === "SEMI_AUTO"
                      ? "border-teal ring-2 ring-teal/20"
                      : "border-charcoal/[0.06]"
                  }`}
                >
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-coral text-white text-[0.65rem] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                    Recommended
                  </span>
                  <div className="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center mb-4">
                    <SlidersHorizontal size={24} className="text-coral" />
                  </div>
                  <h3 className="font-heading font-bold text-charcoal mb-1">
                    Semi-Auto
                  </h3>
                  <p className="text-[0.82rem] text-charcoal-light leading-relaxed">
                    Approve opportunities, we handle the comments. Best of both worlds.
                  </p>
                  {field.value === "SEMI_AUTO" && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>

                {/* Autopilot */}
                <button
                  type="button"
                  onClick={() => field.onChange("AUTOPILOT")}
                  className={`relative bg-white rounded-brand-lg shadow-brand-sm border-2 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-brand-md ${
                    field.value === "AUTOPILOT"
                      ? "border-teal ring-2 ring-teal/20"
                      : "border-charcoal/[0.06]"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-sunny/20 flex items-center justify-center mb-4">
                    <Rocket size={24} className="text-sunny-dark" />
                  </div>
                  <h3 className="font-heading font-bold text-charcoal mb-1">
                    Autopilot
                  </h3>
                  <p className="text-[0.82rem] text-charcoal-light leading-relaxed">
                    Sit back. We find, write, and post. You just watch the credits go.
                  </p>
                  {field.value === "AUTOPILOT" && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              </div>
            )}
          />

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-teal-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Next
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 5: Review & Launch */}
      {/* ============================================================= */}
      {step === 5 && (
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="font-heading font-bold text-xl text-charcoal text-center mb-1">
            Ready to launch?
          </h2>
          <p className="text-sm text-charcoal-light text-center mb-6">
            Double-check everything. Once you launch, we start finding opportunities.
          </p>

          {/* Business Info */}
          <ReviewCard
            title="Business Info"
            onEdit={() => setStep(1)}
          >
            <ReviewRow label="Name" value={watch("businessName") || "Not set"} />
            <ReviewRow label="Description" value={watch("businessDescription") || "Not set"} />
            <ReviewRow label="Audience" value={watch("targetAudience") || "Not set"} />
            <ReviewRow
              label="Value Props"
              value={
                valuePropsValue.length > 0
                  ? valuePropsValue.map((v) => v.value).join(", ")
                  : "None"
              }
            />
          </ReviewCard>

          {/* Keywords */}
          <ReviewCard
            title={maxKeywords === Infinity ? `Keywords (${activeKeywords})` : `Keywords (${activeKeywords} active${totalKeywords > activeKeywords ? `, ${totalKeywords - activeKeywords} locked` : ""})`}
            onEdit={() => setStep(2)}
          >
            <div className="space-y-2">
              {featureKeywordsValue.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {featureKeywordsValue.map((kw, idx) => (
                    <span key={idx} className={`text-[0.78rem] font-semibold px-2.5 py-1 rounded-full ${kw.enabled ? "bg-teal text-white" : "bg-charcoal/[0.04] text-charcoal-light/40 line-through"}`}>
                      {kw.value}
                    </span>
                  ))}
                </div>
              )}
              {brandKeywordsValue.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {brandKeywordsValue.map((kw, idx) => (
                    <span key={idx} className={`text-[0.78rem] font-semibold px-2.5 py-1 rounded-full ${kw.enabled ? "bg-coral text-white" : "bg-charcoal/[0.04] text-charcoal-light/40 line-through"}`}>
                      {kw.value}
                    </span>
                  ))}
                </div>
              )}
              {competitorKeywordsValue.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {competitorKeywordsValue.map((kw, idx) => (
                    <span key={idx} className={`text-[0.78rem] font-semibold px-2.5 py-1 rounded-full ${kw.enabled ? "bg-lavender text-white" : "bg-charcoal/[0.04] text-charcoal-light/40 line-through"}`}>
                      {kw.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </ReviewCard>

          {/* Subreddits */}
          <ReviewCard
            title={`Subreddits (${subredditsValue.length})`}
            onEdit={() => setStep(3)}
          >
            <div className="flex flex-wrap gap-1.5">
              {subredditsValue.map((sub, idx) => (
                <span
                  key={idx}
                  className="bg-lavender/10 text-lavender text-[0.78rem] font-semibold px-2.5 py-1 rounded-full"
                >
                  r/{sub.name}
                </span>
              ))}
            </div>
          </ReviewCard>

          {/* Automation */}
          <ReviewCard
            title="Automation Mode"
            onEdit={() => setStep(4)}
          >
            <span className="text-sm font-semibold text-charcoal">
              {automationMode === "FULL_MANUAL" && "Full Control -- Review everything"}
              {automationMode === "SEMI_AUTO" && "Semi-Auto -- Approve opportunities, we write comments"}
              {automationMode === "AUTOPILOT" && "Autopilot -- Fully automated"}
            </span>
          </ReviewCard>

          {/* Launch button */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-light hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={activateMutation.isPending}
              className="inline-flex items-center gap-2 bg-coral text-white px-8 py-3 rounded-full font-bold text-[0.95rem] shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket size={18} />
                  Launch Campaign
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {/* Subscription upgrade modal */}
      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Need more keywords?"
        description={`Your ${planName} plan supports ${maxKeywords} keywords. Upgrade for more keyword slots and extra posting credits.`}
      />
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ReviewCard = ({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) => (
  <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-heading font-bold text-charcoal text-sm">
        {title}
      </h3>
      <button
        type="button"
        onClick={onEdit}
        className="text-[0.78rem] font-semibold text-teal hover:text-teal-dark transition-colors"
      >
        Edit
      </button>
    </div>
    {children}
  </div>
);

const STRATEGY_BORDER_COLORS: Record<string, string> = {
  teal: "border-teal/20",
  coral: "border-coral/20",
  lavender: "border-lavender/20",
};

const STRATEGY_CHIP_COLORS: Record<string, string> = {
  teal: "bg-teal text-white",
  coral: "bg-coral text-white",
  lavender: "bg-lavender text-white",
};

const StrategyBucket = ({
  icon,
  label,
  description,
  color,
  enabled,
  onToggle,
  keywords,
  onRemove,
  onToggleKeyword,
  inputValue,
  onInputChange,
  onAdd,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  enabled: boolean;
  onToggle: () => void;
  keywords: KeywordEntry[];
  onRemove: (idx: number) => void;
  onToggleKeyword: (idx: number) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  onAdd: (val: string) => void;
  placeholder: string;
}) => {
  const enabledCount = keywords.filter((k) => k.enabled).length;
  const disabledCount = keywords.length - enabledCount;

  return (
    <div className={`bg-white rounded-brand-lg shadow-brand-sm border-2 p-5 transition-all ${
      enabled ? (STRATEGY_BORDER_COLORS[color] ?? "border-charcoal/[0.06]") : "border-charcoal/[0.06] opacity-60"
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <div className="flex-1">
          <h3 className="font-heading font-bold text-charcoal text-sm">{label}</h3>
          <p className="text-[0.75rem] text-charcoal-light leading-snug">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.72rem] font-bold text-charcoal-light">
            {enabledCount}{disabledCount > 0 && <span className="text-charcoal-light/40">+{disabledCount}</span>}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-teal" : "bg-charcoal/20"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
            {keywords.length === 0 && (
              <p className="text-[0.78rem] text-charcoal-light/50 italic">No keywords yet</p>
            )}
            {keywords.map((kw, idx) => kw.enabled ? (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 text-[0.78rem] font-semibold pl-2.5 pr-1 py-1 rounded-full ${STRATEGY_CHIP_COLORS[color] ?? "bg-charcoal/10 text-charcoal"}`}
              >
                <button type="button" onClick={() => onToggleKeyword(idx)} className="hover:opacity-70 transition-opacity">
                  {kw.value}
                </button>
                <button type="button" onClick={() => onRemove(idx)} className="opacity-60 hover:opacity-100 transition-opacity ml-0.5">
                  <X size={12} />
                </button>
              </span>
            ) : (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[0.78rem] font-medium pl-2.5 pr-1 py-1 rounded-full bg-charcoal/[0.05] text-charcoal-light/40 border border-dashed border-charcoal/[0.08]"
              >
                <button type="button" onClick={() => onToggleKeyword(idx)} className="hover:text-charcoal-light/70 transition-colors">
                  {kw.value}
                </button>
                <button type="button" onClick={() => onRemove(idx)} className="opacity-40 hover:opacity-70 hover:text-coral transition-all ml-0.5">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd(inputValue);
                }
              }}
            />
            <button
              type="button"
              onClick={() => onAdd(inputValue)}
              className="px-3 py-2 bg-charcoal/[0.04] text-charcoal font-bold text-sm rounded-brand-sm hover:bg-charcoal/[0.08] transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-1.5 border-b border-charcoal/[0.04] last:border-0">
    <span className="text-[0.78rem] font-semibold text-charcoal-light w-28 shrink-0">
      {label}
    </span>
    <span className="text-[0.85rem] text-charcoal">{value}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Server-side auth
// ---------------------------------------------------------------------------

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
