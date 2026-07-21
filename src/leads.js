const fs = require('fs');
const path = require('path');

const LEADS_FILE = process.env.LEADS_FILE || path.join(__dirname, '..', 'data', 'leads.jsonl');

const VALID_PROFILES = new Set([
  'quase_nunca',
  'nacional_1_2',
  'internacional_1_2',
  'frequente_4mais',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function saveLead({ email, profile }) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error('email inválido');
  }
  if (!profile || !VALID_PROFILES.has(profile)) {
    throw new Error('perfil de viajante inválido');
  }

  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });

  const entry = { email, profile, createdAt: new Date().toISOString() };
  fs.appendFileSync(LEADS_FILE, JSON.stringify(entry) + '\n');

  return entry;
}

module.exports = { saveLead, LEADS_FILE };
