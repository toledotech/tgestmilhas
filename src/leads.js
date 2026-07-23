const { pool } = require('./db');

const VALID_PROFILES = new Set([
  'quase_nunca',
  'nacional_1_2',
  'internacional_1_2',
  'frequente_4mais',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      profile TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // ALTER idempotente — cobre o banco de produção, que já tinha a tabela
  // criada antes do campo de WhatsApp existir.
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT`);
}

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) {
    throw new Error('WhatsApp inválido');
  }
  return digits;
}

async function saveLead({ email, phone, profile }) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error('email inválido');
  }
  const normalizedPhone = normalizePhone(phone);
  if (!profile || !VALID_PROFILES.has(profile)) {
    throw new Error('perfil de viajante inválido');
  }

  const result = await pool.query(
    `INSERT INTO leads (email, phone, profile)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone, profile = EXCLUDED.profile
     RETURNING email, phone, profile, created_at`,
    [email, normalizedPhone, profile]
  );

  return result.rows[0];
}

async function getAllLeads() {
  const result = await pool.query(
    `SELECT email, phone, profile, created_at FROM leads ORDER BY created_at DESC`
  );
  return result.rows;
}

module.exports = { saveLead, getAllLeads, ensureSchema };
