import { createNextApiHandler } from "@trpc/server/adapters/next";
import { createContext } from "@/server/trpc";
import { appRouter } from "@/server/root";

export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError:
    process.env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
    responseLimit: "4mb",
  },
};
