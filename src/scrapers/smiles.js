const { BaseScraper } = require('./base');
const { normalizeFlight } = require('../normalize');

/**
 * Fecha popups promocionais que aparecem com atraso (ex: overlay com id
 * "popupOverlay" bloqueando clique no buscador). Faz algumas tentativas
 * porque o popup pode surgir depois do carregamento inicial da página.
 */
async function closeBlockingPopups(page, attempts = 6, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    const closeBtn = page.getByRole('button', { name: /fechar popup|fechar/i }).first();
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.evaluate((el) => el.click()).catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    const overlay = page.locator('#popupOverlay.show, .popup-overlay.show').first();
    if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.waitForTimeout(delayMs);
  }
}

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * O calendário de "Ida" (react-dates) renderiza vários meses em sequência e
 * exige clique real (trusted event) no botão "próximo mês"
 * (`.calendar-navigation.button-right`) para revelar meses futuros — cliques
 * disparados via JS não são respeitados pelo componente. O popup promocional
 * também reaparece com frequência durante a navegação, por isso fechamos ele
 * a cada iteração. Confirmado em teste ao vivo até aqui; validar de novo se
 * a Smiles mudar o date picker.
 */
/**
 * Preenche um campo de origem/destino e clica na sugestão correspondente.
 * O debounce da busca de sugestões é um pouco instável (varia entre ~300ms e
 * mais), então tentamos algumas vezes com espera crescente antes de desistir.
 */
async function selectAutocomplete(page, field, query, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    // Confirmado ao vivo: QUALQUER movimento real do mouse do Playwright
    // (mesmo com force:true) pode passar sobre o header e disparar um
    // submenu de navegação por hover, que fica sobreposto e atrapalha os
    // passos seguintes. focus() via JS + digitação real (teclado, sem mover
    // o mouse) + clique via JS na sugestão evita esse problema por completo.
    await field.evaluate((el) => el.focus());
    await field.evaluate((el) => { el.value = ''; });
    await page.keyboard.type(query, { delay: 120 });

    const suggestion = page.locator('button').filter({ hasText: new RegExp(query, 'i') }).first();
    const appeared = await suggestion.isVisible({ timeout: 4000 + i * 2000 }).catch(() => false);

    if (appeared) {
      await suggestion.evaluate((el) => el.click());
      await page.waitForTimeout(300);

      const value = await field.inputValue().catch(() => '');
      if (value && value.toUpperCase().includes(query.toUpperCase())) {
        return;
      }
    }
  }

  throw new Error(`não foi possível confirmar a seleção de "${query}" após ${attempts} tentativas`);
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
    await closeBlockingPopups(page, 1, 200);

    if (await dayButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await dayButton.evaluate((el) => el.click());
      return;
    }

    await page.locator('.calendar-navigation.button-right').first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
  }

  throw new Error(`data ${isoDate} não encontrada no calendário após ${maxMonthClicks} avanços de mês`);
}

/**
 * Scraper da Smiles. A Smiles é uma SPA sem suporte a busca via query string,
 * então precisamos interagir com o widget de busca na home. Os seletores abaixo
 * são best-effort e DEVEM ser validados/ajustados rodando em modo headed
 * (PLAYWRIGHT_HEADLESS=false) contra o site real antes de ir para produção —
 * o layout muda com frequência e pode haver cookie wall / captcha.
 */
class SmilesScraper extends BaseScraper {
  constructor() {
    super('smiles');
  }

  async search(browser, { origin, destination, date }) {
    const page = await browser.newPage();
    const flights = [];

    try {
      await page.goto('https://www.smiles.com.br/', { waitUntil: 'domcontentloaded' });

      const acceptCookies = page.getByRole('button', { name: /aceitar todos/i });
      if (await acceptCookies.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptCookies.evaluate((el) => el.click());
      }

      // A Smiles costuma exibir popups promocionais (ex: "Promoção Clube Smiles")
      // que aparecem com atraso via JS e bloqueiam cliques até serem fechados.
      await closeBlockingPopups(page);

      // Confirmado ao vivo: QUALQUER movimento real do mouse do Playwright
      // (mesmo com force:true, que só ignora a checagem de visibilidade mas
      // ainda move o cursor) pode passar sobre o header e disparar um
      // submenu de navegação por hover, que fica sobreposto e atrapalha os
      // passos seguintes. Por isso clicamos via JS (sem mover o mouse) em
      // todos os elementos deste fluxo.
      await page.getByRole('button', { name: /buscador smiles/i }).evaluate((el) => el.click());

      // Confirmado em teste ao vivo: os campos de origem/destino têm
      // placeholder "Origem"/"Destino" e mostram uma lista de sugestões (via
      // botão clicável, não role="option") que precisa ser CLICADA — Enter
      // sozinho não confirma e o campo volta a ficar vazio.
      // Importante: usar pressSequentially (digitação real, tecla por tecla) e
      // não fill() — o autocomplete da Smiles escuta eventos de teclado para
      // disparar a busca de sugestões, e fill() não os dispara.
      await selectAutocomplete(page, page.getByPlaceholder(/origem/i), origin);
      await selectAutocomplete(page, page.getByPlaceholder(/destino/i), destination);

      // Selecionar destino costuma abrir o calendário de "Ida" automaticamente;
      // se não abrir, clicamos no campo para garantir.
      const idaField = page.getByPlaceholder(/^ida$/i);
      if (!(await page.locator('[role="application"]').isVisible({ timeout: 1000 }).catch(() => false))) {
        await idaField.evaluate((el) => el.click());
      }
      await selectDate(page, date);

      await page.getByRole('button', { name: /buscar voos/i }).evaluate((el) => el.click());
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      const cards = page.locator('[data-testid="flight-card"]');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const milesText = await card.locator('[data-testid="flight-miles"]').innerText().catch(() => null);
        const taxesText = await card.locator('[data-testid="flight-taxes"]').innerText().catch(() => null);
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

module.exports = { SmilesScraper };
