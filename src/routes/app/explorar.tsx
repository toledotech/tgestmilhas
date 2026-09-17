import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listExploreDestinationsFn } from "@/lib/explore.functions";

type ExploreOffer = { program: string; miles: number; taxes: number };

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

const MONTH_LABEL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type ExploreDestination = NonNullable<
  Awaited<ReturnType<typeof listExploreDestinationsFn>>["destinations"]
>[number];

function ExplorarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["explore-destinations"],
    queryFn: () => listExploreDestinationsFn(),
  });

  const [selecionado, setSelecionado] = useState<ExploreDestination | null>(null);
  const [destino, setDestino] = useState("");
  const [programa, setPrograma] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [mes, setMes] = useState("todos");

  const destinations = data?.destinations ?? [];

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<number>();
    for (const d of destinations) set.add(new Date(d.sample_date).getMonth());
    return Array.from(set).sort((a, b) => a - b);
  }, [destinations]);

  const filtrados = useMemo(() => {
    return destinations.filter((d) => {
      if (destino && !`${d.label} ${d.destination}`.toLowerCase().includes(destino.toLowerCase())) return false;
      if (programa !== "todos" && d.cheapest_program !== programa) return false;
      if (tipo !== "todos") {
        const isNacional = d.country === "Brasil";
        if (tipo === "nacional" && !isNacional) return false;
        if (tipo === "internacional" && isNacional) return false;
      }
      if (mes !== "todos" && new Date(d.sample_date).getMonth() !== Number(mes)) return false;
      return true;
    });
  }, [destinations, destino, programa, tipo, mes]);

  function limparFiltros() {
    setDestino("");
    setPrograma("todos");
    setTipo("todos");
    setMes("todos");
  }

  const filtrosAtivos = destino || programa !== "todos" || tipo !== "todos" || mes !== "todos";

  return (
    <div className="space-y-6">
      <div>
        <h1>Explorar Destinos</h1>
        <p className="text-sm text-muted-foreground">
          Melhores preços encontrados numa lista curada de rotas — atualizado periodicamente, não em tempo
          real.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Origem</label>
            <Input value="São Paulo (GRU)" disabled className="mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Destino</label>
            <Input
              placeholder="Cidade ou código"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Programa</label>
            <select
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos</option>
              {Object.entries(PROGRAM_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="nacional">Nacional</option>
              <option value="internacional">Internacional</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos os meses</option>
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {MONTH_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : destinations.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum destino ainda — o job de atualização (cron) ainda não rodou pela primeira vez.
        </Card>
      ) : filtrados.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum destino bate com esses filtros.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((d) => {
            const offers = (d.offers as ExploreOffer[] | null) ?? [];
            return (
              <Card
                key={d.id}
                className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                onClick={() => setSelecionado(d)}
              >
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
                  <p className="mono text-xs text-muted-foreground">
                    + R$ {Number(d.cheapest_taxes).toFixed(2)} taxas
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {PROGRAM_LABEL[d.cheapest_program] ?? d.cheapest_program}
                  {offers.length > 1 && ` · +${offers.length - 1} programa(s)`}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <DialogContent>
          {selecionado && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selecionado.origin} → {selecionado.destination} · {selecionado.label}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {((selecionado.offers as ExploreOffer[] | null) ?? []).map((offer, i) => (
                  <div
                    key={offer.program}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      i === 0 ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {PROGRAM_LABEL[offer.program] ?? offer.program}
                    </span>
                    <span className="mono text-sm text-foreground">
                      {offer.miles.toLocaleString("pt-BR")} milhas{" "}
                      <span className="text-muted-foreground">+ R$ {offer.taxes.toFixed(2)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
