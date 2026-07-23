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
      profile TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function saveLead({ email, profile }) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error('email inválido');
  }
  if (!profile || !VALID_PROFILES.has(profile)) {
    throw new Error('perfil de viajante inválido');
  }

  const result = await pool.query(
    `INSERT INTO leads (email, profile)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET profile = EXCLUDED.profile
     RETURNING email, profile, created_at`,
    [email, profile]
  );

  return result.rows[0];
}

async function getAllLeads() {
  const result = await pool.query(
    `SELECT email, profile, created_at FROM leads ORDER BY created_at DESC`
  );
  return result.rows;
}

module.exports = { saveLead, getAllLeads, ensureSchema };
