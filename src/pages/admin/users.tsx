import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { Search, ChevronLeft, ChevronRight, Ban } from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";
import { toast } from "sonner";

type PlanFilter = "all" | "free" | "paid";
type SortBy = "newest" | "oldest" | "credits" | "sites" | "comments";

const planBadgeClass: Record<string, string> = {
  FREE: "bg-charcoal/[0.06] text-charcoal-light",
  Starter: "bg-teal/10 text-teal-dark",
  Growth: "bg-teal/15 text-teal-dark",
  Pro: "bg-lavender/15 text-lavender-dark",
  ADMIN: "bg-coral/10 text-coral-dark",
};

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [planType, setPlanType] = useState<PlanFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [banTarget, setBanTarget] = useState<{ id: string; email: string | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const users = trpc.admin.getAllUsers.useQuery({
    page,
    search: debouncedSearch || undefined,
    planType,
    sortBy,
  });

  const utils = trpc.useUtils();
  const banMutation = trpc.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned successfully");
      utils.admin.getAllUsers.invalidate();
      utils.admin.getOverviewStats.invalidate();
    },
    onError: () => toast.error("Failed to ban user"),
  });

  return (
    <AdminLayout>
      <Seo title="Users | Admin | SlopMog" noIndex />
      <PageHeader
        title="Users"
        description="Everyone who signed up for the slop"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-light" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm font-body text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:border-lavender transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "free", "paid"] as PlanFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setPlanType(f); setPage(1); }}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all ${
                planType === f
                  ? "bg-lavender text-white"
                  : "bg-white border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 hover:text-lavender-dark"
              }`}
            >
              {f}
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
          <option value="credits">Most Credits</option>
          <option value="sites">Most Sites</option>
        </select>
      </div>

      {/* Table */}
      {users.isLoading ? (
        <LoadingState variant="spinner" text="Loading users..." />
      ) : !users.data?.items.length ? (
        <EmptyState title="No users found" description="Try adjusting your filters" />
      ) : (
        <>
          <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/[0.06] bg-charcoal/[0.02]">
                    <th className="text-left px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Credits</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden sm:table-cell">Sites</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden md:table-cell">Posted</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider hidden lg:table-cell">Joined</th>
                    <th className="text-right px-4 py-3 font-bold text-charcoal-light text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id} className="border-b border-charcoal/[0.04] last:border-0 hover:bg-charcoal/[0.01] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-charcoal truncate max-w-[180px]">{user.name || "—"}</p>
                        <p className="text-xs text-charcoal-light truncate max-w-[180px]">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${planBadgeClass[user.planName] ?? planBadgeClass.FREE}`}>
                          {user.planName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-charcoal">{user.credits}</td>
                      <td className="px-4 py-3 text-right text-charcoal hidden sm:table-cell">{user.siteCount}</td>
                      <td className="px-4 py-3 text-right text-charcoal hidden md:table-cell">{user.postedComments}</td>
                      <td className="px-4 py-3 text-right text-charcoal-light text-xs hidden lg:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.role !== "ADMIN" && (
                          <button
                            onClick={() => setBanTarget({ id: user.id, email: user.email })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-coral border border-coral/20 hover:bg-coral/[0.06] transition-all"
                            title="Ban user"
                          >
                            <Ban size={12} />
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {users.data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-charcoal-light">
                Page {users.data.page} of {users.data.totalPages} ({users.data.total} users)
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
                  onClick={() => setPage((p) => Math.min(users.data!.totalPages, p + 1))}
                  disabled={page >= users.data.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-charcoal/[0.12] text-charcoal-light hover:border-lavender/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!banTarget}
        onOpenChange={(open) => { if (!open) setBanTarget(null); }}
        title="Ban User"
        description={`This will deactivate all sites and zero credits for ${banTarget?.email ?? "this user"}. This cannot be undone.`}
        confirmLabel="Ban User"
        variant="danger"
        onConfirm={() => {
          if (banTarget) banMutation.mutate({ userId: banTarget.id });
        }}
      />
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
