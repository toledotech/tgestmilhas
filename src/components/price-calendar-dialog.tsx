import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMonthPricesFn } from "@/lib/miles-search.functions";

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
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

export type PriceCalendarTarget = {
  origin: string;
  destination: string;
  program: string;
  programLabel: string;
  color: string;
};

function dayColor(miles: number | null, min: number, max: number, color: string) {
  if (miles === null) return { bg: "transparent", border: "var(--border)", text: "var(--muted-foreground)" };
  if (min === max) return { bg: "var(--accent)", border: color, text: color };
  const ratio = (miles - min) / (max - min);
  if (ratio <= 0.15) return { bg: "rgba(16,185,129,0.1)", border: "#10b981", text: "#0d9488" };
  if (ratio >= 0.75) return { bg: "rgba(239,68,68,0.08)", border: "#ef4444", text: "#dc2626" };
  return { bg: "rgba(245,158,11,0.1)", border: "#f59e0b", text: "#b45309" };
}

function MonthCalendarColumn({
  label,
  origin,
  destination,
  program,
  color,
}: {
  label: string;
  origin: string;
  destination: string;
  program: string;
  color: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data, isFetching } = useQuery({
    queryKey: ["month-prices", origin, destination, program, year, month],
    queryFn: () => getMonthPricesFn({ data: { origin, destination, program, year, month } }),
  });

  const days = data?.days ?? [];

  const { min, max } = useMemo(() => {
    const valid = days.map((d) => d.miles).filter((m): m is number => m !== null);
    if (valid.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...valid), max: Math.max(...valid) };
  }, [days]);

  const leadingBlanks = useMemo(() => {
    const jsWeekday = new Date(year, month, 1).getDay();
    return (jsWeekday + 6) % 7;
  }, [year, month]);

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function goNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="flex-1 space-y-3">
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Plane className="size-3.5" style={{ color }} />
        {label} · {origin} → {destination}
      </p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="font-display text-sm font-semibold text-foreground">
          {MONTH_LABEL[month]} {year}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[9px] font-semibold text-muted-foreground">
            {w}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {days.map((d) => {
          const colors = dayColor(d.miles, min, max, color);
          return (
            <div
              key={d.day}
              className="mono flex flex-col items-center justify-center rounded-md border py-1 text-[10px]"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: colors.text,
                opacity: d.miles === null ? 0.4 : 1,
              }}
            >
              <span className="font-semibold">{d.day}</span>
              <span>{d.miles !== null ? `${Math.round(d.miles / 1000)}K` : "—"}</span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {isFetching ? "Carregando…" : min > 0 ? `A partir de ${min.toLocaleString("pt-BR")} milhas` : "Sem disponibilidade"}
      </p>
    </div>
  );
}

export function PriceCalendarDialog({
  target,
  onOpenChange,
}: {
  target: PriceCalendarTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>
                {target.origin} → {target.destination} ·{" "}
                <span style={{ color: target.color }}>{target.programLabel}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-6 sm:flex-row">
              <MonthCalendarColumn
                label="Ida"
                origin={target.origin}
                destination={target.destination}
                program={target.program}
                color={target.color}
              />

              <div className="hidden w-px shrink-0 bg-border sm:block" />
              <div className="h-px w-full bg-border sm:hidden" />

              <MonthCalendarColumn
                label="Volta"
                origin={target.destination}
                destination={target.origin}
                program={target.program}
                color={target.color}
              />
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Cores relativas ao menor preço de cada mês · dia apagado = sem disponibilidade
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
