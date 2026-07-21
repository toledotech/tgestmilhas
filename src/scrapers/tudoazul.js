const { BaseScraper } = require('./base');
const { normalizeFlight } = require('../normalize');

/**
 * Scraper da TudoAzul. Assim como as outras, é uma SPA — os seletores abaixo
 * são best-effort e precisam ser validados/ajustados em modo headed contra o
 * site real antes de ir para produção.
 */
class TudoAzulScraper extends BaseScraper {
  constructor() {
    super('tudoazul');
  }

  async search(browser, { origin, destination, date }) {
    const page = await browser.newPage();
    const flights = [];

    try {
      const url = `https://www.voeazul.com.br/br/pt/home/comprar/selecionar-voos?origin=${origin}&destination=${destination}&departureDate=${date}&adults=1&currency=POINTS`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const acceptCookies = page.getByRole('button', { name: /aceitar|concordo/i });
      if (await acceptCookies.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptCookies.click();
      }

      await page.waitForSelector('[data-testid="flight-card"]', { timeout: 30000 }).catch(() => {});

      const cards = page.locator('[data-testid="flight-card"]');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const pointsText = await card.locator('[data-testid="points-value"]').innerText().catch(() => null);
        const taxesText = await card.locator('[data-testid="taxes-value"]').innerText().catch(() => null);
        const flightNumber = await card.locator('[data-testid="flight-number"]').innerText().catch(() => null);

        if (!pointsText) continue;

        flights.push(
          normalizeFlight({
            program: this.program,
            origin,
            destination,
            date,
            miles: pointsText.replace(/\D/g, ''),
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
