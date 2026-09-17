import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLeadsFn } from "@/lib/leads.functions";

export const Route = createFileRoute("/app/leads")({
  component: LeadsPage,
});

const PROFILE_LABEL: Record<string, string> = {
  quase_nunca: "Quase nunca viaja",
  nacional_1_2: "Nacional 1-2x/ano",
  internacional_1_2: "Internacional 1-2x/ano",
  nacional_e_internacional_1_1: "1 nacional + 1 internacional/ano",
  frequente_4mais: "Frequente (4+/ano)",
};

function LeadsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => listLeadsFn() });

  return (
    <div className="space-y-6">
      <h1>Leads</h1>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Total de leads</p>
        <p className="mt-1 text-2xl font-bold">{data?.leads.length ?? 0}</p>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : !data?.leads.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum lead ainda.
                </TableCell>
              </TableRow>
            ) : (
              data.leads.map((lead) => (
                <TableRow key={lead.email}>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell className="mono">{lead.phone}</TableCell>
                  <TableCell>{PROFILE_LABEL[lead.profile] ?? lead.profile}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
