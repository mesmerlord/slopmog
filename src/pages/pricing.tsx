import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PricingCards from "@/components/PricingCards";
import { trpc } from "@/utils/trpc";
import { CREDIT_PRICES } from "@/constants/pricing";
import { routes } from "@/lib/constants";

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
    a: "One credit = $0.10. A regular Reddit or YouTube comment costs 6 credits ($0.60). High-Value comments — targeting threads that AI chatbots actively cite — cost 60 credits ($6) because they have way more impact.",
  },
  {
    q: "What's HV Discovery?",
    a: "HV Discovery finds the specific threads that AI chatbots like ChatGPT, Gemini, and Claude are citing when people ask for recommendations. Getting your brand into those threads means showing up in AI answers — not just search results.",
  },
];

const CREDIT_PACK_INFO: Record<number, { label: string; perCredit: string }> = {
  100: { label: "Starter Pack", perCredit: "$0.14" },
  300: { label: "Boost Pack", perCredit: "$0.13" },
  600: { label: "Power Pack", perCredit: "$0.125" },
  1200: { label: "Mega Pack", perCredit: "$0.12" },
};

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const createOneTime = trpc.user.createOneTimeSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleBuyCredits = (credits: number) => {
    if (!session) {
      router.push(`${routes.auth.login}?callbackUrl=${encodeURIComponent(routes.pricing)}`);
      return;
    }
    createOneTime.mutate({ credits: credits.toString() });
  };

  return (
    <>
      <Seo
        title="Pricing — SlopMog"
        description="Choose your SlopMog plan. Get your brand into AI recommendations with Reddit & YouTube comments. Plans from $49/mo."
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
        </section>

        {/* Subscription cards */}
        <section className="px-6 pb-20 md:pb-24">
          <PricingCards />
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
                    style={{ maxHeight: openFaqIndex === i ? "500px" : "0" }}
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
