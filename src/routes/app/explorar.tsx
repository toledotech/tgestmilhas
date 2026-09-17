import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listExploreDestinationsFn } from "@/lib/explore.functions";

export const Route = createFileRoute("/app/explorar")({
  component: ExplorarPage,
});

const PROGRAM_LABEL: Record<string, string> = {
  smiles: "Smiles",
  latampass: "LATAM Pass",
  tudoazul: "TudoAzul",
  azulpelomundo: "Azul Pelo Mundo",
  iberiaplus: "Iberia Plus",
};

function ExplorarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["explore-destinations"],
    queryFn: () => listExploreDestinationsFn(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1>Explorar Destinos</h1>
        <p className="text-sm text-muted-foreground">
          Melhores preços encontrados numa lista curada de rotas — atualizado periodicamente, não em tempo
          real. Saindo de São Paulo (GRU).
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data?.destinations.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum destino ainda — o job de atualização (cron) ainda não rodou pela primeira vez.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.destinations.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-foreground">{d.label}</p>
                  <p className="mono text-xs text-muted-foreground">
                    {d.origin} → {d.destination}
                  </p>
                </div>
                <Badge variant={d.country === "Brasil" ? "secondary" : "default"}>
                  {d.country === "Brasil" ? "Nacional" : "Internacional"}
                </Badge>
              </div>
              <div className="mt-3">
                <p className="mono text-lg font-bold text-primary">
                  {d.cheapest_miles.toLocaleString("pt-BR")} milhas
                </p>
                <p className="mono text-xs text-muted-foreground">+ R$ {Number(d.cheapest_taxes).toFixed(2)} taxas</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {PROGRAM_LABEL[d.cheapest_program] ?? d.cheapest_program}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
