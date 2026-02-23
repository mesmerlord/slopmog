import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { trpc } from "@/utils/trpc";
import "@/styles/globals.css";

function App({ Component, pageProps }: AppProps) {
  const { session, ...rest } = pageProps as { session?: unknown } & Record<string, unknown>;
  return (
    <SessionProvider session={session as never}>
      <Component {...rest} />
    </SessionProvider>
  );
}

export default trpc.withTRPC(App);
