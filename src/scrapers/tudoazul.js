const { BaseScraper, createStealthPage } = require('./base');
const { normalizeFlight } = require('../normalize');

/**
 * Avança o calendário um mês (clique via JS, sem mover o mouse — mesmo
 * cuidado das outras SPAs). Confirmado ao vivo: existem DOIS botões "voltar"
 * (aria-label="Anterior"/"Próximo") na página inteira que pertencem a
 * carrosséis promocionais, não ao calendário — por isso não dá pra usar
 * aria-label. O botão certo é identificado por estar na mesma altura (eixo Y)
 * do grid do calendário (`[data-calendar-grid]`) e mais à direita (maior
 * `left`) entre os candidatos sem "disabled" e sem texto.
 */
async function clickNextMonth(page) {
  await page.evaluate(() => {
    const gridRect = document.querySelector('[data-calendar-grid]').getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll('button')).filter((b) => {
      const r = b.getBoundingClientRect();
      return Math.abs(r.top - gridRect.top) < 100 && !b.disabled && b.textContent.trim() === '';
    });
    candidates.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
    candidates[0].click();
  });
}

async function selectDate(page, isoDate, { maxMonthClicks = 24 } = {}) {
  for (let i = 0; i <= maxMonthClicks; i++) {
    const found = await page.evaluate(
      (date) => !!document.querySelector(`button[data-date="${date}"]`),
      isoDate
    );
    if (found) {
      await page.evaluate((date) => document.querySelector(`button[data-date="${date}"]`).click(), isoDate);
      return;
    }
    await clickNextMonth(page);
    await page.waitForTimeout(300);
  }

  throw new Error(`data ${isoDate} não encontrada no calendário após ${maxMonthClicks} avanços de mês`);
}

async function selectAutocomplete(page, labelText, query, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const inputId = await page.evaluate((label) => {
      const span = Array.from(document.querySelectorAll('*')).find(
        (e) => e.children.length === 0 && e.textContent.trim() === label
      );
      const field = span?.closest('label')?.querySelector('input');
      if (!field) return null;
      field.focus();
      return field.id;
    }, labelText);

    if (!inputId) throw new Error(`campo "${labelText}" não encontrado`);

    await page.keyboard.type(query, { delay: 120 });

    const optionText = await page.evaluate(() => {
      const opt = document.querySelector('[role="option"]');
      return opt ? opt.textContent.trim() : null;
    });

    if (optionText && optionText.toUpperCase().includes(query.toUpperCase())) {
      await page.evaluate(() => document.querySelector('[role="option"]').click());
      return;
    }

    await page.waitForTimeout(500 + i * 500);
  }

  throw new Error(`sugestão para "${query}" não apareceu após ${attempts} tentativas`);
}

/**
 * Scraper da TudoAzul. Validado ao vivo até a navegação para a página de
 * resultados (URL final contém origin/destination/data corretos), usando
 * clique via JS em todo o fluxo — mesmo cuidado de mouse das outras SPAs.
 * Origem/destino usam autocomplete com `role="option"` limpo (mais fácil que
 * Smiles/LATAM). Calendário usa `data-date="AAAA-MM-DD"` nos botões de dia.
 *
 * PENDENTE: a página de resultados carregada no teste não mostrou nenhum
 * card de voo (`[data-testid]` sem nada relacionado a voos/preços) — pode
 * ser falta de disponibilidade real na rota/data testada (GRU-MCO) ou algo
 * a mais precisando ser preenchido antes da busca. Os seletores de
 * `[data-testid="flight-card"]` abaixo são placeholder e precisam ser
 * validados contra uma busca com resultados reais.
 */
class TudoAzulScraper extends BaseScraper {
  constructor() {
    super('tudoazul');
  }

  async search(browser, { origin, destination, date }) {
    const page = await createStealthPage(browser);
    const flights = [];

    try {
      await page.goto('https://www.voeazul.com.br/br/pt/home', { waitUntil: 'domcontentloaded' });

      const acceptCookies = page.getByRole('button', { name: /aceitar todos os cookies/i });
      if (await acceptCookies.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptCookies.evaluate((el) => el.click());
      }

      await selectAutocomplete(page, 'Origem', origin);
      await selectAutocomplete(page, 'Destino', destination);
      await selectDate(page, date);

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === 'Buscar passagens'
        );
        btn?.click();
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      const cards = page.locator('[data-testid="flight-card"]');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const milesText = await card.locator('[data-testid="points-value"]').innerText().catch(() => null);
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

module.exports = { TudoAzulScraper };
