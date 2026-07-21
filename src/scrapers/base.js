/**
 * Interface comum que todo scraper de programa de milhas deve implementar.
 * @typedef {Object} Scraper
 * @property {string} program
 * @property {(browser: import('playwright').Browser, params: {origin: string, destination: string, date: string}) => Promise<import('../normalize').Flight[]>} search
 */

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

module.exports = { BaseScraper };
