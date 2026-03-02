import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import { Globe, Loader2, ArrowRight, Lock } from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";
import AddSiteIllustrationV3 from "@/components/illustrations/AddSiteIllustrationV3";
import AddSiteIllustrationV2 from "@/components/illustrations/AddSiteIllustrationV2";

export default function NewSitePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [platforms, setPlatforms] = useState<("REDDIT" | "YOUTUBE")[]>([
    "REDDIT",
    "YOUTUBE",
  ]);
  const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const planQuery = trpc.user.getPlanInfo.useQuery();
  const canUseAuto = planQuery.data?.canPost ?? false;

  const createSite = trpc.site.create.useMutation({
    onSuccess: (site) => {
      toast.success(
        `${site.name} added! We found ${site.keywords.length} keywords to monitor.`,
      );
      router.push(routes.dashboard.sites.detail(site.id));
    },
    onError: (err) => toast.error(err.message),
  });

  const togglePlatform = (p: "REDDIT" | "YOUTUBE") => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || platforms.length === 0) return;

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    createSite.mutate({ url: normalizedUrl, platforms, mode });
  };

  return (
    <DashboardLayout>
      <Seo title="Add Site -- SlopMog" noIndex />

      <PageHeader
        title="Add a new site"
        description="Tell us where to look and we'll handle the rest"
        breadcrumbs={[
          { label: "Sites", href: routes.dashboard.sites.index },
          { label: "Add Site" },
        ]}
      />

      <div className="grid lg:grid-cols-8 gap-6 items-start">
        {/* Left: Form — takes 3 cols */}
        <form onSubmit={handleSubmit} className="lg:col-span-5">
          <div className="bg-white rounded-brand-lg shadow-brand-sm border border-charcoal/[0.06]">
            {/* Section 1: URL */}
            <div className="p-6 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal text-white text-xs font-bold">
                  1
                </span>
                <span className="text-sm font-bold text-charcoal">
                  Your website
                </span>
              </div>
              <div className="relative">
                <Globe
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-light/50 pointer-events-none"
                />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yoursite.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-brand-sm border-2 border-charcoal/[0.08] bg-cream/50 text-charcoal font-semibold placeholder:text-charcoal-light/30 placeholder:font-normal focus:outline-none focus:border-teal focus:bg-white transition-all"
                  required
                />
              </div>
              <p className="text-xs text-charcoal-light/70 mt-2">
                We'll scrape your site to extract keywords, value props, and
                brand tone.
              </p>
            </div>

            <div className="h-px bg-charcoal/[0.06] mx-6" />

            {/* Section 2: Platforms */}
            <div className="p-6 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal text-white text-xs font-bold">
                  2
                </span>
                <span className="text-sm font-bold text-charcoal">
                  Platforms to target
                </span>
              </div>
              <div className="flex gap-3">
                {[
                  { value: "REDDIT" as const, label: "Reddit" },
                  { value: "YOUTUBE" as const, label: "YouTube" },
                ].map((p) => {
                  const selected = platforms.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border-2 text-sm font-bold transition-all ${
                        selected
                          ? "border-teal bg-teal/[0.06] text-teal"
                          : "border-charcoal/[0.08] text-charcoal-light hover:border-charcoal/[0.15] hover:text-charcoal"
                      }`}
                    >
                      {p.label}
                      {selected && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {platforms.length === 0 && (
                <p className="text-xs text-coral mt-2 font-semibold">
                  Pick at least one
                </p>
              )}
            </div>

            <div className="h-px bg-charcoal/[0.06] mx-6" />

            {/* Section 3: Mode */}
            <div className="p-6 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal text-white text-xs font-bold">
                  3
                </span>
                <span className="text-sm font-bold text-charcoal">
                  How should we operate?
                </span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    value: "MANUAL" as const,
                    label: "Manual review",
                    desc: "You approve each comment before it goes live",
                    recommended: true,
                  },
                  {
                    value: "AUTO" as const,
                    label: "Full autopilot",
                    desc: "We find, write, and post — you just watch the magic",
                    recommended: false,
                  },
                ].map((m) => {
                  const selected = mode === m.value;
                  const locked = m.value === "AUTO" && !canUseAuto;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          setShowUpgradeModal(true);
                          return;
                        }
                        setMode(m.value);
                      }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-brand-sm border-2 text-left transition-all ${
                        selected
                          ? "border-teal bg-teal/[0.04]"
                          : locked
                            ? "border-charcoal/[0.06] opacity-60 cursor-pointer"
                            : "border-charcoal/[0.06] hover:border-charcoal/[0.12]"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                          selected ? "border-teal" : "border-charcoal/20"
                        }`}
                      >
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-teal" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${selected ? "text-charcoal" : "text-charcoal-light"}`}
                          >
                            {m.label}
                          </span>
                          {m.recommended && (
                            <span className="px-1.5 py-0.5 rounded-full bg-teal/10 text-[10px] font-bold text-teal uppercase tracking-wide">
                              Recommended
                            </span>
                          )}
                          {locked && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-coral/10 text-[10px] font-bold text-coral uppercase tracking-wide">
                              <Lock size={9} />
                              Pro
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs mt-0.5 ${selected ? "text-charcoal-light" : "text-charcoal-light/60"}`}
                        >
                          {m.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <div className="p-6 pt-4 bg-charcoal/[0.015] rounded-b-brand-lg border-t border-charcoal/[0.06]">
              <button
                type="submit"
                disabled={
                  createSite.isPending || !url || platforms.length === 0
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-coral text-white px-6 py-3.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {createSite.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing your site...
                  </>
                ) : (
                  <>
                    Add Site & Analyze
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Right: Animated illustration — takes 2 cols */}
        <div className="lg:col-span-3 hidden lg:flex flex-col items-center justify-center sticky top-8">
          <div className="w-full h-full max-w-full max-h-full">
            <AddSiteIllustrationV2 />
          </div>
          <p className="text-xs text-charcoal-light text-center mt-3 max-w-[280px] leading-relaxed">
            We analyze your site, discover opportunities, and generate comments
            across platforms.
          </p>
        </div>
      </div>

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Autopilot requires a paid plan"
        description="Upgrade to let SlopMog find, write, and post comments automatically."
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
