import type { GetServerSideProps } from "next";
import {
  XCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";
import { toast } from "sonner";

const statusBadge: Record<string, { class: string; icon: typeof CheckCircle2 }> = {
  COMPLETED: { class: "bg-teal/15 text-teal-dark", icon: CheckCircle2 },
  FAILED: { class: "bg-coral/10 text-coral-dark", icon: AlertTriangle },
  CANCELLED: { class: "bg-sunny/20 text-sunny-dark", icon: Ban },
};

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function duration(start: Date, end: Date | null): string {
  if (!end) return "—";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function AdminQueuePage() {
  const utils = trpc.useUtils();
  const queue = trpc.admin.getQueueStatus.useQuery(undefined, {
    refetchInterval: (query) => ((query.state.data?.counts.running ?? 0) > 0 ? 5000 : false),
  });

  const cancelRun = trpc.admin.cancelDiscoveryRun.useMutation({
    onSuccess: () => {
      toast.success("Run cancelled");
      utils.admin.getQueueStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelAll = trpc.admin.cancelAllForSite.useMutation({
    onSuccess: () => {
      toast.success("All runs cancelled for site");
      utils.admin.getQueueStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AdminLayout>
      <Seo title="Queue | Admin | SlopMog" noIndex />
      <PageHeader
        title="Queue"
        description="Running & recent discovery jobs"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Queue" }]}
      />

      {queue.isLoading ? (
        <LoadingState variant="spinner" text="Loading queue..." />
      ) : queue.data ? (
        <>
          {/* Summary counters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-semibold text-teal-dark">
              <Loader2 size={14} className={queue.data.counts.running > 0 ? "animate-spin" : ""} />
              {queue.data.counts.running} running
            </div>
            <div className="flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-semibold text-teal-dark">
              <CheckCircle2 size={14} />
              {queue.data.counts.completedToday} completed today
            </div>
            <div className="flex items-center gap-2 rounded-full bg-coral/10 px-4 py-1.5 text-sm font-semibold text-coral-dark">
              <AlertTriangle size={14} />
              {queue.data.counts.failedToday} failed today
            </div>
          </div>

          {/* Running Jobs */}
          <h2 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-3">
            Running Jobs
          </h2>

          {queue.data.running.length === 0 ? (
            <div className="mb-8">
              <EmptyState
                title="No running jobs"
                description="All quiet on the discovery front"
                icon={Clock}
              />
            </div>
          ) : (
            <div className="grid gap-3 mb-8">
              {/* Cancel all button when multiple runs */}
              {queue.data.running.length > 1 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      // Cancel all unique sites sequentially via mutateAsync
                      const seen = new Set<string>();
                      const uniqueSiteIds: string[] = [];
                      queue.data!.running.forEach((r) => {
                        if (!seen.has(r.siteId)) {
                          seen.add(r.siteId);
                          uniqueSiteIds.push(r.siteId);
                        }
                      });
                      // Fire for the first site; the onSuccess invalidation will refresh
                      if (uniqueSiteIds[0]) {
                        cancelAll.mutate({ siteId: uniqueSiteIds[0], type: "both" });
                      }
                    }}
                    disabled={cancelAll.isPending}
                    className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white hover:bg-coral-dark transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Cancel All ({queue.data.running.length})
                  </button>
                </div>
              )}

              {queue.data.running.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-4 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal/10">
                    <Loader2 size={18} className="text-teal animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-charcoal truncate">
                        {run.siteName}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                        run.type === "hv"
                          ? "bg-lavender/15 text-lavender-dark"
                          : "bg-teal/10 text-teal-dark"
                      }`}>
                        {run.type === "hv" ? "HV" : run.platform}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-light">
                      {run.userEmail} &middot; started {relativeTime(run.startedAt)}
                      {run.foundCount > 0 && ` · ${run.foundCount} found`}
                      {run.scoredCount > 0 && ` · ${run.scoredCount} scored`}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelRun.mutate({ runId: run.id, type: run.type })}
                    disabled={cancelRun.isPending}
                    className="flex items-center gap-1.5 shrink-0 rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-dark transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent Runs */}
          <h2 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-3">
            Recent Runs
          </h2>

          {queue.data.recent.length === 0 ? (
            <EmptyState
              title="No recent runs"
              description="Discovery hasn't run yet"
              icon={Clock}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/[0.08]">
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Site</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">User</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Duration</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Found</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">Generated</th>
                    <th className="text-left py-2.5 px-3 text-xs font-bold text-charcoal-light uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.recent.map((run) => {
                    const badge = statusBadge[run.status] ?? statusBadge.FAILED;
                    const Icon = badge.icon;
                    return (
                      <tr key={run.id} className="border-b border-charcoal/[0.04] hover:bg-charcoal/[0.02]">
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${badge.class}`}>
                            <Icon size={12} />
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-charcoal">{run.siteName}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                            run.type === "hv"
                              ? "bg-lavender/15 text-lavender-dark"
                              : "bg-teal/10 text-teal-dark"
                          }`}>
                            {run.type === "hv" ? "HV" : run.platform}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-charcoal-light">{run.userEmail}</td>
                        <td className="py-2.5 px-3 text-charcoal-light font-mono text-xs">
                          {duration(run.startedAt, run.completedAt)}
                        </td>
                        <td className="py-2.5 px-3 text-charcoal">{run.foundCount}</td>
                        <td className="py-2.5 px-3 text-charcoal">{run.generatedCount}</td>
                        <td className="py-2.5 px-3 text-charcoal-light text-xs">{relativeTime(run.startedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : queue.isError ? (
        <div className="bg-coral/[0.06] border border-coral/20 rounded-brand p-6 text-center">
          <p className="text-sm font-bold text-coral">Failed to load queue</p>
          <p className="text-xs text-charcoal-light mt-1">{queue.error?.message ?? "Unknown error"}</p>
          <button onClick={() => queue.refetch()} className="mt-3 inline-flex h-8 items-center rounded-full border border-coral/30 px-4 text-xs font-bold text-coral hover:bg-coral/5 transition-all">
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
