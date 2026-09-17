import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Precisa estar registrado como `functionMiddleware` global em `src/start.ts`,
// senão o navegador nunca anexa o bearer token nas chamadas de server function.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
