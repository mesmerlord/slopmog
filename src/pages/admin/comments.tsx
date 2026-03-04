import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";

type StatusFilter = "DRAFT" | "APPROVED" | "POSTED" | "FAILED" | "SKIPPED" | undefined;
type PlatformFilter = "REDDIT" | "YOUTUBE" | undefined;
type SortBy = "newest" | "oldest" | "quality_high" | "quality_low";

const statusOptions = [
  { label: "All", value: undefined },
  { label: "Draft", value: "DRAFT" as const },
  { label: "Approved", value: "APPROVED" as const },
  { label: "Posted", value: "POSTED" as const },
  { label: "Failed", value: "FAILED" as const },
  { label: "Skipped", value: "SKIPPED" as const },
];

const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-sunny/20 text-sunny-dark",
  APPROVED: "bg-teal/10 text-teal-dark",
  POSTED: "bg-teal/15 text-teal-dark",
  FAILED: "bg-coral/10 text-coral-dark",
  SKIPPED: "bg-charcoal/[0.06] text-charcoal-light",
};

const platformBadgeClass: Record<string, string> = {
  REDDIT: "bg-[#FF4500]/10 text-[#FF4500]",
  YOUTUBE: "bg-[#FF0000]/10 text-[#FF0000]",
};

function qualityColor(score: number): string {
  if (score >= 7) return "text-teal-dark bg-teal/10";
  if (score >= 4) return "text-sunny-dark bg-sunny/20";
  return "text-coral-dark bg-coral/10";
}

export default function AdminCommentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const comments = trpc.admin.getAllComments.useQuery({
    page,
    search: debouncedSearch || undefined,
    status: statusFilter,
    platform: platformFilter,
    sortBy,
  });

  return (
    <AdminLayout>
      <Seo title="Comments | Admin | SlopMog" noIndex />
      <PageHeader
        title="Comments"
        description="Every comment across the entire platform"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Comments" }]}
      />

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
            <input
              type="text"
              placeholder="Search comments, titles, sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(["REDDIT", "YOUTUBE"] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPlatformFilter(platformFilter === p ? undefined : p); setPage(1); }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  platformFilter === p
                    ? "bg-lavender text-white"
                    : "bg-white border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1); }}
            className="px-4 py-2.5 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal focus:outline-none focus:ring-2 focus:ring-lavender/30"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="quality_high">Quality (High)</option>
            <option value="quality_low">Quality (Low)</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                statusFilter === opt.value
                  ? "bg-lavender text-white"
                  : "bg-white border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comment cards */}
      {comments.isLoading ? (
        <LoadingState variant="spinner" text="Loading comments..." />
      ) : !comments.data?.items.length ? (
        <EmptyState title="No comments found" description="Try adjusting your filters" />
      ) : (
        <>
          <p className="text-xs text-charcoal-light mb-4">
            {comments.data.total} comment{comments.data.total !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {comments.data.items.map((comment) => (
              <div
                key={comment.id}
                className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-4 hover:shadow-brand-md transition-shadow"
              >
                {/* Top row: badges */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${platformBadgeClass[comment.opportunity.platform] ?? ""}`}>
                    {comment.opportunity.platform}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass[comment.status] ?? ""}`}>
                    {comment.status}
                  </span>
                  <span className="text-[10px] text-charcoal-light">
                    {comment.opportunity.sourceContext}
                  </span>
                  <span className="ml-auto text-[10px] text-charcoal-light">
                    {comment.site.name} &middot; {comment.site.user.email}
                  </span>
                </div>

                {/* Title */}
                <a
                  href={comment.opportunity.contentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-charcoal hover:text-lavender-dark transition-colors inline-flex items-center gap-1 mb-2"
                >
                  {comment.opportunity.title}
                  <ExternalLink size={11} className="shrink-0 opacity-40" />
                </a>

                {/* Comment text */}
                <div className="bg-charcoal/[0.02] rounded-brand-sm px-3 py-2 mb-2">
                  <p className="text-sm text-charcoal line-clamp-3">{comment.text}</p>
                </div>

                {/* Bottom row: quality, persona, date */}
                <div className="flex items-center gap-3 text-xs">
                  <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${qualityColor(comment.qualityScore)}`}>
                    {comment.qualityScore.toFixed(1)}
                  </span>
                  <span className="text-charcoal-light">
                    {comment.persona}
                  </span>
                  <span className="ml-auto text-charcoal-light">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {comments.data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-charcoal-light">
                Page {comments.data.page} of {comments.data.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(comments.data!.totalPages, p + 1))}
                  disabled={page >= comments.data.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight size={14} />
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
      redirect: { destination: `/auth/login?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false },
    };
  }

  if (session.user.role !== "ADMIN") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
};
