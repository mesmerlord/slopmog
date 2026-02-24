import { useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import {
  User,
  Mail,
  Bell,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <DashboardLayout>
      <Seo title="Settings -- SlopMog" noIndex />

      <PageHeader
        title="Settings"
        description="Tweak the knobs"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Settings" },
        ]}
      />

      <div className="max-w-2xl space-y-6">
        {/* Account section */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-teal" />
            <h3 className="font-heading font-bold text-charcoal">
              Account
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-semibold text-charcoal-light w-24 shrink-0">
                Name
              </span>
              <div className="flex items-center gap-2">
                <User size={14} className="text-charcoal-light" />
                <span className="text-sm text-charcoal">
                  {session?.user?.name || "Not set"}
                </span>
              </div>
            </div>

            <div className="border-t border-charcoal/[0.04]" />

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-semibold text-charcoal-light w-24 shrink-0">
                Email
              </span>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-charcoal-light" />
                <span className="text-sm text-charcoal">
                  {session?.user?.email || "Not set"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={18} className="text-sunny-dark" />
            <h3 className="font-heading font-bold text-charcoal">
              Notification Preferences
            </h3>
          </div>

          <div className="flex items-center gap-3 py-4 px-4 bg-sunny/10 rounded-brand-sm">
            <Bell size={20} className="text-sunny-dark shrink-0" />
            <div>
              <p className="text-sm font-semibold text-charcoal">
                Coming soon
              </p>
              <p className="text-[0.82rem] text-charcoal-light">
                Email notifications for new opportunities, posted comments, and weekly digests are on the way.
              </p>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-brand shadow-brand-sm border border-coral/20 p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle size={18} className="text-coral" />
            <h3 className="font-heading font-bold text-coral">
              Danger Zone
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-charcoal">
                Delete Account
              </p>
              <p className="text-[0.82rem] text-charcoal-light">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <div className="relative group">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 border-2 border-coral/30 text-coral/40 px-5 py-2 rounded-full font-bold text-sm cursor-not-allowed"
              >
                <Trash2 size={14} />
                Delete Account
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-charcoal text-white text-[0.72rem] font-semibold rounded-brand-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Coming soon
              </div>
            </div>
          </div>
        </div>
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
