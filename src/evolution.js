/**
 * Cliente mínimo da Evolution API (v2) para disparo de mensagens no grupo
 * do WhatsApp. Usa a instância dedicada configurada em EVOLUTION_INSTANCE —
 * nunca a instância de atendimento do negócio.
 */

function config() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const groupJid = process.env.WHATSAPP_GROUP_JID;

  if (!baseUrl || !apiKey || !instance || !groupJid) {
    throw new Error(
      'Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, WHATSAPP_GROUP_JID)'
    );
  }

  return { baseUrl, apiKey, instance, groupJid };
}

async function sendGroupText(text) {
  const { baseUrl, apiKey, instance, groupJid } = config();

  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: groupJid, text }),
  });

  if (!res.ok) {
    throw new Error(`Evolution API respondeu ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function sendGroupMedia({ text, imageBase64, mimetype }) {
  const { baseUrl, apiKey, instance, groupJid } = config();

  const res = await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({
      number: groupJid,
      mediatype: 'image',
      mimetype,
      media: imageBase64,
      caption: text || '',
    }),
  });

  if (!res.ok) {
    throw new Error(`Evolution API respondeu ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

module.exports = { sendGroupText, sendGroupMedia };
