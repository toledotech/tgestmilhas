/**
 * Cliente da Partner API da seats.aero (https://developers.seats.aero).
 * Usa o endpoint "Cached Search" — dados de disponibilidade em milhas
 * atualizados periodicamente (não é busca ao vivo), ideal pro nosso caso de
 * monitoramento contínuo de rotas.
 *
 * Cobertura confirmada na documentação: `smiles` (GOL Smiles) e `azul`
 * (Azul TudoAzul). LATAM Pass NÃO é um source suportado por essa API —
 * ficou de fora por decisão do usuário, ver docs/seats-aero-email-draft.md
 * para o pedido de acesso comercial em andamento.
 *
 * IMPORTANTE: este cliente ainda não foi validado contra a API real (sem
 * chave disponível no momento em que foi escrito). A forma dos campos
 * (`Trips`, `YMileageCost` etc.) segue exatamente o que está documentado em
 * https://developers.seats.aero/reference/concepts-copy e
 * https://developers.seats.aero/reference/cached-search — validar assim que
 * tivermos a API key.
 */

const BASE_URL = 'https://seats.aero/partnerapi';

// Y = econômica, J = executiva/business — os dois únicos cabins que a
// Smiles/TudoAzul reportam na tabela de "sources" da documentação.
const CABINS = ['Y', 'J'];

function apiKey() {
  const key = process.env.SEATS_AERO_API_KEY;
  if (!key) throw new Error('SEATS_AERO_API_KEY não configurada');
  return key;
}

async function cachedSearch({ origin, destination, startDate, endDate, source }) {
  const params = new URLSearchParams({
    origin_airport: origin,
    destination_airport: destination,
    start_date: startDate,
    end_date: endDate,
    sources: source,
    include_trips: 'true',
    only_direct_flights: 'false',
    take: '1000',
  });

  const res = await fetch(`${BASE_URL}/search?${params.toString()}`, {
    headers: {
      'Partner-Authorization': apiKey(),
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`seats.aero respondeu ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Converte o resultado bruto da Cached Search em Flight[] no formato comum
 * do projeto (ver src/normalize.js). Prioriza dados de `Trips` (têm taxas e
 * número do voo); se não vierem, usa o resumo por cabin do próprio
 * Availability (sem taxa, sem número de voo específico).
 */
function toFlights({ data }, { program, origin, destination }) {
  const { normalizeFlight } = require('./normalize');
  const flights = [];

  for (const availability of data || []) {
    const trips = availability.Trips || [];

    if (trips.length) {
      for (const trip of trips) {
        flights.push(
          normalizeFlight({
            program,
            origin,
            destination,
            date: availability.Date,
            miles: trip.MileageCost,
            taxes: trip.TotalTaxes ? trip.TotalTaxes / 100 : 0, // TotalTaxes vem em centavos
            flightNumber: trip.FlightNumbers,
            link: 'https://seats.aero/search',
          })
        );
      }
      continue;
    }

    for (const cabin of CABINS) {
      if (!availability[`${cabin}Available`]) continue;

      flights.push(
        normalizeFlight({
          program,
          origin,
          destination,
          date: availability.Date,
          miles: availability[`${cabin}MileageCost`],
          taxes: 0,
          flightNumber: null,
          link: 'https://seats.aero/search',
        })
      );
    }
  }

  return flights;
}

async function searchProgram({ program, source, origin, destination, date }) {
  const data = await cachedSearch({
    origin,
    destination,
    startDate: date,
    endDate: date,
    source,
  });

  return toFlights(data, { program, origin, destination });
}

module.exports = { searchProgram };
