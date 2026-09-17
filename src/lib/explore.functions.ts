import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listExploreDestinationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listExploreDestinations } = await import("@/lib/explore.server");
    return { destinations: await listExploreDestinations() };
  });
