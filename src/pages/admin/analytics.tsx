import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import {
  Users,
  Shield,
  MessageSquare,
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";

type TimeRange = "7d" | "30d" | "90d" | "all";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-sunny",
  APPROVED: "bg-teal/70",
  POSTED: "bg-teal",
  FAILED: "bg-coral",
  SKIPPED: "bg-charcoal/30",
};

const CREDIT_REASONS = [
  { label: "All", value: undefined },
  { label: "Purchase", value: "PURCHASE" as const },
  { label: "Sub Create", value: "SUBSCRIPTION_CREATE" as const },
  { label: "Sub Renewal", value: "SUBSCRIPTION_RENEWAL" as const },
  { label: "Sub Update", value: "SUBSCRIPTION_UPDATE" as const },
  { label: "Campaign", value: "CAMPAIGN_USAGE" as const },
  { label: "Signup Bonus", value: "REGISTRATION_BONUS" as const },
  { label: "Promo", value: "PROMOTION" as const },
  { label: "Other", value: "OTHER" as const },
];

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [creditPage, setCreditPage] = useState(1);
  const [creditSearch, setCreditSearch] = useState("");
  const [debouncedCreditSearch, setDebouncedCreditSearch] = useState("");
  const [creditReason, setCreditReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCreditSearch(creditSearch);
      setCreditPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [creditSearch]);

  const analytics = trpc.admin.getAnalytics.useQuery({ timeRange });
  const creditHistory = trpc.admin.getCreditHistory.useQuery({
    page: creditPage,
    search: debouncedCreditSearch || undefined,
    reason: (creditReason ?? undefined) as
      | "PURCHASE"
      | "SUBSCRIPTION_CREATE"
      | "SUBSCRIPTION_RENEWAL"
      | "SUBSCRIPTION_UPDATE"
      | "CAMPAIGN_USAGE"
      | "REGISTRATION_BONUS"
      | "PROMOTION"
      | "OTHER"
      | undefined,
  });

  return (
    <AdminLayout>
      <Seo title="Analytics | Admin | SlopMog" noIndex />
      <PageHeader
        title="Analytics"
        description="Numbers that make the slop look legit"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Analytics" }]}
      />

      {/* Time range toggle */}
      <div className="flex gap-2 mb-6">
        {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              timeRange === range
                ? "bg-lavender text-white"
                : "bg-white border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 hover:text-lavender-dark"
            }`}
          >
            {range === "all" ? "All Time" : range}
          </button>
        ))}
      </div>

      {analytics.isLoading ? (
        <LoadingState variant="spinner" text="Crunching numbers..." />
      ) : analytics.data ? (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard icon={Users} value={analytics.data.totalUsers} label="Total Users" />
            <StatsCard icon={Shield} value={analytics.data.paidUsers} label="Paid Users" />
            <StatsCard icon={MessageSquare} value={analytics.data.commentsPosted} label="Comments Posted" />
            <StatsCard icon={Star} value={analytics.data.avgQualityScore} label="Avg Quality Score" />
          </div>

          {/* Discovery Pipeline */}
          <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 mb-6">
            <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
              Discovery Pipeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold font-heading text-charcoal">{analytics.data.discovery.totalRuns}</p>
                <p className="text-xs text-charcoal-light">Total Runs</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-teal">{analytics.data.discovery.successRate}%</p>
                <p className="text-xs text-charcoal-light">Success Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-charcoal">{analytics.data.discovery.completedRuns}</p>
                <p className="text-xs text-charcoal-light">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-charcoal">{analytics.data.discovery.avgPosted}</p>
                <p className="text-xs text-charcoal-light">Avg Posted/Run</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-charcoal-light border-t border-charcoal/[0.06] pt-3">
              <span>Avg Found: <span className="font-bold text-charcoal">{analytics.data.discovery.avgFound}</span></span>
              <span>Avg Scored: <span className="font-bold text-charcoal">{analytics.data.discovery.avgScored}</span></span>
              <span>Avg Generated: <span className="font-bold text-charcoal">{analytics.data.discovery.avgGenerated}</span></span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Comment Status Distribution */}
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
              <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
                Comment Status Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.data.commentStatus).map(([status, count]) => {
                  const total = Object.values(analytics.data!.commentStatus).reduce(
                    (a, b) => a + (b as number),
                    0,
                  );
                  const pct = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-charcoal">{status}</span>
                        <span className="text-xs text-charcoal-light">
                          {count as number} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-charcoal/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_COLORS[status] ?? "bg-charcoal/20"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
              <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
                Platform Breakdown
              </h3>
              <div className="space-y-4">
                {(["reddit", "youtube"] as const).map((platform) => {
                  const data = analytics.data!.platformBreakdown[platform];
                  return (
                    <div key={platform} className="flex items-center gap-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        platform === "reddit" ? "bg-[#FF4500]/10 text-[#FF4500]" : "bg-[#FF0000]/10 text-[#FF0000]"
                      }`}>
                        {platform.toUpperCase()}
                      </span>
                      <div className="flex-1 text-sm text-charcoal">
                        <span className="font-bold">{data.opportunities}</span>{" "}
                        <span className="text-charcoal-light">opportunities</span>
                        <span className="mx-2 text-charcoal-light">&middot;</span>
                        <span className="font-bold">{data.comments}</span>{" "}
                        <span className="text-charcoal-light">comments</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Plan Distribution */}
              <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mt-6 mb-4">
                Plan Distribution
              </h3>
              <div className="space-y-3">
                {analytics.data.planDistribution.map((plan) => {
                  const total = analytics.data!.totalUsers;
                  const pct = total > 0 ? Math.round((plan.count / total) * 100) : 0;
                  return (
                    <div key={plan.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-charcoal">{plan.name}</span>
                        <span className="text-xs text-charcoal-light">
                          {plan.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-charcoal/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-lavender transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Credit History */}
          <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5">
            <h3 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
              Credit History
            </h3>

            {/* Credit history filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
                <input
                  type="text"
                  placeholder="Search by user name or email..."
                  value={creditSearch}
                  onChange={(e) => setCreditSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:ring-2 focus:ring-lavender/30 transition-all"
                />
              </div>
              <select
                value={creditReason ?? ""}
                onChange={(e) => { setCreditReason(e.target.value || undefined); setCreditPage(1); }}
                className="px-4 py-2 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal focus:outline-none focus:ring-2 focus:ring-lavender/30"
              >
                {CREDIT_REASONS.map((r) => (
                  <option key={r.label} value={r.value ?? ""}>{r.label}</option>
                ))}
              </select>
            </div>

            {creditHistory.isLoading ? (
              <LoadingState variant="skeleton" />
            ) : !creditHistory.data?.items.length ? (
              <p className="text-sm text-charcoal-light py-4 text-center">No credit history found</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-charcoal/[0.06]">
                        <th className="text-left px-3 py-2 text-xs font-bold text-charcoal-light uppercase tracking-wider">User</th>
                        <th className="text-right px-3 py-2 text-xs font-bold text-charcoal-light uppercase tracking-wider">Credits</th>
                        <th className="text-left px-3 py-2 text-xs font-bold text-charcoal-light uppercase tracking-wider hidden sm:table-cell">Reason</th>
                        <th className="text-right px-3 py-2 text-xs font-bold text-charcoal-light uppercase tracking-wider hidden sm:table-cell">Balance</th>
                        <th className="text-right px-3 py-2 text-xs font-bold text-charcoal-light uppercase tracking-wider hidden md:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditHistory.data.items.map((entry) => (
                        <tr key={entry.id} className="border-b border-charcoal/[0.04] last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-charcoal text-xs truncate max-w-[140px]">{entry.user?.name ?? "Deleted"}</p>
                            <p className="text-[10px] text-charcoal-light truncate max-w-[140px]">{entry.user?.email ?? "—"}</p>
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${entry.credits > 0 ? "text-teal-dark" : "text-coral-dark"}`}>
                            {entry.credits > 0 ? "+" : ""}{entry.credits}
                          </td>
                          <td className="px-3 py-2 text-xs text-charcoal-light hidden sm:table-cell">
                            {entry.reason.replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-charcoal hidden sm:table-cell">
                            {entry.previousCredits} &rarr; {entry.newCredits}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-charcoal-light hidden md:table-cell">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {creditHistory.data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-charcoal/[0.06]">
                    <p className="text-xs text-charcoal-light">
                      Page {creditHistory.data.page} of {creditHistory.data.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCreditPage((p) => Math.max(1, p - 1))}
                        disabled={creditPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>
                      <button
                        onClick={() => setCreditPage((p) => Math.min(creditHistory.data!.totalPages, p + 1))}
                        disabled={creditPage >= creditHistory.data.totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : analytics.isError ? (
        <div className="bg-coral/[0.06] border border-coral/20 rounded-brand p-6 text-center">
          <p className="text-sm font-bold text-coral">Failed to load analytics</p>
          <button onClick={() => analytics.refetch()} className="mt-3 inline-flex h-8 items-center rounded-full border border-coral/30 px-4 text-xs font-bold text-coral hover:bg-coral/5 transition-all">
            Retry
          </button>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerAuthSession(ctx);

  if (!session) {
    return {
      redirect: { destination: `/auth/login?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false },
    };
  }

  if (session.user.role !== "ADMIN") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
};
