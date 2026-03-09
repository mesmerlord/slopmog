import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Globe,
  MessageSquare,
  BarChart3,
  ListOrdered,
  HeartPulse,
  Shield,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import LogoBlob from "@/components/LogoBlob";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: "Hub", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Sites", href: "/admin/sites", icon: Globe },
  { label: "Comments", href: "/admin/comments", icon: MessageSquare },
  { label: "Queue", href: "/admin/queue", icon: ListOrdered },
  { label: "Health", href: "/admin/health-check", icon: HeartPulse },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

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

  if (!session || session.user.role !== "ADMIN") return null;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo + Admin badge */}
      <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5 hover:opacity-80 transition-opacity">
        <LogoBlob className="w-9 h-9 shrink-0" />
        <span className="font-heading font-bold text-lg text-charcoal">SlopMog</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-lavender/15 px-2.5 py-0.5 text-xs font-bold text-lavender-dark">
          <Shield size={12} />
          Admin
        </span>
      </Link>

      {/* Back to dashboard */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 mx-3 mb-2 px-3 py-2 rounded-brand-sm text-sm font-semibold text-charcoal-light hover:bg-charcoal/[0.04] hover:text-charcoal transition-all"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        Back to Dashboard
      </Link>

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
                      ? "bg-lavender/10 text-lavender-dark"
                      : "text-charcoal-light hover:bg-charcoal/[0.04] hover:text-charcoal"
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-lavender-dark" : "text-charcoal-light"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom: sign out */}
      <div className="mt-auto border-t border-charcoal/[0.08] px-3 py-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-brand-sm px-3 py-2.5 text-sm font-semibold text-charcoal-light hover:bg-coral/[0.06] hover:text-coral transition-all duration-150"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Sign Out
        </button>
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
          <span className="font-heading font-bold text-base text-charcoal">Admin</span>
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
