const { BaseScraper } = require('./base');
const { normalizeFlight } = require('../normalize');

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Confirmado ao vivo: a URL direta com query params (ex: ?origin=&destination=)
 * NÃO funciona para busca com milhas — `redemption=true` redireciona para
 * login (auth.latamairlines.com). É preciso interagir com o widget de busca
 * na home mesmo, como na Smiles.
 */
async function selectAutocomplete(page, placeholderRegex, query, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const field = page.getByPlaceholder(placeholderRegex).first();
    await field.evaluate((el) => el.focus());
    await page.keyboard.type(query, { delay: 120 });

    const option = page.getByRole('option', { name: new RegExp(query, 'i') }).first();
    const appeared = await option.isVisible({ timeout: 4000 + i * 2000 }).catch(() => false);

    if (appeared) {
      // Clique via JS: confirmado ao vivo que o movimento real do mouse do
      // Playwright pode ser interceptado por elementos sobrepostos nessas
      // SPAs (mesmo problema encontrado na Smiles).
      await option.evaluate((el) => el.click());
      await page.waitForTimeout(300);
      return;
    }
  }

  throw new Error(`sugestão para "${query}" não apareceu após ${attempts} tentativas`);
}

async function selectDate(page, isoDate, { maxMonthClicks = 24 } = {}) {
  const target = new Date(`${isoDate}T00:00:00`);
  const day = target.getDate();
  const monthName = PT_MONTHS[target.getMonth()];
  const year = target.getFullYear();
  const dayButton = page.getByRole('button', {
    name: new RegExp(`, ${day} de ${monthName} de ${year}`, 'i'),
  }).first();

  for (let i = 0; i <= maxMonthClicks; i++) {
    if (await dayButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await dayButton.evaluate((el) => el.click());
      return;
    }

    const next = page.getByRole('button', { name: 'Avança ao mês seguinte' }).first();
    await next.evaluate((el) => el.click());
    await page.waitForTimeout(400);
  }

  throw new Error(`data ${isoDate} não encontrada no calendário após ${maxMonthClicks} avanços de mês`);
}

/**
 * Scraper do LATAM Pass. Validado ao vivo até a seleção de origem, destino e
 * datas de ida/volta no widget de busca da home (todos com sucesso usando
 * clique via JS, sem mover o mouse real — ver comentário em selectAutocomplete).
 *
 * PENDENTE: o botão de submit (`button[type="submit"]`) permanece com o
 * aria-label "Sem campos preenchidos" mesmo após origem/destino/data
 * selecionados, e clicar nele via JS não navega. Isso sugere que o estado
 * interno do formulário (Redux ou similar) não está sendo atualizado pelos
 * cliques via JS — provavelmente porque o React/framework da LATAM valida
 * `event.isTrusted` ou depende de um evento de blur/mudança real antes de
 * liberar a busca. Próximo passo: tentar cliques reais do Playwright
 * (`.click()` sem force, movendo o mouse de fato) especificamente nesse
 * botão final, já que o problema da Smiles era o oposto (mouse real
 * atrapalhando); pode ser necessário uma combinação dos dois approaches.
 */
class LatamPassScraper extends BaseScraper {
  constructor() {
    super('latampass');
  }

  async search(browser, { origin, destination, date }) {
    const page = await browser.newPage();
    const flights = [];

    try {
      await page.goto('https://www.latamairlines.com/br/pt', { waitUntil: 'domcontentloaded' });

      const acceptCookies = page.getByRole('button', { name: /aceitar|concordo/i });
      if (await acceptCookies.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptCookies.evaluate((el) => el.click());
      }

      await selectAutocomplete(page, /insira uma origem/i, origin);
      await selectAutocomplete(page, /insira um destino/i, destination);

      await page.getByRole('textbox', { name: /escolha a data de ida/i }).evaluate((el) => el.click());
      await selectDate(page, date);

      // Formulário costuma exigir data de volta (ida e volta é o padrão);
      // usamos data +7 dias até termos suporte a somente-ida validado.
      const returnDate = new Date(`${date}T00:00:00`);
      returnDate.setDate(returnDate.getDate() + 7);
      await selectDate(page, returnDate.toISOString().slice(0, 10));

      await page.getByRole('button', { name: /procurar voos|buscar/i }).first().click().catch(async () => {
        await page.locator('button[type="submit"]').first().click();
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      const cards = page.locator('[data-testid="flight-card"]');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const milesText = await card.locator('[data-testid="miles-value"]').innerText().catch(() => null);
        const taxesText = await card.locator('[data-testid="taxes-value"]').innerText().catch(() => null);
        const flightNumber = await card.locator('[data-testid="flight-number"]').innerText().catch(() => null);

        if (!milesText) continue;

        flights.push(
          normalizeFlight({
            program: this.program,
            origin,
            destination,
            date,
            miles: milesText.replace(/\D/g, ''),
            taxes: (taxesText || '0').replace(/[^\d,]/g, '').replace(',', '.'),
            flightNumber,
            link: page.url(),
          })
        );
      }
    } finally {
      await page.close();
    }

    return flights;
  }
}

module.exports = { LatamPassScraper };
