import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import ReactGA from "react-ga4";
import { trpc } from "@/utils/trpc";

/**
 * Tracks a GA4 purchase event after successful Stripe checkout.
 * Reads `success` and `session_id` query params from the URL.
 */
export const useTrackPayment = () => {
  const router = useRouter();
  const tracked = useRef(false);
  const sessionId =
    typeof router.query.session_id === "string" ? router.query.session_id : undefined;

  const checkoutQuery = trpc.user.getCheckoutSession.useQuery(
    { sessionId: sessionId! },
    { enabled: router.query.success === "true" && !!sessionId && !tracked.current },
  );

  useEffect(() => {
    if (tracked.current || !checkoutQuery.data) return;
    tracked.current = true;

    const { amountPaid, currency } = checkoutQuery.data;

    ReactGA.event("purchase", {
      transaction_id: sessionId,
      currency: currency.toUpperCase(),
      value: (amountPaid ?? 0) / 100,
    });
  }, [checkoutQuery.data, sessionId]);
};
