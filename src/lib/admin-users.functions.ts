import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listAdminUsers } = await import("@/lib/admin-users.server");
    return { users: await listAdminUsers() };
  });

export const createAdminUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }))
  .handler(async ({ data }) => {
    const { createAdminUser } = await import("@/lib/admin-users.server");
    return { user: await createAdminUser(data) };
  });

export const deleteAdminUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (data.id === context.userId) {
      throw new Error("você não pode excluir seu próprio usuário");
    }
    const { deleteAdminUser } = await import("@/lib/admin-users.server");
    await deleteAdminUser(data.id);
    return { ok: true };
  });
