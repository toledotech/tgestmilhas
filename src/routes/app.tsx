import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

type Ctx = { user: { id: string; email?: string | null } };

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async (): Promise<Ctx> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/entrar" });
    return { user: { id: data.user.id, email: data.user.email } };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell email={user.email}>
      <Outlet />
    </AppShell>
  );
}
