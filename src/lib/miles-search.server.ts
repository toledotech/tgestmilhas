/**
 * Camada de busca de passagens com milhas.
 *
 * TODO(Busca Milhas): assim que o contrato/API key chegar, trocar
 * `generateMockFlights` por uma chamada HTTP real pro provedor — a
 * assinatura de `searchFlights` e o formato de retorno (FlightResult)
 * não precisam mudar, então nada além desse arquivo é afetado.
 */

export type FlightResult = {
  program: string;
  origin: string;
  destination: string;
  date: string;
  miles: number;
  taxes: number;
  flightNumber: string;
  link: string;
};

export type SearchError = { program: string; message: string };

const PROGRAM_LABEL: Record<string, string> = {
  smiles: "Smiles",
  latampass: "LATAM Pass",
  tudoazul: "TudoAzul",
  azulpelomundo: "Azul Pelo Mundo",
  iberiaplus: "Iberia Plus",
};

const CACHE_TTL_MINUTES = 30;

function cacheKey(origin: string, destination: string, date: string, program: string) {
  return `${origin}_${destination}_${date}_${program}`.toUpperCase();
}

/**
 * Gera resultados plausíveis (não reais) pra podermos construir e testar
 * toda a UI/cache antes de termos acesso à API de verdade.
 */
function generateMockFlights(program: string, origin: string, destination: string, date: string): FlightResult[] {
  const base = (origin.charCodeAt(0) + destination.charCodeAt(0) + program.length) % 5;
  const count = 1 + (base % 3);
  return Array.from({ length: count }, (_, i) => {
    const miles = 8000 + base * 1500 + i * 3200;
    const taxes = 45 + base * 12 + i * 9;
    return {
      program,
      origin,
      destination,
      date,
      miles,
      taxes,
      flightNumber: `${program.slice(0, 2).toUpperCase()} ${1000 + base * 37 + i}`,
      link: `https://example.com/mock-checkout/${program}/${origin}${destination}/${date}`,
    };
  });
}

async function getCached(origin: string, destination: string, date: string, program: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("miles_search_cache")
    .select("results, expires_at")
    .eq("cache_key", cacheKey(origin, destination, date, program))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.results as FlightResult[];
}

async function saveCache(origin: string, destination: string, date: string, program: string, results: FlightResult[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresAt = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from("miles_search_cache").upsert(
    {
      cache_key: cacheKey(origin, destination, date, program),
      origin,
      destination,
      date,
      program,
      results,
      expires_at: expiresAt,
    },
    { onConflict: "cache_key" }
  );
  if (error) throw new Error(error.message);
}

export async function searchFlights({
  origin,
  destination,
  date,
  programs,
}: {
  origin: string;
  destination: string;
  date: string;
  programs: string[];
}): Promise<{ flights: FlightResult[]; errors: SearchError[] }> {
  const flights: FlightResult[] = [];
  const errors: SearchError[] = [];

  for (const program of programs) {
    if (!PROGRAM_LABEL[program]) {
      errors.push({ program, message: "programa desconhecido" });
      continue;
    }
    try {
      let results = await getCached(origin, destination, date, program);
      if (!results) {
        results = generateMockFlights(program, origin, destination, date);
        await saveCache(origin, destination, date, program, results);
      }
      flights.push(...results);
    } catch (err) {
      errors.push({ program, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { flights, errors };
}

export function listPrograms() {
  return Object.entries(PROGRAM_LABEL).map(([value, label]) => ({ value, label }));
}

export type CalendarDay = { day: number; miles: number | null };

/** Hash simples e determinístico — mesmo input sempre gera o mesmo "preço",
 * pra não ficar mudando a cada re-render/clique. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Calendário de preços de um mês inteiro pra uma rota+programa — simulado,
 * mesma lógica de `generateMockFlights`. TODO(Busca Milhas): trocar por
 * consulta real quando tivermos a API; a assinatura não muda.
 */
export function getMonthPrices({
  origin,
  destination,
  program,
  year,
  month, // 0-11
}: {
  origin: string;
  destination: string;
  program: string;
  year: number;
  month: number;
}): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hash = hashString(`${origin}${destination}${program}${dateStr}`);
    const available = hash % 100 >= 12; // ~88% dos dias com disponibilidade
    if (!available) {
      days.push({ day, miles: null });
      continue;
    }
    const base = (origin.charCodeAt(0) + destination.charCodeAt(0) + program.length) % 5;
    const variation = hash % 7;
    days.push({ day, miles: 6000 + base * 1500 + variation * 2200 });
  }

  return days;
}
