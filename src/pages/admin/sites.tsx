import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  MessageSquare,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";

type ActiveFilter = "all" | "active" | "inactive";
type PlatformFilter = "REDDIT" | "YOUTUBE" | undefined;
type SortBy = "newest" | "oldest" | "opportunities" | "comments";

export default function AdminSitesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const sites = trpc.admin.getAllSites.useQuery({
    page,
    search: debouncedSearch || undefined,
    activeFilter,
    platform: platformFilter,
    sortBy,
  });

  return (
    <AdminLayout>
      <Seo title="Sites | Admin | SlopMog" noIndex />
      <PageHeader
        title="Sites"
        description="Every brand being tracked on the platform"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Sites" }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
          <input
            type="text"
            placeholder="Search by name, URL, or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as ActiveFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all ${
                activeFilter === f
                  ? "bg-lavender text-white"
                  : "bg-white border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 hover:text-lavender-dark"
              }`}
            >
              {f}
            </button>
          ))}
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
          <option value="opportunities">Most Opportunities</option>
          <option value="comments">Most Comments</option>
        </select>
      </div>

      {/* Table */}
      {sites.isLoading ? (
        <LoadingState variant="spinner" text="Loading sites..." />
      ) : !sites.data?.items.length ? (
        <EmptyState title="No sites found" description="Try adjusting your filters" />
      ) : (
        <>
          <p className="text-xs text-charcoal-light mb-4">
            {sites.data.total} site{sites.data.total !== 1 ? "s" : ""}
          </p>
          <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/[0.06] bg-charcoal/[0.02]">
                    <th className="text-left px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Site</th>
                    <th className="text-left px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden sm:table-cell">Owner</th>
                    <th className="text-center px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden md:table-cell">Platforms</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1"><Eye size={12} /> Opps</span>
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> Comments</span>
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden lg:table-cell">Runs</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden lg:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.data.items.map((site) => {
                    let hostname = "";
                    try { hostname = new URL(site.url).hostname; } catch { hostname = site.url; }
                    return (
                      <tr key={site.id} className="border-b border-charcoal/[0.04] last:border-0 hover:bg-charcoal/[0.01] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-charcoal truncate max-w-[200px]">{site.name}</p>
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-charcoal-light hover:text-lavender-dark inline-flex items-center gap-1 transition-colors"
                          >
                            {hostname}
                            <ExternalLink size={10} className="opacity-40" />
                          </a>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-xs text-charcoal truncate max-w-[160px]">{site.user.name ?? "—"}</p>
                          <p className="text-[10px] text-charcoal-light truncate max-w-[160px]">{site.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            site.active
                              ? "bg-teal/10 text-teal-dark"
                              : "bg-charcoal/[0.06] text-charcoal-light"
                          }`}>
                            {site.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            {site.platforms.map((p) => (
                              <span key={p} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-charcoal/[0.04] text-charcoal-light">
                                {p === "REDDIT" ? "R" : "YT"}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-charcoal">{site._count.opportunities}</td>
                        <td className="px-4 py-3 text-right font-semibold text-charcoal">{site._count.comments}</td>
                        <td className="px-4 py-3 text-right text-charcoal hidden lg:table-cell">{site._count.discoveryRuns}</td>
                        <td className="px-4 py-3 text-right text-charcoal-light text-xs hidden lg:table-cell">
                          {new Date(site.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {sites.data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-charcoal-light">
                Page {sites.data.page} of {sites.data.totalPages} ({sites.data.total} sites)
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
                  onClick={() => setPage((p) => Math.min(sites.data!.totalPages, p + 1))}
                  disabled={page >= sites.data.totalPages}
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
