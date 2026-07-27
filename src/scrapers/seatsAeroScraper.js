const { BaseScraper } = require('./base');
const seatsAero = require('../seatsAero');

/**
 * Scraper "sem navegador" — busca disponibilidade via API da seats.aero em
 * vez de Playwright. Substitui os scrapers antigos de Smiles e TudoAzul
 * (mantidos em smiles.js/tudoazul.js só como referência histórica da
 * investigação de bot-detection, não usados mais em produção).
 *
 * O parâmetro `browser` do BaseScraper é ignorado — não precisamos de
 * navegador pra chamar uma API HTTP.
 */
class SeatsAeroScraper extends BaseScraper {
  constructor(program, source) {
    super(program);
    this.source = source;
  }

  async search(browser, { origin, destination, date }) {
    return seatsAero.searchProgram({ program: this.program, source: this.source, origin, destination, date });
  }
}

module.exports = { SeatsAeroScraper };
