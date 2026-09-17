/**
 * "Explorar Destinos" simplificado — sem mapa geográfico. Um job periódico
 * (rota /api/cron/refresh-explore, chamada pelo n8n) roda a busca contra um
 * conjunto fixo e curado de rotas (tabela explore_routes) e grava a melhor
 * oferta de cada uma em explore_results. A tela só lê explore_results —
 * nunca busca ao vivo, pra manter o custo de dados baixo e previsível.
 */

const ALL_PROGRAMS = ["smiles", "latampass", "tudoazul", "azulpelomundo", "iberiaplus"];

/** Data usada como amostra pra estimar o melhor preço de cada destino. */
function sampleDate(daysAhead = 45): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export async function refreshExploreDestinations() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { searchFlights } = await import("@/lib/miles-search.server");

  const { data: routes, error } = await supabaseAdmin
    .from("explore_routes")
    .select("id, origin, destination, label, country")
    .eq("active", true);
  if (error) throw new Error(error.message);

  const date = sampleDate();
  const results = { updated: 0, failed: 0 };

  for (const route of routes || []) {
    try {
      const { flights } = await searchFlights({
        origin: route.origin,
        destination: route.destination,
        date,
        programs: ALL_PROGRAMS,
      });
      if (flights.length === 0) continue;

      // Menor preço por programa (não só o menor geral) — pra mostrar todas
      // as opções lado a lado quando o usuário clicar no destino, igual o
      // Tripse faz (Smiles X, LATAM Y, Azul Z...).
      const cheapestByProgram = new Map<string, (typeof flights)[number]>();
      for (const f of flights) {
        const current = cheapestByProgram.get(f.program);
        if (!current || f.miles < current.miles) cheapestByProgram.set(f.program, f);
      }
      const offers = Array.from(cheapestByProgram.values())
        .sort((a, b) => a.miles - b.miles)
        .map((f) => ({ program: f.program, miles: f.miles, taxes: f.taxes }));
      const cheapest = offers[0];

      const { error: upsertErr } = await supabaseAdmin.from("explore_results").upsert(
        {
          route_id: route.id,
          origin: route.origin,
          destination: route.destination,
          label: route.label,
          country: route.country,
          cheapest_miles: cheapest.miles,
          cheapest_taxes: cheapest.taxes,
          cheapest_program: cheapest.program,
          offers,
          sample_date: date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "route_id" }
      );
      if (upsertErr) throw new Error(upsertErr.message);
      results.updated++;
    } catch {
      results.failed++;
    }
  }

  return results;
}

export async function listExploreDestinations() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("explore_results")
    .select("*")
    .order("cheapest_miles", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}
