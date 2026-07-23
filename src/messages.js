const { pool } = require('./db');
const evolution = require('./evolution');

const VALID_STATUSES = new Set(['draft', 'scheduled', 'sent', 'failed']);
const EDITABLE_STATUSES = new Set(['draft', 'scheduled']);

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      text TEXT,
      image_base64 TEXT,
      image_mimetype TEXT,
      status TEXT NOT NULL,
      scheduled_for TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      error TEXT,
      created_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function validateContent({ text, image }) {
  if (!(text && text.trim()) && !image) {
    throw new Error('escreva um texto ou anexe uma imagem');
  }
}

async function createMessage({ text, image, status, scheduledFor, createdBy }) {
  validateContent({ text, image });

  if (status === 'scheduled' && !scheduledFor) {
    throw new Error('informe a data/hora do agendamento');
  }
  if (!VALID_STATUSES.has(status) || status === 'sent' || status === 'failed') {
    throw new Error('status inicial inválido');
  }

  const result = await pool.query(
    `INSERT INTO messages (text, image_base64, image_mimetype, status, scheduled_for, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      text || null,
      image ? image.base64 : null,
      image ? image.mimetype : null,
      status,
      status === 'scheduled' ? scheduledFor : null,
      createdBy || null,
    ]
  );

  const message = result.rows[0];

  if (status === 'draft') return message;

  // status === 'scheduled' já foi persistido; o disparo em si acontece via
  // deliverMessage (chamado direto pela rota /send ou pelo scheduler.js).
  return message;
}

async function getMessage(id) {
  const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function listMessages({ status } = {}) {
  const query = status
    ? { text: 'SELECT * FROM messages WHERE status = $1 ORDER BY created_at DESC', values: [status] }
    : { text: 'SELECT * FROM messages ORDER BY created_at DESC', values: [] };

  const result = await pool.query(query);
  return result.rows;
}

async function getDueScheduledMessages() {
  const result = await pool.query(
    `SELECT * FROM messages WHERE status = 'scheduled' AND scheduled_for <= now()`
  );
  return result.rows;
}

async function updateMessage(id, { text, image, scheduledFor }) {
  const existing = await getMessage(id);
  if (!existing) throw new Error('mensagem não encontrada');
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new Error('só é possível editar rascunhos ou mensagens agendadas ainda não enviadas');
  }

  validateContent({
    text: text !== undefined ? text : existing.text,
    image: image || (existing.image_base64 ? { base64: existing.image_base64 } : null),
  });

  const result = await pool.query(
    `UPDATE messages SET
       text = COALESCE($2, text),
       image_base64 = COALESCE($3, image_base64),
       image_mimetype = COALESCE($4, image_mimetype),
       scheduled_for = CASE WHEN status = 'scheduled' THEN COALESCE($5, scheduled_for) ELSE scheduled_for END,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, text ?? null, image ? image.base64 : null, image ? image.mimetype : null, scheduledFor || null]
  );

  return result.rows[0];
}

async function deleteMessage(id) {
  const existing = await getMessage(id);
  if (!existing) throw new Error('mensagem não encontrada');
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new Error('só é possível excluir rascunhos ou mensagens agendadas ainda não enviadas');
  }

  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
}

/**
 * Envia de fato pra Evolution API e grava o resultado. Usado tanto pelo
 * envio manual (rota /send) quanto pelo scheduler.js para as agendadas
 * vencidas — um único lugar decide como o envio acontece e como o
 * status/erro é registrado.
 */
async function deliverMessage(message) {
  try {
    if (message.image_base64) {
      await evolution.sendGroupMedia({
        text: message.text || '',
        imageBase64: message.image_base64,
        mimetype: message.image_mimetype,
      });
    } else {
      await evolution.sendGroupText(message.text);
    }

    const result = await pool.query(
      `UPDATE messages SET status = 'sent', sent_at = now(), error = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [message.id]
    );
    return result.rows[0];
  } catch (err) {
    const result = await pool.query(
      `UPDATE messages SET status = 'failed', error = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [message.id, err.message]
    );
    return result.rows[0];
  }
}

async function getStats() {
  const result = await pool.query(`
    SELECT status, COUNT(*)::int AS count FROM messages GROUP BY status
  `);
  const stats = { draft: 0, scheduled: 0, sent: 0, failed: 0 };
  for (const row of result.rows) stats[row.status] = row.count;
  return stats;
}

module.exports = {
  ensureSchema,
  createMessage,
  getMessage,
  listMessages,
  getDueScheduledMessages,
  updateMessage,
  deleteMessage,
  deliverMessage,
  getStats,
};
