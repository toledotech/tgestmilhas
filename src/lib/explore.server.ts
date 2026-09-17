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

      const cheapest = flights.reduce((min, f) => (f.miles < min.miles ? f : min), flights[0]);

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
