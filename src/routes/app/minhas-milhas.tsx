import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExploreDestinationsFn } from "@/lib/explore.functions";
import { PriceCalendarDialog, type PriceCalendarTarget } from "@/components/price-calendar-dialog";
import { PROGRAM_LABEL, PROGRAM_COLOR, DEFAULT_PROGRAM_COLOR, hexToRgba } from "@/lib/program-colors";

type ExploreOffer = { program: string; miles: number; taxes: number };

export const Route = createFileRoute("/app/minhas-milhas")({
  component: MinhasMilhasPage,
});

function MinhasMilhasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["explore-destinations"],
    queryFn: () => listExploreDestinationsFn(),
  });

  const [milhas, setMilhas] = useState("");
  const [programa, setPrograma] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [calendarTarget, setCalendarTarget] = useState<PriceCalendarTarget | null>(null);

  const milhasNum = Number(milhas.replace(/\D/g, "")) || 0;
  const destinations = data?.destinations ?? [];

  const resultado = useMemo(() => {
    if (milhasNum <= 0) return [];

    return destinations
      .map((d) => {
        const offers = ((d.offers as ExploreOffer[] | null) ?? [])
          .filter((o) => o.miles <= milhasNum && (programa === "todos" || o.program === programa))
          .sort((a, b) => a.miles - b.miles);
        return { destino: d, offers };
      })
      .filter(({ destino, offers }) => {
        if (offers.length === 0) return false;
        if (tipo === "nacional" && destino.country !== "Brasil") return false;
        if (tipo === "internacional" && destino.country === "Brasil") return false;
        return true;
      })
      .sort((a, b) => a.offers[0].miles - b.offers[0].miles);
  }, [destinations, milhasNum, programa, tipo]);

  return (
    <div className="space-y-6">
      <div>
        <h1>Minhas Milhas</h1>
        <p className="text-sm text-muted-foreground">
          Ainda não sabe pra onde ir? Diz quantas milhas você tem e a gente mostra tudo que dá pra fazer com
          elas — nacional e internacional.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="milhas">Quantas milhas você tem?</Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="milhas"
                className="mono pl-9"
                placeholder="Ex: 300000"
                value={milhas}
                onChange={(e) => setMilhas(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Programa</Label>
            <select
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Qualquer programa</option>
              {Object.entries(PROGRAM_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Nacional e internacional</option>
              <option value="nacional">Só nacional</option>
              <option value="internacional">Só internacional</option>
            </select>
          </div>
        </div>
      </Card>

      {milhasNum <= 0 ? (
        <Card className="p-8 text-center">
          <Wallet className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Digite quantas milhas você tem acima pra ver as opções de viagem.
          </p>
        </Card>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : resultado.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Com {milhasNum.toLocaleString("pt-BR")} milhas, nenhum destino da nossa lista cabe ainda — tenta
          aumentar o valor ou trocar o filtro de programa/tipo.
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {resultado.length} destino(s) possíveis com {milhasNum.toLocaleString("pt-BR")} milhas
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultado.map(({ destino: d, offers }) => {
              const sobra = milhasNum - offers[0].miles;
              return (
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

                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sobram {sobra.toLocaleString("pt-BR")} milhas
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {offers.map((offer, i) => {
                      const color = PROGRAM_COLOR[offer.program] ?? DEFAULT_PROGRAM_COLOR;
                      return (
                        <button
                          key={offer.program}
                          type="button"
                          onClick={() =>
                            setCalendarTarget({
                              origin: d.origin,
                              destination: d.destination,
                              program: offer.program,
                              programLabel: PROGRAM_LABEL[offer.program] ?? offer.program,
                              color,
                            })
                          }
                          className="mono inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-transform hover:scale-105"
                          style={{
                            border: `${i === 0 ? 2 : 1}px solid ${color}`,
                            backgroundColor: hexToRgba(color, i === 0 ? 0.16 : 0.1),
                            color,
                          }}
                        >
                          {PROGRAM_LABEL[offer.program] ?? offer.program}
                          <b>{offer.miles.toLocaleString("pt-BR")}</b>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <PriceCalendarDialog target={calendarTarget} onOpenChange={(open) => !open && setCalendarTarget(null)} />
    </div>
  );
}
