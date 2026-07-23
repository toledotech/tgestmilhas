const bcrypt = require('bcrypt');
const { pool } = require('./db');

const SALT_ROUNDS = 12;
const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/i;

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function ensureBootstrapAdmin() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM admin_users');
  if (rows[0].count > 0) return;

  const username = process.env.ADMIN_BOOTSTRAP_USER;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!username || !password) {
    console.warn(
      'admin_users está vazia e ADMIN_BOOTSTRAP_USER/ADMIN_BOOTSTRAP_PASSWORD não foram definidas — ninguém vai conseguir logar no /admin.'
    );
    return;
  }

  await createUser({ username, password });
  console.log(`Admin inicial "${username}" criado a partir de ADMIN_BOOTSTRAP_USER/PASSWORD.`);
}

async function createUser({ username, password }) {
  if (!username || !USERNAME_REGEX.test(username)) {
    throw new Error('usuário inválido (use 3-32 caracteres: letras, números, ponto, _ ou -)');
  }
  if (!password || password.length < 8) {
    throw new Error('senha precisa ter pelo menos 8 caracteres');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const result = await pool.query(
      `INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new Error('esse usuário já existe');
    throw err;
  }
}

async function verifyUser({ username, password }) {
  const result = await pool.query(
    'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
    [username]
  );
  const user = result.rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(password || '', user.password_hash);
  if (!valid) return null;

  return { id: user.id, username: user.username };
}

module.exports = { ensureSchema, ensureBootstrapAdmin, createUser, verifyUser };
