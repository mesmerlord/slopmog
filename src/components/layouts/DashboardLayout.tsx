import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Megaphone,
  Inbox,
  MessageSquare,
  CreditCard,
  Settings2,
  Coins,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import LogoBlob from "@/components/LogoBlob";
import { trpc } from "@/utils/trpc";

const routes = {
  dashboard: {
    index: "/dashboard",
    campaigns: {
      index: "/dashboard/campaigns",
      new: "/dashboard/campaigns/new",
      detail: (id: string) => `/dashboard/campaigns/${id}` as const,
    },
    queue: "/dashboard/queue",
    comments: "/dashboard/comments",
    billing: "/dashboard/billing",
    settings: "/dashboard/settings",
  },
} as const;

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Match pathname exactly, or also match sub-paths */
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard.index, icon: LayoutDashboard, exact: true },
  { label: "Campaigns", href: routes.dashboard.campaigns.index, icon: Megaphone },
  { label: "Queue", href: routes.dashboard.queue, icon: Inbox },
  { label: "Comments", href: routes.dashboard.comments, icon: MessageSquare },
  { label: "Billing", href: routes.dashboard.billing, icon: CreditCard },
  { label: "Settings", href: routes.dashboard.settings, icon: Settings2 },
];

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const credits = trpc.user.getCredits.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    router.events.on("routeChangeComplete", closeSidebar);
    return () => {
      router.events.off("routeChangeComplete", closeSidebar);
    };
  }, [router.events, closeSidebar]);

  const isActive = (item: NavItem) => {
    if (item.exact) return router.pathname === item.href;
    return router.pathname === item.href || router.pathname.startsWith(item.href + "/");
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <LogoBlob className="w-12 h-12 animate-pulse" />
          <p className="text-sm font-body text-charcoal-light">Loading...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated, show nothing (useEffect handles redirect)
  if (!session) return null;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <LogoBlob className="w-9 h-9 shrink-0" />
        <span className="font-heading font-bold text-lg text-charcoal">SlopMog</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1 list-none">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-brand-sm px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    active
                      ? "bg-teal/10 text-teal"
                      : "text-charcoal-light hover:bg-charcoal/[0.04] hover:text-charcoal"
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-teal" : "text-charcoal-light"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section: sign out + credits */}
      <div className="mt-auto border-t border-charcoal/[0.08] px-3 py-3 space-y-2">
        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-brand-sm px-3 py-2.5 text-sm font-semibold text-charcoal-light hover:bg-coral/[0.06] hover:text-coral transition-all duration-150"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Sign Out
        </button>

        {/* Credits pill */}
        <div className="flex items-center gap-2 rounded-full bg-sunny/20 px-4 py-2">
          <Coins size={18} className="text-sunny-dark shrink-0" />
          <span className="text-sm font-bold text-charcoal">
            {credits.data !== undefined ? credits.data.amount.toLocaleString() : "--"}
          </span>
          <span className="text-xs text-charcoal-light">credits</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg font-body">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-charcoal/[0.08] bg-white fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/30 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-white shadow-brand-lg transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button inside drawer */}
        <button
          onClick={closeSidebar}
          className="absolute top-4 right-3 p-1.5 rounded-brand-sm text-charcoal-light hover:bg-charcoal/[0.06] transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-[240px] min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-charcoal/[0.08] bg-white/80 backdrop-blur-md px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-brand-sm text-charcoal hover:bg-charcoal/[0.06] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <LogoBlob className="w-7 h-7 shrink-0" />
          <span className="font-heading font-bold text-base text-charcoal">SlopMog</span>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          {(title || description) && (
            <div className="border-b border-charcoal/[0.06] bg-white px-6 py-5 lg:px-8">
              {title && (
                <h1 className="font-heading font-bold text-xl lg:text-2xl text-charcoal">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-1 text-sm text-charcoal-light">{description}</p>
              )}
            </div>
          )}
          <div className="px-6 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
