import { useEffect } from "react";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import ReactGA from "react-ga4";
import { trpc } from "@/utils/trpc";
import { useAnalyticsIdentify } from "@/hooks/useAnalyticsIdentify";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import "@/styles/globals.css";

const AnalyticsInit = () => {
  useEffect(() => {
    const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-K5PRLKY2W9";
    ReactGA.initialize(gaId);
  }, []);

  useAnalyticsIdentify();
  return null;
};

function App({ Component, pageProps }: AppProps) {
  const { session, ...rest } = pageProps as { session?: unknown } & Record<string, unknown>;

  return (
    <SessionProvider session={session as never}>
      <AnalyticsInit />
      <ImpersonationBanner />
      <Component {...rest} />
      <Toaster position="top-right" richColors />
    </SessionProvider>
  );
}

export default trpc.withTRPC(App);
