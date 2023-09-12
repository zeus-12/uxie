import { documentRouter } from "@/server/api/routers/document";
import { createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  document: documentRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
