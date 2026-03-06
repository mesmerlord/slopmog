import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import MascotBlob from "@/components/MascotBlob";
import { trpc } from "@/utils/trpc";
import { planList } from "@/constants/pricing";
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

const PLAN_NAMES: Record<string, string> = {
  starter: "Test the Waters",
  growth: "Make Waves",
  pro: "Own the Ocean",
};

export default function PricingCards() {
  const router = useRouter();
  const { data: session } = useSession();
  const [interval, setInterval] = useState<"month" | "year">("month");

  const createSubscription = trpc.user.createSubscriptionSession.useMutation({
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

  return (
    <>
      {/* Monthly/Yearly toggle */}
      <div className="text-center mb-10">
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
      </div>

      {/* Subscription cards */}
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
                {PLAN_NAMES[plan.plan] || plan.plan_name}
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
    </>
  );
}
