import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MascotBlob from "@/components/MascotBlob";
import { trpc } from "@/utils/trpc";
import { planList, CREDIT_PRICES } from "@/constants/pricing";
import { routes } from "@/lib/constants";

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
      <circle cx="9" cy="9" r="8" stroke="#2EC4B6" strokeWidth="1.5" />
      <path d="M6 9l2 2 4-4" stroke="#2EC4B6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5 opacity-30">
      <circle cx="9" cy="9" r="8" stroke="#2D3047" strokeWidth="1.5" />
      <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const PRICING_FAQ = [
  {
    q: "Can I switch plans later?",
    a: "Absolutely. Upgrade or downgrade anytime from your dashboard. When you upgrade, you get the difference in credits immediately. When you downgrade, the change takes effect at your next billing cycle.",
  },
  {
    q: "What happens to unused credits?",
    a: "Monthly subscription credits reset each billing cycle. Credits purchased as one-time packs are permanent and never expire. Use them whenever you want.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a full refund within 7 days of your first subscription payment if you're not happy. After that, you can cancel anytime and you'll keep access until the end of your billing period.",
  },
  {
    q: "What counts as one credit?",
    a: "One credit = one Reddit comment posted. Each comment is AI-generated (or written by you), posted on an aged Reddit account, and strategically placed in relevant conversations about your category.",
  },
  {
    q: "Is there a free trial?",
    a: "Every new account gets 3 free credits to try the service. No credit card required. Post 3 comments, see the results, then decide if you want more.",
  },
];

