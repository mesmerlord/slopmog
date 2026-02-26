import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { planList, type Plan } from "@/constants/pricing";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";
import { routes } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// PricingCard (internal)
// ---------------------------------------------------------------------------

const PricingCard = ({
  plan,
  period,
}: {
  plan: Plan;
  period: "monthly" | "yearly";
}) => {
  const { data: session } = useSession();
  const price = period === "monthly" ? plan.price.monthly : plan.price.yearly / 12;
  const originalPrice = plan.price.monthly;
  const discount = plan.price.yearlyDiscount;

  const checkout = trpc.user.createSubscriptionSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => {
      toast.error("Couldn't start checkout. Try again?");
    },
  });

  const handleSubscribe = () => {
    if (!session) {
      window.location.href = `${routes.auth.login}?callbackUrl=/pricing`;
      return;
    }
    checkout.mutate({
      planName: plan.plan_name,
      interval: period === "monthly" ? "month" : "year",
    });
  };

  const popular = plan.popular;

  return (
    <div
      className={`relative bg-white rounded-brand-lg p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-brand-lg ${
        popular
          ? "ring-2 ring-coral shadow-brand-md scale-[1.04] z-10"
          : "border border-charcoal/[0.08] shadow-brand-sm"
      }`}
    >
      {/* Most Popular badge */}
      {popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-coral text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider whitespace-nowrap shadow-brand-sm">
          Most Popular
        </span>
      )}

      {/* Plan name & description */}
      <div className="mt-1">
        <h3 className="font-heading font-bold text-lg text-charcoal">
          {plan.plan_name}
        </h3>
        <p className="text-sm text-charcoal-light mt-0.5">
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div className="mt-4 pb-4 border-b border-charcoal/[0.06]">
        {period === "yearly" && discount > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base line-through text-charcoal-light/50">
              ${originalPrice}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-coral/10 text-coral">
              -{discount}%
            </span>
          </div>
        )}
        <span className="text-4xl font-bold text-charcoal font-heading">
          ${Math.round(price)}
        </span>
        <span className="text-sm text-charcoal-light ml-0.5">/mo</span>
        {period === "yearly" && (
          <p className="text-xs text-charcoal-light/60 mt-1">
            billed yearly
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="mt-4 space-y-2.5">
        {plan.features.slice(0, 5).map((feat, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                feat.available
                  ? "bg-teal/10"
                  : "bg-charcoal/[0.04]"
              }`}
            >
              <Check
                size={10}
                strokeWidth={3}
                className={
                  feat.available
                    ? "text-teal"
                    : "text-charcoal-light/30"
                }
              />
            </span>
            <span
              className={`text-sm leading-snug ${
                feat.available
                  ? "text-charcoal"
                  : "text-charcoal-light/40 line-through"
              }`}
            >
              {feat.values
                ? feat.feature.replace(
                    /\{\{(\w+)\}\}/g,
                    (_, key: string) => String(feat.values?.[key] ?? "")
                  )
                : feat.feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleSubscribe}
        disabled={checkout.isPending}
        className={`w-full mt-6 rounded-full font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 ${
          popular
            ? "py-3.5 bg-coral text-white hover:bg-coral-dark shadow-md hover:shadow-lg hover:shadow-coral/25 text-base"
            : "py-3 bg-coral text-white hover:bg-coral-dark hover:shadow-md hover:shadow-coral/20"
        }`}
      >
        {checkout.isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Redirecting...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Subscribe
            <ArrowRight size={14} />
          </span>
        )}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SubscriptionModal
// ---------------------------------------------------------------------------

export const SubscriptionModal = ({
  open,
  onOpenChange,
  title = "Time to level up",
  description = "Pick a plan to unlock more keywords and start posting.",
}: SubscriptionModalProps) => {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[1000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[calc(100%-2rem)] max-w-4xl bg-cream rounded-brand-lg shadow-brand-lg overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="bg-white border-b border-charcoal/[0.06] px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                  <Sparkles size={20} className="text-teal" />
                </div>
                <div>
                  <Dialog.Title className="font-heading text-lg font-bold text-charcoal">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-charcoal-light mt-0.5">
                    {description}
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="text-charcoal-light hover:text-charcoal transition-colors rounded-full p-1.5 -m-1.5 hover:bg-charcoal/[0.04]">
                <X size={18} />
              </Dialog.Close>
            </div>

            {/* Period toggle */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <span
                className={`text-sm font-semibold cursor-pointer transition-colors ${
                  period === "monthly" ? "text-teal" : "text-charcoal-light"
                }`}
                onClick={() => setPeriod("monthly")}
              >
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setPeriod(period === "monthly" ? "yearly" : "monthly")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  period === "yearly" ? "bg-teal" : "bg-charcoal/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    period === "yearly" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-semibold cursor-pointer transition-colors ${
                  period === "yearly" ? "text-teal" : "text-charcoal-light"
                }`}
                onClick={() => setPeriod("yearly")}
              >
                Yearly
                <span className="ml-1.5 text-xs text-coral font-bold">Save 20%</span>
              </span>
            </div>
          </div>

          {/* Plans grid */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              {planList.map((plan) => (
                <PricingCard key={plan.id} plan={plan} period={period} />
              ))}
            </div>

            <p className="text-center text-xs text-charcoal-light/60 mt-6">
              Cancel anytime. No lock-in. We&apos;re clingy but not legally.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
