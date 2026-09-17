import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Users, UserCog, LogOut, Search } from "lucide-react";
import { brand } from "@/config/brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppShell({ email, children }: { email?: string | null; children: ReactNode }) {
  const navigate = useNavigate();

  async function onLogout() {
    await supabase.auth.signOut();
    await navigate({ to: "/entrar" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r border-border bg-card px-4 py-5">
        <div className="mb-6">
          <p className="font-display text-sm font-bold text-foreground">{brand.name}</p>
          {email ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{email}</p> : null}
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <Link
            to="/app"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeProps={{ className: "active-blue" }}
            activeOptions={{ exact: true }}
          >
            <MessageSquare className="size-4" />
            Mensagens
          </Link>
          <Link
            to="/app/buscador"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeProps={{ className: "active-blue" }}
          >
            <Search className="size-4" />
            Buscador
          </Link>
          <Link
            to="/app/leads"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeProps={{ className: "active-blue" }}
          >
            <Users className="size-4" />
            Leads
          </Link>
          <Link
            to="/app/usuarios"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeProps={{ className: "active-blue" }}
          >
            <UserCog className="size-4" />
            Usuários
          </Link>
        </nav>
        <Button variant="ghost" size="sm" className="justify-start gap-2 text-muted-foreground" onClick={onLogout}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
