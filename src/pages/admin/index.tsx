import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  Users,
  Globe,
  MessageSquare,
  BarChart3,
  Search,
  Coins,
  Clock,
  Shield,
  ArrowRight,
} from "lucide-react";
import Seo from "@/components/Seo";
import AdminLayout from "@/components/layouts/AdminLayout";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { getServerAuthSession } from "@/server/utils/auth";

const navCards = [
  {
    label: "Users",
    description: "Manage accounts, plans, and credits",
    href: "/admin/users",
    icon: Users,
    color: "bg-teal/10 text-teal",
  },
  {
    label: "Sites",
    description: "All tracked brands across the platform",
    href: "/admin/sites",
    icon: Globe,
    color: "bg-sunny/15 text-sunny-dark",
  },
  {
    label: "Comments",
    description: "Review all generated comments",
    href: "/admin/comments",
    icon: MessageSquare,
    color: "bg-coral/10 text-coral",
  },
  {
    label: "Analytics",
    description: "Pipeline stats & growth metrics",
    href: "/admin/analytics",
    icon: BarChart3,
    color: "bg-lavender/15 text-lavender-dark",
  },
];

export default function AdminHubPage() {
  const stats = trpc.admin.getOverviewStats.useQuery();

  return (
    <AdminLayout>
      <Seo title="Admin Hub | SlopMog" noIndex />
      <PageHeader
        title="Command Center"
        description="The nerve center of the slop empire"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Hub" }]}
      />

      {stats.isLoading ? (
        <LoadingState variant="spinner" text="Loading stats..." />
      ) : stats.data ? (
        <>
          {/* Stats row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatsCard icon={Users} value={stats.data.totalUsers} label="Total Users" />
            <StatsCard icon={Globe} value={stats.data.activeSites} label="Active Sites" />
            <StatsCard icon={MessageSquare} value={stats.data.commentsToday} label="Comments Today" />
            <StatsCard icon={Search} value={stats.data.discoveryRuns} label="Discovery Runs" />
          </div>

          {/* Stats row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard icon={Shield} value={stats.data.paidUsers} label="Paid Users" />
            <StatsCard icon={Users} value={stats.data.freeUsers} label="Free Users" />
            <StatsCard icon={Clock} value={stats.data.pendingReview} label="Pending Review" />
            <StatsCard icon={Coins} value={stats.data.creditsInCirculation.toLocaleString()} label="Credits in Circulation" />
          </div>

          {/* Navigation cards */}
          <h2 className="text-xs font-bold text-charcoal-light uppercase tracking-wider mb-4">
            Quick Access
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {navCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-center gap-4 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 hover:shadow-brand-md hover:-translate-y-0.5 transition-all"
                >
                  <div className={`flex items-center justify-center w-11 h-11 rounded-full ${card.color}`}>
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal group-hover:text-lavender-dark transition-colors">
                      {card.label}
                    </p>
                    <p className="text-xs text-charcoal-light">{card.description}</p>
                  </div>
                  <ArrowRight size={14} className="text-charcoal-light/40 group-hover:text-lavender-dark transition-colors" />
                </Link>
              );
            })}
          </div>
        </>
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
