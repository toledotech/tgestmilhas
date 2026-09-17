import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Users, UserCog, Search } from "lucide-react";
import { brand } from "@/config/brand";
import { supabase } from "@/integrations/supabase/client";
import { AppTopbar } from "@/components/ui/app-topbar";
import { SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ email, children }: { email?: string | null; children: ReactNode }) {
  const navigate = useNavigate();

  async function onLogout() {
    await supabase.auth.signOut();
    await navigate({ to: "/entrar" });
  }

  return (
    <SidebarProvider>
    <div className="flex min-h-screen w-full flex-col bg-background">
      <AppTopbar
        title={brand.name}
        user={email ? { name: email.split("@")[0], email } : undefined}
        onLogout={onLogout}
      />
      <div className="flex flex-1">
        <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-[220px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
          <nav className="flex flex-1 flex-col gap-1">
            <Link
              to="/app"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "active-blue" }}
              activeOptions={{ exact: true }}
            >
              <MessageSquare className="size-4" />
              Mensagens
            </Link>
            <Link
              to="/app/buscador"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "active-blue" }}
            >
              <Search className="size-4" />
              Buscador
            </Link>
            <Link
              to="/app/leads"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "active-blue" }}
            >
              <Users className="size-4" />
              Leads
            </Link>
            <Link
              to="/app/usuarios"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "active-blue" }}
            >
              <UserCog className="size-4" />
              Usuários
            </Link>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
    </SidebarProvider>
  );
}
