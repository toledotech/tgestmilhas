/**
 * Interface comum que todo scraper de programa de milhas deve implementar.
 * @typedef {Object} Scraper
 * @property {string} program
 * @property {(browser: import('playwright').Browser, params: {origin: string, destination: string, date: string}) => Promise<import('../normalize').Flight[]>} search
 */

/**
 * Cria uma página "disfarçada" de automação. Confirmado ao vivo (Smiles):
 * com `navigator.webdriver === true` (padrão do Chromium controlado pelo
 * Playwright), o autocomplete de origem/destino nunca retorna sugestões —
 * a digitação funciona normalmente, mas a lista de sugestões simplesmente
 * não aparece, silenciosamente. No mesmo fluxo com `navigator.webdriver`
 * mascarado, as sugestões aparecem. Aplicamos essa camada em todos os
 * scrapers como padrão, já que a mesma técnica de detecção pode estar
 * ativa (ou vir a ficar) em qualquer um dos sites.
 */
async function createStealthPage(browser) {
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Chromium automatizado não carrega o plugin de PDF nem line/languages
    // "normais" — alguns scripts de fingerprint usam isso como sinal extra.
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
    window.chrome = window.chrome || { runtime: {} };
  });

  return page;
}

class BaseScraper {
  constructor(program) {
    if (!program) throw new Error('program é obrigatório');
    this.program = program;
  }

  // eslint-disable-next-line no-unused-vars
  async search(browser, { origin, destination, date }) {
    throw new Error(`${this.program}: search() não implementado`);
  }
}

module.exports = { BaseScraper, createStealthPage };
