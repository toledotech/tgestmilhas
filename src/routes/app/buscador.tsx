import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchFlightsFn, listProgramsFn } from "@/lib/miles-search.functions";

export const Route = createFileRoute("/app/buscador")({
  component: BuscadorPage,
});

function BuscadorPage() {
  const { data: programsData } = useQuery({ queryKey: ["miles-programs"], queryFn: () => listProgramsFn() });
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string[]>(["smiles"]);

  const searchMutation = useMutation({
    mutationFn: () =>
      searchFlightsFn({ data: { origin, destination, date, programs: selected } }),
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleProgram(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Buscador</h1>
        <p className="text-sm text-muted-foreground">
          Resultados simulados por enquanto — a integração real com a Busca Milhas entra assim que o contrato for
          fechado.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="origin">Origem (IATA)</Label>
            <Input id="origin" placeholder="GRU" maxLength={4} value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">Destino (IATA)</Label>
            <Input
              id="destination"
              placeholder="MIA"
              maxLength={4}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Programas</Label>
          <div className="flex flex-wrap gap-2">
            {programsData?.programs.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => toggleProgram(p.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected.includes(p.value)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => searchMutation.mutate()}
          disabled={!origin || !destination || !date || selected.length === 0 || searchMutation.isPending}
        >
          {searchMutation.isPending ? "Buscando…" : "Buscar"}
        </Button>
      </Card>

      {searchMutation.data && (
        <Card>
          <div className="border-b border-border px-4 py-3">
            <h3>
              {searchMutation.data.flights.length} voo(s) encontrado(s)
              {searchMutation.data.errors.length > 0 && (
                <span className="ml-2 text-xs text-destructive">
                  ({searchMutation.data.errors.length} erro(s))
                </span>
              )}
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programa</TableHead>
                <TableHead>Trecho</TableHead>
                <TableHead>Voo</TableHead>
                <TableHead>Milhas</TableHead>
                <TableHead>Taxas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchMutation.data.flights.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum voo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                searchMutation.data.flights.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="secondary">{f.program}</Badge>
                    </TableCell>
                    <TableCell className="mono">
                      {f.origin} → {f.destination}
                    </TableCell>
                    <TableCell className="mono">{f.flightNumber}</TableCell>
                    <TableCell className="mono">{f.miles.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="mono">R$ {f.taxes.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
