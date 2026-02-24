import { useCallback } from "react";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
import {
  CreditCard,
  Coins,
  Crown,
  Calendar,
  ArrowRight,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { CREDIT_PRICES } from "@/constants/pricing";
import { getServerAuthSession } from "@/server/utils/auth";

const creditPacks = Object.entries(CREDIT_PRICES).map(([credits, info]) => ({
  credits: Number(credits),
  price: info.price,
}));

export default function BillingPage() {
  const subscriptionQuery = trpc.user.getSubscriptionStatus.useQuery();
  const creditsQuery = trpc.user.getCredits.useQuery();

  const createOneTimeSession = trpc.user.createOneTimeSession.useMutation({
    onError: (err) => {
      toast.error(err.message || "Failed to start checkout.");
    },
  });

  const createBillingPortal = trpc.user.createBillingPortalSession.useMutation({
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal.");
    },
  });

  const handleBuyCredits = useCallback(
    (credits: number) => {
      createOneTimeSession.mutate(
        { credits: String(credits) },
        {
          onSuccess: (data) => {
            window.location.href = data.url;
          },
        }
      );
    },
    [createOneTimeSession]
  );

  const handleManageSubscription = useCallback(() => {
    createBillingPortal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  }, [createBillingPortal]);

  const sub = subscriptionQuery.data;
  const credits = creditsQuery.data?.amount ?? 0;
  const isLoading = subscriptionQuery.isLoading || creditsQuery.isLoading;

  return (
    <DashboardLayout>
      <Seo title="Billing -- SlopMog" noIndex />

      <PageHeader
        title="Billing"
        description="Credits, plans, and all that money stuff"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Billing" },
        ]}
      />

      {isLoading ? (
        <LoadingState variant="spinner" text="Loading your billing info..." />
      ) : (
        <div className="space-y-8">
          {/* Current plan + credit balance row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current plan card */}
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Crown size={18} className="text-sunny-dark" />
                <h3 className="font-heading font-bold text-charcoal">
                  Current Plan
                </h3>
              </div>

              {sub?.subscription?.isPaid ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-heading font-bold text-charcoal">
                      {sub.subscription.planName}
                    </span>
                    <span className="text-[0.72rem] font-bold bg-teal/10 text-teal px-2.5 py-0.5 rounded-full uppercase">
                      {sub.subscription.status}
                    </span>
                  </div>
                  <div className="text-sm text-charcoal-light space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {sub.subscription.interval === "year" ? "Yearly" : "Monthly"} billing
                    </p>
                    {sub.subscription.currentPeriodEnd && (
                      <p>
                        Renews{" "}
                        {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={createBillingPortal.isPending}
                    className="inline-flex items-center gap-1.5 border-2 border-teal text-teal px-5 py-2 rounded-full font-bold text-sm hover:bg-teal/10 transition-colors disabled:opacity-50 mt-2"
                  >
                    {createBillingPortal.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        Manage Subscription
                        <ExternalLink size={13} />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-xl font-heading font-bold text-charcoal">
                    Free Plan
                  </span>
                  <p className="text-sm text-charcoal-light">
                    You&apos;re on the free tier. Upgrade to get monthly credits and unlock more features.
                  </p>
                  <a
                    href={routes.pricing}
                    className="inline-flex items-center gap-1.5 bg-coral text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    <Sparkles size={14} />
                    Upgrade Now
                  </a>
                </div>
              )}
            </div>

            {/* Credit balance card */}
            <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Coins size={18} className="text-sunny-dark" />
                <h3 className="font-heading font-bold text-charcoal">
                  Credit Balance
                </h3>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-heading font-bold text-charcoal">
                  {credits.toLocaleString()}
                </span>
                <span className="text-sm text-charcoal-light">credits remaining</span>
              </div>

              {sub && (
                <div className="text-sm text-charcoal-light space-y-0.5">
                  {sub.monthlyCredits > 0 && (
                    <p>{sub.monthlyCredits.toLocaleString()} monthly (from subscription)</p>
                  )}
                  {sub.permanentCredits > 0 && (
                    <p>{sub.permanentCredits.toLocaleString()} permanent (from purchases)</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Buy more credits */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-teal" />
              <h3 className="font-heading font-bold text-charcoal text-lg">
                Buy More Credits
              </h3>
            </div>
            <p className="text-sm text-charcoal-light mb-5">
              Credits never expire. Top up whenever you need more firepower.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPacks.map((pack) => {
                const priceFormatted = (pack.price / 100).toFixed(0);
                const perCredit = (pack.price / 100 / pack.credits).toFixed(2);
                const isBuying =
                  createOneTimeSession.isPending &&
                  createOneTimeSession.variables?.credits === String(pack.credits);

                return (
                  <div
                    key={pack.credits}
                    className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 flex flex-col items-center text-center hover:-translate-y-0.5 hover:shadow-brand-md transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-sunny/20 flex items-center justify-center mb-3">
                      <Coins size={22} className="text-sunny-dark" />
                    </div>
                    <span className="text-2xl font-heading font-bold text-charcoal">
                      {pack.credits}
                    </span>
                    <span className="text-sm text-charcoal-light mb-1">credits</span>
                    <span className="text-lg font-heading font-bold text-charcoal mb-0.5">
                      ${priceFormatted}
                    </span>
                    <span className="text-[0.72rem] text-charcoal-light mb-4">
                      ${perCredit} per credit
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBuyCredits(pack.credits)}
                      disabled={createOneTimeSession.isPending}
                      className="w-full bg-coral text-white py-2.5 rounded-full font-bold text-sm shadow-md shadow-coral/20 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/25 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {isBuying ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 size={14} className="animate-spin" />
                          Redirecting...
                        </span>
                      ) : (
                        "Buy"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
