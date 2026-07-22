const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const { chromium } = require('playwright');

const { SmilesScraper } = require('./scrapers/smiles');
const { LatamPassScraper } = require('./scrapers/latampass');
const { TudoAzulScraper } = require('./scrapers/tudoazul');
const { saveLead, ensureSchema } = require('./leads');

const PORT = process.env.PORT || 3000;
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 45000);
const FREE_GROUP_URL = process.env.FREE_GROUP_URL || 'https://chat.whatsapp.com/SEU_LINK_AQUI';

const scrapers = {
  smiles: new SmilesScraper(),
  latampass: new LatamPassScraper(),
  tudoazul: new TudoAzulScraper(),
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/leads', async (req, res) => {
  try {
    await saveLead(req.body || {});
    res.json({ groupUrl: FREE_GROUP_URL });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/search', async (req, res) => {
  const { origin, destination, date, program } = req.query;

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'origin, destination e date são obrigatórios' });
  }

  const requestedPrograms = program ? String(program).split(',') : Object.keys(scrapers);
  const unknown = requestedPrograms.filter((p) => !scrapers[p]);
  if (unknown.length) {
    return res.status(400).json({ error: `programa(s) desconhecido(s): ${unknown.join(', ')}` });
  }

  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    const results = await Promise.allSettled(
      requestedPrograms.map((p) =>
        withTimeout(scrapers[p].search(browser, { origin, destination, date }), SCRAPE_TIMEOUT_MS, p)
      )
    );

    const flights = [];
    const errors = [];

    results.forEach((result, i) => {
      const p = requestedPrograms[i];
      if (result.status === 'fulfilled') {
        flights.push(...result.value);
      } else {
        errors.push({ program: p, message: result.reason?.message || String(result.reason) });
      }
    });

    res.json({ flights, errors });
  } finally {
    await browser.close();
  }
});

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: timeout após ${ms}ms`)), ms)),
  ]);
}

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Scraper de milhas rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao preparar o banco de dados:', err.message);
    process.exit(1);
  });
