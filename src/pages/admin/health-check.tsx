import { useState } from "react";
import type { GetServerSideProps } from "next";
import {
  HeartPulse,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Play,
  FlaskConical,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";
import { toast } from "sonner";

type FilterType = "all" | "healthy" | "deleted" | "unchecked";
type PipelineType = "regular" | "hv" | "both";

const filterOptions: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "deleted", label: "Deleted" },
  { value: "unchecked", label: "Unchecked" },
];

const pipelineOptions: Array<{ value: PipelineType; label: string }> = [
  { value: "both", label: "Both" },
  { value: "regular", label: "Regular" },
  { value: "hv", label: "HV" },
];

function StatusBadge({ status }: { status: "visible" | "deleted" | "uncertain" }) {
  if (status === "visible") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal-dark">
        <CheckCircle2 size={12} /> Visible
      </span>
    );
  }
  if (status === "deleted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-xs font-semibold text-coral-dark">
        <XCircle size={12} /> Deleted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunny/20 px-2 py-0.5 text-xs font-semibold text-sunny-dark">
      <HelpCircle size={12} /> Uncertain
    </span>
  );
}

function OpportunityHealthBadge({
  healthCheck,
}: {
  healthCheck: { visibleCount: number; deletedCount: number; uncertainCount: number; error: string | null } | null;
}) {
  if (!healthCheck) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-charcoal/[0.06] px-2 py-0.5 text-xs font-semibold text-charcoal-light">
        <HelpCircle size={12} /> Unchecked
      </span>
    );
  }
  if (healthCheck.error) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sunny/20 px-2 py-0.5 text-xs font-semibold text-sunny-dark">
        <AlertTriangle size={12} /> Error
      </span>
    );
  }
  if (healthCheck.deletedCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-xs font-semibold text-coral-dark">
        <XCircle size={12} /> {healthCheck.deletedCount} deleted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal-dark">
      <CheckCircle2 size={12} /> All visible
    </span>
  );
}

export default function AdminHealthCheckPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [pipeline, setPipeline] = useState<PipelineType>("both");

  const utils = trpc.useUtils();

  const results = trpc.admin.getHealthCheckResults.useQuery(
    { page, limit: 20, filter, pipeline },
    { placeholderData: (previousData) => previousData },
  );

  const triggerMutation = trpc.admin.triggerHealthCheck.useMutation({
    onSuccess: (data) => {
      toast.success(`Health check queued (job: ${data.jobId})`);
      utils.admin.getHealthCheckResults.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.admin.testHealthCheck.useMutation({
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Test queued for opportunity ${data.opportunityId?.slice(0, 8)}...`);
      }
      utils.admin.getHealthCheckResults.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const summary = results.data?.summary;

  return (
    <AdminLayout>
      <Seo title="Health Check | Admin | SlopMog" noIndex />
      <PageHeader
        title="Comment Health Check"
        description="Are our comments still alive out there?"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Health Check" },
        ]}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => triggerMutation.mutate({ pipeline })}
          disabled={triggerMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-white shadow-brand-sm hover:shadow-brand-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {triggerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run Health Check
        </button>
        <button
          onClick={() => testMutation.mutate({ pipeline: pipeline === "both" ? "regular" : pipeline as "regular" | "hv" })}
          disabled={testMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full border-2 border-teal px-5 py-2.5 text-sm font-bold text-teal hover:bg-teal/[0.06] transition-all disabled:opacity-50"
        >
          {testMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
          Test One Comment
        </button>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <StatsCard icon={HeartPulse} value={summary.totalOpportunities} label="Total Opps" />
          <StatsCard icon={CheckCircle2} value={summary.totalChecked} label="Checked" />
          <StatsCard icon={CheckCircle2} value={summary.totalVisible} label="Visible" />
          <StatsCard icon={XCircle} value={summary.totalDeleted} label="Deleted" />
          <StatsCard icon={AlertTriangle} value={summary.totalUncertain} label="Uncertain" />
          <StatsCard icon={HelpCircle} value={summary.totalUnchecked} label="Unchecked" />
        </div>
      )}

      {summary?.lastRunAt && (
        <p className="text-xs text-charcoal-light mb-4">
          Last run: {new Date(summary.lastRunAt).toLocaleString()}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-full bg-charcoal/[0.04] p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                filter === opt.value
                  ? "bg-white text-charcoal shadow-sm"
                  : "text-charcoal-light hover:text-charcoal"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-full bg-charcoal/[0.04] p-1">
          {pipelineOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setPipeline(opt.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                pipeline === opt.value
                  ? "bg-white text-charcoal shadow-sm"
                  : "text-charcoal-light hover:text-charcoal"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      {results.isLoading ? (
        <LoadingState variant="spinner" text="Loading health check results..." />
      ) : !results.data || results.data.items.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No results yet"
          description="Run a health check to see which comments are still visible"
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-brand border border-charcoal/[0.08] bg-white shadow-brand-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/[0.06] text-left">
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Opportunity</th>
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Site</th>
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Pipeline</th>
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Comments</th>
                  <th className="px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Last Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/[0.04]">
                {results.data.items.map((item) => (
                  <tr key={`${item.pipeline}-${item.id}`} className="hover:bg-charcoal/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[300px]">
                        <span className="truncate font-medium text-charcoal" title={item.title}>
                          {item.title}
                        </span>
                        <a
                          href={item.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-charcoal-light hover:text-teal transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <span className="text-xs text-charcoal-light">{item.platform}</span>
                    </td>
                    <td className="px-4 py-3 text-charcoal-light">{item.siteName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                        item.pipeline === "hv"
                          ? "bg-lavender/15 text-lavender-dark"
                          : "bg-charcoal/[0.06] text-charcoal-light"
                      }`}>
                        {item.pipeline === "hv" ? "HV" : "Regular"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OpportunityHealthBadge healthCheck={item.healthCheck} />
                    </td>
                    <td className="px-4 py-3">
                      {item.healthCheck ? (
                        <div className="flex flex-col gap-0.5">
                          {item.healthCheck.comments.map((c) => (
                            <div key={c.commentId} className="flex items-center gap-2">
                              <StatusBadge status={c.status} />
                              <span className="text-xs text-charcoal-light">
                                {Math.round(c.similarity * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-charcoal-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-charcoal-light">
                      {item.healthCheck?.lastCheckedAt
                        ? new Date(item.healthCheck.lastCheckedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-charcoal-light">
                Page {results.data.page} of {results.data.totalPages} ({results.data.total} results)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-full border border-charcoal/[0.12] px-3 py-1.5 text-xs font-bold text-charcoal-light hover:bg-charcoal/[0.04] disabled:opacity-40 transition-all"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(results.data?.totalPages ?? 1, p + 1))}
                  disabled={page >= (results.data?.totalPages ?? 1)}
                  className="rounded-full border border-charcoal/[0.12] px-3 py-1.5 text-xs font-bold text-charcoal-light hover:bg-charcoal/[0.04] disabled:opacity-40 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
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

  if (session.user.role !== "ADMIN") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
};
