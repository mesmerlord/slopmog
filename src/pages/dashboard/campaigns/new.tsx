import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubredditEntry {
  name: string;
  memberCount?: number;
  expectedTone?: string;
  reason?: string;
}

interface WizardForm {
  url: string;
  businessName: string;
  businessDescription: string;
  valueProps: { value: string }[];
  targetAudience: string;
  keywords: { value: string }[];
  subreddits: SubredditEntry[];
  automationMode: "FULL_MANUAL" | "SEMI_AUTO" | "AUTOPILOT";
}

// ---------------------------------------------------------------------------
// Session storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "slopmog-campaign-wizard";

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
// Helpers
// ---------------------------------------------------------------------------

const loadSavedForm = (): Partial<WizardForm> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<WizardForm>;
  } catch {
    return null;
  }
};

const saveFormToStorage = (data: WizardForm) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable, ignore
  }
};

const clearStorage = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState(ANALYSIS_MESSAGES[0]);

  // Suggested items from analysis (not directly in the form)
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [suggestedSubreddits, setSuggestedSubreddits] = useState<SubredditEntry[]>([]);
  const [analysisRaw, setAnalysisRaw] = useState<Record<string, unknown> | null>(null);

  // -------------------------------------------------------------------------
  // Form setup
  // -------------------------------------------------------------------------

  const defaultValues: WizardForm = {
    url: "",
    businessName: "",
    businessDescription: "",
    valueProps: [],
    targetAudience: "",
    keywords: [],
    subreddits: [],
    automationMode: "SEMI_AUTO",
  };

  const saved = useMemo(() => loadSavedForm(), []);

  const form = useForm<WizardForm>({
    defaultValues: saved
      ? { ...defaultValues, ...saved }
      : defaultValues,
  });

  const { control, register, watch, setValue, getValues, handleSubmit } = form;

  const valuePropFields = useFieldArray({ control, name: "valueProps" });
  const keywordFields = useFieldArray({ control, name: "keywords" });
  const subredditFields = useFieldArray({ control, name: "subreddits" });

  // Persist to session storage on change
  const watchAll = watch();
  useEffect(() => {
    saveFormToStorage(watchAll);
  }, [watchAll]);

  // Restore step from storage
  useEffect(() => {
    if (saved && saved.businessName) {
      // User has past the analysis step -- figure out what step they were on
      const kw = saved.keywords ?? [];
      const sr = saved.subreddits ?? [];
      if (kw.length > 0 && sr.length > 0) {
        setStep(4);
      } else if (kw.length > 0) {
        setStep(3);
      } else {
        setStep(1);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Create campaign mutation
  // -------------------------------------------------------------------------

  const createCampaign = trpc.campaign.create.useMutation({
    onSuccess: (data) => {
      clearStorage();
      toast.success("Campaign created! Let's go shill.");
      router.push(routes.dashboard.campaigns.detail(data.id));
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong creating the campaign.");
    },
  });

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

      // Primary + problem keywords go into the active keywords list
      const activeKw = [
        ...(result.primaryKeywords || []),
        ...(result.problemKeywords || []),
      ];
      setValue(
        "keywords",
        activeKw.map((k) => ({ value: k }))
      );

      // Competitor + long-tail go into suggestions
      const suggested = [
        ...(result.competitorKeywords || []),
        ...(result.longTailKeywords || []),
      ];
      setSuggestedKeywords(suggested);

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
      setAnalysisRaw(result as unknown as Record<string, unknown>);

      setStep(1);
    } catch {
      toast.error("Failed to analyze site. Please check the URL and try again.");
    }
  }, [analyzeSite, getValues, setValue]);

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  const canProceed = useCallback(
    (fromStep: number): boolean => {
      const vals = getValues();
      if (fromStep === 2) return vals.keywords.length >= 1;
      if (fromStep === 3) return vals.subreddits.length >= 1;
      return true;
    },
    [getValues]
  );

  const goNext = useCallback(() => {
    if (!canProceed(step)) {
      if (step === 2) toast.error("Add at least one keyword to continue.");
      if (step === 3) toast.error("Add at least one subreddit to continue.");
      return;
    }
    setStep((s) => Math.min(s + 1, 5));
  }, [step, canProceed]);

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

  const onLaunch = useCallback(() => {
    const vals = getValues();
    createCampaign.mutate({
      name: vals.businessName || "Untitled Campaign",
      description: vals.businessDescription,
      websiteUrl: vals.url || undefined,
      businessName: vals.businessName || undefined,
      businessDescription: vals.businessDescription || undefined,
      valueProps: vals.valueProps.map((v) => v.value).filter(Boolean),
      targetAudience: vals.targetAudience || undefined,
      automationMode: vals.automationMode,
      siteAnalysisData: analysisRaw ?? undefined,
      keywords: vals.keywords.map((k) => k.value).filter(Boolean),
      subreddits: vals.subreddits
        .filter((s) => s.name)
        .map((s) => ({
          name: s.name,
          memberCount: s.memberCount,
          expectedTone: s.expectedTone,
        })),
    });
  }, [getValues, createCampaign, analysisRaw]);

  // -------------------------------------------------------------------------
  // Tag input helpers
  // -------------------------------------------------------------------------

  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [newSubredditInput, setNewSubredditInput] = useState("");
  const [newValuePropInput, setNewValuePropInput] = useState("");

  const addKeyword = useCallback(
    (kw: string) => {
      const trimmed = kw.trim().toLowerCase();
      if (!trimmed) return;
      const existing = getValues("keywords").map((k) => k.value.toLowerCase());
      if (existing.includes(trimmed)) return;
      keywordFields.append({ value: trimmed });
    },
    [getValues, keywordFields]
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
  const keywordsValue = watch("keywords");
  const subredditsValue = watch("subreddits");
  const automationMode = watch("automationMode");
  const valuePropsValue = watch("valueProps");

  // Filter suggested keywords by what's already active
  const filteredSuggestedKeywords = useMemo(() => {
    const active = new Set(keywordsValue.map((k) => k.value.toLowerCase()));
    return suggestedKeywords.filter((s) => !active.has(s.toLowerCase()));
  }, [keywordsValue, suggestedKeywords]);

  // Filter suggested subreddits by what's already active
  const filteredSuggestedSubreddits = useMemo(() => {
    const active = new Set(subredditsValue.map((s) => s.name.toLowerCase()));
    return suggestedSubreddits.filter((s) => !active.has(s.name.toLowerCase()));
  }, [subredditsValue, suggestedSubreddits]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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
      {/* STEP 2: Keywords */}
      {/* ============================================================= */}
      {step === 2 && (
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active keywords */}
            <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Hash size={18} className="text-teal" />
                <h3 className="font-heading font-bold text-charcoal">
                  Your Keywords
                </h3>
                <span className="ml-auto text-[0.75rem] font-bold bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                  {keywordsValue.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4 min-h-[80px]">
                {keywordsValue.length === 0 && (
                  <p className="text-sm text-charcoal-light/60 italic">
                    No keywords yet. Add some below or pick from suggestions.
                  </p>
                )}
                {keywordsValue.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-teal/10 text-teal-dark text-[0.82rem] font-semibold px-3 py-1.5 rounded-full"
                  >
                    {kw.value}
                    <button
                      type="button"
                      onClick={() => keywordFields.remove(idx)}
                      className="hover:text-coral transition-colors ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-sm text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                  placeholder="Type a keyword and press Enter"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword(newKeywordInput);
                      setNewKeywordInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    addKeyword(newKeywordInput);
                    setNewKeywordInput("");
                  }}
                  className="px-4 py-2.5 bg-teal/10 text-teal font-bold text-sm rounded-brand-sm hover:bg-teal/20 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Suggested keywords */}
            <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-sunny-dark" />
                <h3 className="font-heading font-bold text-charcoal">
                  Suggested
                </h3>
              </div>

              {filteredSuggestedKeywords.length === 0 ? (
                <p className="text-sm text-charcoal-light/60 italic">
                  {suggestedKeywords.length > 0
                    ? "You've added all the suggestions. Nice!"
                    : "Run site analysis to get keyword suggestions."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredSuggestedKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => addKeyword(kw)}
                      className="inline-flex items-center gap-1 bg-charcoal/[0.04] text-charcoal text-[0.82rem] font-medium px-3 py-1.5 rounded-full hover:bg-teal/10 hover:text-teal transition-colors"
                    >
                      <Plus size={13} />
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Minimum notice */}
          {keywordsValue.length === 0 && (
            <p className="text-center text-[0.82rem] text-coral font-medium mt-4">
              You need at least 1 keyword to continue.
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
              disabled={keywordsValue.length === 0}
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

              {filteredSuggestedSubreddits.length === 0 ? (
                <p className="text-sm text-charcoal-light/60 italic">
                  {suggestedSubreddits.length > 0
                    ? "You've added all the suggestions. Thorough!"
                    : "Run site analysis to get subreddit suggestions."}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredSuggestedSubreddits.map((sub) => (
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
            title={`Keywords (${keywordsValue.length})`}
            onEdit={() => setStep(2)}
          >
            <div className="flex flex-wrap gap-1.5">
              {keywordsValue.map((kw, idx) => (
                <span
                  key={idx}
                  className="bg-teal/10 text-teal-dark text-[0.78rem] font-semibold px-2.5 py-1 rounded-full"
                >
                  {kw.value}
                </span>
              ))}
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
              disabled={createCampaign.isPending}
              className="inline-flex items-center gap-2 bg-coral text-white px-8 py-3 rounded-full font-bold text-[0.95rem] shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {createCampaign.isPending ? (
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