const CREDIT_PACK_INFO: Record<number, { label: string; perCredit: string }> = {
  5: { label: "Starter Pack", perCredit: "$3.80" },
  15: { label: "Boost Pack", perCredit: "$3.27" },
  40: { label: "Power Pack", perCredit: "$2.98" },
  100: { label: "Mega Pack", perCredit: "$2.49" },
};

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const createSubscription = trpc.user.createSubscriptionSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createOneTime = trpc.user.createOneTimeSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubscribe = (planName: string) => {
    if (!session) {
      router.push(`${routes.auth.login}?callbackUrl=${encodeURIComponent(routes.pricing)}`);
      return;
    }
    createSubscription.mutate({ planName, interval });
  };

  const handleBuyCredits = (credits: number) => {
    if (!session) {
      router.push(`${routes.auth.login}?callbackUrl=${encodeURIComponent(routes.pricing)}`);
      return;
    }
    createOneTime.mutate({ credits: credits.toString() });
  };

  function renderFeature(feature: string, available: boolean, values?: Record<string, number>, key?: number) {
    let text = feature;
    if (values) {
      for (const [k, val] of Object.entries(values)) {
        text = text.replace(`{{${k}}}`, val.toString());
      }
    }
    return (
      <li key={key} className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal">
        {available ? <CheckIcon /> : <CrossIcon />}
        <span className={available ? "" : "opacity-40"}>{text}</span>
      </li>
    );
  }

  return (
    <>
      <Seo
        title="Pricing — SlopMog"
        description="Choose your SlopMog plan. Get your brand into AI recommendations with authentic Reddit comments. Plans from $49/mo."
      />

      <Nav />

      <main className="pt-20 md:pt-24">
        {/* Hero */}
        <section className="text-center px-6 pb-12 md:pb-16">
          <span className="inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">
            Pricing
          </span>
          <h1 className="font-heading font-bold text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">
            Pick Your Speed
          </h1>
          <p className="text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-10">
            Your competitors figured this out last quarter. Time to catch up.
          </p>

          {/* Monthly/Yearly toggle */}
          <div className="inline-flex bg-white rounded-full p-1 shadow-brand-sm border border-charcoal/[0.06]">
            <button
              className={`px-6 py-2.5 rounded-full font-bold text-[0.9rem] transition-all${interval === "month" ? " bg-teal text-white shadow-[0_2px_10px_rgba(46,196,182,0.3)]" : " bg-transparent text-charcoal-light"}`}
              onClick={() => setInterval("month")}
            >
              Monthly
            </button>
            <button
              className={`px-6 py-2.5 rounded-full font-bold text-[0.9rem] transition-all flex items-center gap-2${interval === "year" ? " bg-teal text-white shadow-[0_2px_10px_rgba(46,196,182,0.3)]" : " bg-transparent text-charcoal-light"}`}
              onClick={() => setInterval("year")}
            >
              Yearly
              <span className="bg-sunny text-charcoal text-[0.7rem] font-bold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </section>

        {/* Subscription cards */}
        <section className="px-6 pb-20 md:pb-24">
          <div className="max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {planList.map((plan) => {
              const price = interval === "month" ? plan.price.monthly : Math.round(plan.price.yearly / 12);
              const isPopular = plan.popular;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-brand-lg px-7 py-9 max-md:px-[22px] max-md:py-7 border-2 hover:-translate-y-1 transition-all relative${
                    isPopular
                      ? " shadow-brand-md border-teal md:scale-[1.04] z-[2] hover:shadow-brand-lg"
                      : " shadow-brand-sm border-charcoal/[0.06] hover:shadow-brand-lg"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal text-white px-5 py-1.5 rounded-full text-[0.75rem] font-bold uppercase tracking-wide whitespace-nowrap">
                      Most Popular
                    </div>
                  )}

                  <div className="font-heading text-[1.2rem] font-bold text-charcoal mb-2 capitalize">
                    {plan.plan === "starter" ? "Test the Waters" : plan.plan === "growth" ? "Make Waves" : "Own the Ocean"}
                  </div>
                  <div className="font-heading text-[2.4rem] max-md:text-[2rem] font-bold text-charcoal mb-1">
                    ${price}
                    <span className="text-[0.9rem] font-medium text-charcoal-light">/mo</span>
                  </div>
                  {interval === "year" && (
                    <div className="text-[0.8rem] text-teal font-semibold mb-1">
                      Billed ${Math.round(plan.price.yearly)}/year
                    </div>
                  )}
                  <div className="text-[0.85rem] text-charcoal-light mb-6">{plan.description}</div>

                  <ul className="list-none mb-7 text-left">
                    {plan.features.map((f, i) =>
                      renderFeature(f.feature, f.available, f.values, i)
                    )}
                  </ul>

                  <button
                    className={`block w-full py-3.5 rounded-full font-bold text-[0.95rem] text-center border-2 transition-all disabled:opacity-50${
                      isPopular
                        ? " border-coral bg-coral text-white shadow-[0_4px_16px_rgba(255,107,107,0.25)] hover:bg-coral-dark hover:border-coral-dark hover:-translate-y-0.5"
                        : " border-teal text-teal bg-transparent hover:bg-teal hover:text-white"
                    }`}
                    onClick={() => handleSubscribe(plan.plan_name)}
                    disabled={createSubscription.isPending}
                  >
                    {createSubscription.isPending ? "Redirecting..." : "Get Started"}
                  </button>

                  {isPopular && (
                    <div className="pricing-mascot-ctx absolute -bottom-4 -right-5 z-[3] max-md:hidden">
                      <MascotBlob />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Credit packs */}
        <section className="px-6 pb-20 md:pb-24 bg-teal-bg py-16 md:py-20">
          <div className="max-w-[960px] mx-auto text-center">
            <span className="inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">
              Credit Packs
            </span>
            <h2 className="font-heading font-bold text-[clamp(1.5rem,3vw,2rem)] text-charcoal mb-3">
              Need more? Grab extra credits.
            </h2>
            <p className="text-[0.95rem] text-charcoal-light max-w-[480px] mx-auto mb-10">
              One-time purchases. Credits never expire. Use them whenever you want.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[800px] mx-auto">
              {Object.entries(CREDIT_PRICES).map(([credits, { price }]) => {
                const num = parseInt(credits);
                const info = CREDIT_PACK_INFO[num];
                return (
                  <div
                    key={credits}
                    className="bg-white rounded-brand p-5 shadow-brand-sm border border-charcoal/[0.06] hover:-translate-y-1 hover:shadow-brand-md transition-all text-center"
                  >
                    <div className="font-heading text-[1.6rem] font-bold text-charcoal mb-1">
                      {num}
                    </div>
                    <div className="text-[0.82rem] text-charcoal-light mb-1">credits</div>
                    <div className="font-heading text-[1.1rem] font-bold text-teal mb-1">
                      ${(price / 100).toFixed(0)}
                    </div>
                    {info && (
                      <div className="text-[0.75rem] text-charcoal-light mb-3">
                        {info.perCredit}/credit
                      </div>
                    )}
                    <button
                      className="w-full py-2 rounded-full font-bold text-[0.85rem] border-2 border-teal text-teal bg-transparent hover:bg-teal hover:text-white transition-all disabled:opacity-50"
                      onClick={() => handleBuyCredits(num)}
                      disabled={createOneTime.isPending}
                    >
                      Buy
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 md:py-20">
          <div className="max-w-[680px] mx-auto text-center">
            <span className="inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">
              FAQ
            </span>
            <h2 className="font-heading font-bold text-[clamp(1.5rem,3vw,2rem)] text-charcoal mb-10">
              Pricing Questions
            </h2>

            <div className="text-left">
              {PRICING_FAQ.map((item, i) => (
                <div className={`border-b border-charcoal/[0.08]${openFaqIndex === i ? " faq-item-open" : ""}`} key={i}>
                  <button
                    className="w-full flex justify-between items-center py-5 max-md:py-4 bg-transparent font-heading text-[1.05rem] max-md:text-[0.95rem] font-bold text-charcoal text-left gap-4 hover:text-teal transition-colors"
                    onClick={() => setOpenFaqIndex((prev) => (prev === i ? null : i))}
                  >
                    {item.q}
                    <span className="faq-icon w-7 h-7 rounded-full bg-teal/[0.08] flex items-center justify-center shrink-0 transition-all duration-300">
                      <PlusIcon />
                    </span>
                  </button>
                  <div
                    className="faq-answer overflow-hidden transition-all duration-300"
                    style={{ maxHeight: openFaqIndex === i ? "200px" : "0" }}
                  >
                    <div className="pb-5 text-[0.95rem] max-md:text-[0.88rem] text-charcoal-light leading-[1.7]">
                      {item.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
