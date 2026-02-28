import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import { Globe, Loader2 } from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function NewSitePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [platforms, setPlatforms] = useState<("REDDIT" | "YOUTUBE")[]>(["REDDIT", "YOUTUBE"]);
  const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");

  const createSite = trpc.site.create.useMutation({
    onSuccess: (site) => {
      toast.success(`${site.name} added! We found ${site.keywords.length} keywords to monitor.`);
      router.push(routes.dashboard.sites.detail(site.id));
    },
    onError: (err) => {
      toast.error(err.message);
    },
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
        title="Add Site"
        description="Drop your URL and we'll figure out the rest"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Sites", href: routes.dashboard.sites.index },
          { label: "Add Site" },
        ]}
      />

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-semibold text-charcoal mb-1.5">
              Website URL
            </label>
            <div className="relative">
              <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full pl-10 pr-4 py-3 rounded-brand-sm border border-charcoal/[0.12] bg-white text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                required
              />
            </div>
            <p className="text-xs text-charcoal-light mt-1">
              We'll analyze your site to find keywords and value props automatically.
            </p>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-2">
              Platforms
            </label>
            <div className="flex gap-3">
              {(["REDDIT", "YOUTUBE"] as const).map((p) => {
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex-1 px-4 py-3 rounded-brand-sm border-2 text-sm font-bold transition-all ${
                      selected
                        ? "border-teal bg-teal/5 text-teal"
                        : "border-charcoal/[0.1] text-charcoal-light hover:border-charcoal/[0.2]"
                    }`}
                  >
                    {p === "REDDIT" ? "Reddit" : "YouTube"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-2">
              Review Mode
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("MANUAL")}
                className={`flex-1 px-4 py-3 rounded-brand-sm border-2 text-sm font-bold transition-all ${
                  mode === "MANUAL"
                    ? "border-teal bg-teal/5 text-teal"
                    : "border-charcoal/[0.1] text-charcoal-light hover:border-charcoal/[0.2]"
                }`}
              >
                Manual Review
                <span className="block text-xs font-normal mt-0.5 opacity-70">
                  You approve each comment
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("AUTO")}
                className={`flex-1 px-4 py-3 rounded-brand-sm border-2 text-sm font-bold transition-all ${
                  mode === "AUTO"
                    ? "border-teal bg-teal/5 text-teal"
                    : "border-charcoal/[0.1] text-charcoal-light hover:border-charcoal/[0.2]"
                }`}
              >
                Auto Mode
                <span className="block text-xs font-normal mt-0.5 opacity-70">
                  Full autopilot
                </span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createSite.isPending || !url || platforms.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 bg-coral text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createSite.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing your site...
              </>
            ) : (
              "Add Site"
            )}
          </button>
        </form>
      </div>
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
