import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchFlightsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      origin: z.string().min(3).max(4),
      destination: z.string().min(3).max(4),
      date: z.string(),
      programs: z.array(z.string()).min(1),
    })
  )
  .handler(async ({ data }) => {
    const { searchFlights } = await import("@/lib/miles-search.server");
    return searchFlights({
      origin: data.origin.toUpperCase(),
      destination: data.destination.toUpperCase(),
      date: data.date,
      programs: data.programs,
    });
  });

export const listProgramsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listPrograms } = await import("@/lib/miles-search.server");
    return { programs: listPrograms() };
  });
