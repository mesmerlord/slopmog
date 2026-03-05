import { useEffect } from "react";
import { useSession } from "next-auth/react";
import ReactGA from "react-ga4";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Identifies the logged-in user in GA4 and Microsoft Clarity.
 * Call once in _app or a layout wrapper.
 */
export const useAnalyticsIdentify = () => {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // Google Analytics
    ReactGA.set({ userId });

    // Microsoft Clarity
    if (typeof window !== "undefined" && window.clarity) {
      window.clarity("identify", userId);
    }
  }, [session?.user?.id]);
};
