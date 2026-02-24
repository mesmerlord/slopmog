import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { trpc } from "@/utils/trpc";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login?callbackUrl=/dashboard");
    }
  }, [status, router]);

  // Success toast after Stripe checkout
  useEffect(() => {
    if (router.query.success === "true") {
      toast.success("Payment successful! Your credits have been updated.");
      // Clean up URL
      router.replace("/dashboard", undefined, { shallow: true });
    }
  }, [router.query.success, router]);

  const subscriptionQuery = trpc.user.getSubscriptionStatus.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  const billingPortal = trpc.user.createBillingPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const data = subscriptionQuery.data;
  const isSubscribed = data?.subscription?.isPaid;

  return (
    <>
      <Seo title="Dashboard — SlopMog" noIndex />
      <Nav />

      <main className="pt-20 md:pt-24 pb-16 px-4 md:px-6">
        <div className="max-w-[900px] mx-auto">
          {/* Header */}
          <div className="mb-8 md:mb-10">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-charcoal mb-2">
              Hey, {session?.user?.name?.split(" ")[0] || "you beautiful shill"} 👋
            </h1>
            <p className="text-charcoal-light text-[0.95rem]">
              Here&apos;s what&apos;s happening with your account.
            </p>
          </div>

          {subscriptionQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-brand-lg p-8 shadow-brand-sm border border-charcoal/[0.06] animate-pulse">
                  <div className="h-4 bg-charcoal/[0.06] rounded w-1/3 mb-4" />
                  <div className="h-10 bg-charcoal/[0.06] rounded w-1/2 mb-3" />
                  <div className="h-3 bg-charcoal/[0.06] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Credit balance */}
                <div className="bg-white rounded-brand-lg p-8 shadow-brand-sm border border-charcoal/[0.06] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="text-[0.82rem] font-bold uppercase tracking-wider text-teal mb-3">
                      Credit Balance
                    </div>
                    <div className="font-heading text-[3rem] font-bold text-charcoal mb-2 leading-none">
                      {data?.credits ?? 0}
                    </div>
                    <div className="text-[0.85rem] text-charcoal-light space-y-0.5">
                      <div>
                        <span className="text-teal font-semibold">{data?.monthlyCredits ?? 0}</span> monthly
                        {" + "}
                        <span className="text-lavender font-semibold">{data?.permanentCredits ?? 0}</span> permanent
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription status */}
                <div className="bg-white rounded-brand-lg p-8 shadow-brand-sm border border-charcoal/[0.06] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-coral/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="text-[0.82rem] font-bold uppercase tracking-wider text-coral mb-3">
                      Subscription
                    </div>
                    {isSubscribed ? (
                      <>
                        <div className="font-heading text-[1.5rem] font-bold text-charcoal mb-1">
                          {data?.subscription?.planName}
                          <span className="inline-block bg-teal text-white text-[0.7rem] font-bold px-2 py-0.5 rounded-full ml-2 align-middle">
                            Active
                          </span>
                        </div>
                        <div className="text-[0.85rem] text-charcoal-light mb-4">
                          Renews{" "}
                          {data?.subscription?.currentPeriodEnd
                            ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "soon"}
                        </div>
                        <button
                          className="text-[0.88rem] font-semibold text-teal hover:text-teal-dark transition-colors disabled:opacity-50"
                          onClick={() => billingPortal.mutate()}
                          disabled={billingPortal.isPending}
                        >
                          {billingPortal.isPending ? "Opening..." : "Manage Subscription →"}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="font-heading text-[1.5rem] font-bold text-charcoal mb-1">
                          Free Plan
                        </div>
                        <div className="text-[0.85rem] text-charcoal-light mb-4">
                          You&apos;re on the free plan. Upgrade to start posting comments.
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-block bg-coral text-white px-6 py-2.5 rounded-full font-bold text-[0.88rem] shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl transition-all"
                        >
                          Upgrade Now
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                  href="/pricing"
                  className="bg-white rounded-brand p-5 shadow-brand-sm border border-charcoal/[0.06] hover:-translate-y-0.5 hover:shadow-brand-md transition-all group text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-teal/20 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4v12M4 10h12" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="font-bold text-[0.92rem] text-charcoal">Buy More Credits</div>
                  <div className="text-[0.8rem] text-charcoal-light mt-0.5">Top up your balance</div>
                </Link>

                <div className="bg-white rounded-brand p-5 shadow-brand-sm border border-charcoal/[0.06] opacity-60 text-center">
                  <div className="w-10 h-10 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 10l4 4 10-10" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="font-bold text-[0.92rem] text-charcoal">Start Campaign</div>
                  <div className="text-[0.8rem] text-charcoal-light mt-0.5">Coming soon</div>
                </div>

                <div className="bg-white rounded-brand p-5 shadow-brand-sm border border-charcoal/[0.06] opacity-60 text-center">
                  <div className="w-10 h-10 rounded-full bg-lavender/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="3" width="14" height="14" rx="3" stroke="#B197FC" strokeWidth="2" />
                      <path d="M7 10h6M10 7v6" stroke="#B197FC" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="font-bold text-[0.92rem] text-charcoal">Analytics</div>
                  <div className="text-[0.8rem] text-charcoal-light mt-0.5">Coming soon</div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
