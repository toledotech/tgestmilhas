const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const { chromium } = require('playwright');

const { pool } = require('./db');
const { SmilesScraper } = require('./scrapers/smiles');
const { LatamPassScraper } = require('./scrapers/latampass');
const { TudoAzulScraper } = require('./scrapers/tudoazul');
const { saveLead, getAllLeads, ensureSchema: ensureLeadsSchema } = require('./leads');
const adminUsers = require('./adminUsers');
const messages = require('./messages');
const { startScheduler } = require('./scheduler');

const PORT = process.env.PORT || 3000;
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 45000);
const FREE_GROUP_URL = process.env.FREE_GROUP_URL || 'https://chat.whatsapp.com/SEU_LINK_AQUI';

const scrapers = {
  smiles: new SmilesScraper(),
  latampass: new LatamPassScraper(),
  tudoazul: new TudoAzulScraper(),
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const ADMIN_VIEWS_DIR = path.join(__dirname, '..', 'views', 'admin');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

if (process.env.DATABASE_URL) {
  app.use(
    session({
      store: new PgSession({ pool, tableName: 'admin_sessions', createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'não autenticado' });
  return res.redirect('/admin/login');
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/leads', async (req, res) => {
  try {
    await saveLead(req.body || {});
    res.json({ groupUrl: FREE_GROUP_URL });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Admin: auth ---

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(ADMIN_VIEWS_DIR, 'login.html'));
});

app.post('/admin/login', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const user = await adminUsers.verifyUser({ username: req.body.username, password: req.body.password });
    if (!user) return res.status(401).sendFile(path.join(ADMIN_VIEWS_DIR, 'login-error.html'));

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Erro ao fazer login: ' + err.message);
  }
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// --- Admin: dashboard ---

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_VIEWS_DIR, 'dashboard.html'));
});

app.get('/api/admin/leads', requireAuth, async (req, res) => {
  try {
    const leads = await getAllLeads();
    res.json({ leads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', requireAuth, express.json(), async (req, res) => {
  try {
    const user = await adminUsers.createUser(req.body || {});
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Admin: mensagens (rascunho / agendamento / envio / histórico) ---

app.get('/api/admin/messages', requireAuth, async (req, res) => {
  try {
    const list = await messages.listMessages({ status: req.query.status });
    const stats = await messages.getStats();
    res.json({ messages: list, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/messages/export.csv', requireAuth, async (req, res) => {
  try {
    const list = await messages.listMessages();
    const rows = [
      ['id', 'status', 'texto', 'tem_imagem', 'agendada_para', 'enviada_em', 'erro', 'criada_em'],
      ...list.map((m) => [
        m.id,
        m.status,
        (m.text || '').replace(/\r?\n/g, ' ').replace(/"/g, '""'),
        m.image_base64 ? 'sim' : 'não',
        m.scheduled_for || '',
        m.sent_at || '',
        (m.error || '').replace(/"/g, '""'),
        m.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mensagens.csv"');
    res.send('﻿' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/messages/:id', requireAuth, async (req, res) => {
  try {
    const message = await messages.getMessage(req.params.id);
    if (!message) return res.status(404).json({ error: 'mensagem não encontrada' });
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/messages', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const image = req.file ? { base64: req.file.buffer.toString('base64'), mimetype: req.file.mimetype } : null;
    const requestedStatus = req.body.status === 'send_now' ? 'draft' : req.body.status;

    let message = await messages.createMessage({
      text: req.body.text,
      image,
      status: requestedStatus,
      scheduledFor: req.body.scheduledFor || null,
      createdBy: req.session.userId,
    });

    if (req.body.status === 'send_now') {
      message = await messages.deliverMessage(message);
    }

    res.json({ message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/messages/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const image = req.file ? { base64: req.file.buffer.toString('base64'), mimetype: req.file.mimetype } : null;
    const message = await messages.updateMessage(req.params.id, {
      text: req.body.text,
      image,
      scheduledFor: req.body.scheduledFor || null,
    });
    res.json({ message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
  try {
    await messages.deleteMessage(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/messages/:id/send', requireAuth, async (req, res) => {
  try {
    const message = await messages.getMessage(req.params.id);
    if (!message) return res.status(404).json({ error: 'mensagem não encontrada' });
    if (message.status === 'sent') return res.status(400).json({ error: 'essa mensagem já foi enviada' });

    const result = await messages.deliverMessage(message);
    res.json({ message: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Scraper ---

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

if (process.env.DATABASE_URL) {
  Promise.all([ensureLeadsSchema(), adminUsers.ensureSchema(), messages.ensureSchema()])
    .then(() => adminUsers.ensureBootstrapAdmin())
    .then(() => startScheduler())
    .catch((err) => {
      console.error('Falha ao preparar o banco de dados:', err.message);
    });
} else {
  console.warn(
    'DATABASE_URL não definida — /api/leads e /admin não vão funcionar (ok para testar só o scraper localmente).'
  );
}

app.listen(PORT, () => {
  console.log(`Scraper de milhas rodando em http://localhost:${PORT}`);
});
