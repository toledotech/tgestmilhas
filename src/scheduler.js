const messages = require('./messages');

const CHECK_INTERVAL_MS = 60 * 1000;

async function runDueMessages() {
  let due;
  try {
    due = await messages.getDueScheduledMessages();
  } catch (err) {
    console.error('scheduler: falha ao buscar mensagens agendadas:', err.message);
    return;
  }

  for (const message of due) {
    const result = await messages.deliverMessage(message);
    if (result.status === 'sent') {
      console.log(`scheduler: mensagem #${message.id} enviada.`);
    } else {
      console.error(`scheduler: falha ao enviar mensagem #${message.id}: ${result.error}`);
    }
  }
}

function startScheduler() {
  setInterval(() => {
    runDueMessages().catch((err) => console.error('scheduler: erro inesperado:', err.message));
  }, CHECK_INTERVAL_MS);
  console.log('Scheduler de mensagens agendadas iniciado (verifica a cada 60s).');
}

module.exports = { startScheduler, runDueMessages };
