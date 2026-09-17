import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function PriceCalendarDialog({
  target,
  onOpenChange,
}: {
  target: PriceCalendarTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data, isFetching } = useQuery({
    queryKey: ["month-prices", target?.origin, target?.destination, target?.program, year, month],
    queryFn: () =>
      getMonthPricesFn({
        data: {
          origin: target!.origin,
          destination: target!.destination,
          program: target!.program,
          year,
          month,
        },
      }),
    enabled: !!target,
  });

  const days = data?.days ?? [];

  const { min, max } = useMemo(() => {
    const valid = days.map((d) => d.miles).filter((m): m is number => m !== null);
    if (valid.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...valid), max: Math.max(...valid) };
  }, [days]);

  // Alinha o primeiro dia do mês na grade (segunda-feira como início da semana).
  const leadingBlanks = useMemo(() => {
    const jsWeekday = new Date(year, month, 1).getDay(); // 0=domingo
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

  function dayColor(miles: number | null) {
    if (miles === null) return { bg: "transparent", border: "var(--border)", text: "var(--muted-foreground)" };
    if (min === max) return { bg: "var(--accent)", border: target!.color, text: target!.color };
    const ratio = (miles - min) / (max - min);
    if (ratio <= 0.15) return { bg: "var(--green-bg, rgba(16,185,129,0.1))", border: "#10b981", text: "#0d9488" };
    if (ratio >= 0.75) return { bg: "rgba(239,68,68,0.08)", border: "#ef4444", text: "#dc2626" };
    return { bg: "rgba(245,158,11,0.1)", border: "#f59e0b", text: "#b45309" };
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>
                {target.origin} → {target.destination} ·{" "}
                <span style={{ color: target.color }}>{target.programLabel}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goPrevMonth}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="font-display font-semibold text-foreground">
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

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-[10px] font-semibold text-muted-foreground">
                  {w}
                </div>
              ))}

              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {days.map((d) => {
                const colors = dayColor(d.miles);
                return (
                  <div
                    key={d.day}
                    className="mono flex flex-col items-center justify-center rounded-md border py-1.5 text-[11px]"
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

            <p className="text-xs text-muted-foreground">
              {isFetching
                ? "Carregando…"
                : min > 0
                  ? `Menor preço do mês: ${min.toLocaleString("pt-BR")} milhas · cores relativas a esse mínimo · dia apagado = sem disponibilidade`
                  : "Sem disponibilidade nesse mês."}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
