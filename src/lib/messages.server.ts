const VALID_STATUSES = new Set(["draft", "scheduled", "sent", "failed"]);
const EDITABLE_STATUSES = new Set(["draft", "scheduled"]);

type Image = { base64: string; mimetype: string } | null;

function validateContent({ text, image }: { text?: string | null; image?: Image }) {
  if (!(text && text.trim()) && !image) {
    throw new Error("escreva um texto ou anexe uma imagem");
  }
}

export async function createMessage({
  text,
  image,
  status,
  scheduledFor,
  createdBy,
}: {
  text?: string | null;
  image?: Image;
  status: string;
  scheduledFor?: string | null;
  createdBy?: string | null;
}) {
  validateContent({ text, image });

  if (status === "scheduled" && !scheduledFor) {
    throw new Error("informe a data/hora do agendamento");
  }
  if (!VALID_STATUSES.has(status) || status === "sent" || status === "failed") {
    throw new Error("status inicial inválido");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      text: text || null,
      image_base64: image ? image.base64 : null,
      image_mimetype: image ? image.mimetype : null,
      status: status as "draft" | "scheduled",
      scheduled_for: status === "scheduled" ? scheduledFor : null,
      created_by: createdBy || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getMessage(id: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("messages").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listMessages({ status }: { status?: "draft" | "scheduled" | "sent" | "failed" } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin.from("messages").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getDueScheduledMessages() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString());
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMessage(
  id: number,
  { text, image, status, scheduledFor }: { text?: string | null; image?: Image; status?: string; scheduledFor?: string | null }
) {
  const existing = await getMessage(id);
  if (!existing) throw new Error("mensagem não encontrada");
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("só é possível editar rascunhos ou mensagens agendadas ainda não enviadas");
  }

  validateContent({
    text: text !== undefined ? text : existing.text,
    image: image || (existing.image_base64 ? { base64: existing.image_base64, mimetype: existing.image_mimetype || "" } : null),
  });

  const newStatus = status && EDITABLE_STATUSES.has(status) ? status : existing.status;
  if (newStatus === "scheduled" && !scheduledFor && !existing.scheduled_for) {
    throw new Error("informe a data/hora do agendamento");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("messages")
    .update({
      text: text ?? existing.text,
      image_base64: image ? image.base64 : existing.image_base64,
      image_mimetype: image ? image.mimetype : existing.image_mimetype,
      status: newStatus as "draft" | "scheduled",
      scheduled_for: newStatus === "scheduled" ? scheduledFor || existing.scheduled_for : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMessage(id: number) {
  const existing = await getMessage(id);
  if (!existing) throw new Error("mensagem não encontrada");
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new Error("só é possível excluir rascunhos ou mensagens agendadas ainda não enviadas");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Envia de fato pra Evolution API e grava o resultado. Usado tanto pelo
 * envio manual quanto pela rota de cron pras agendadas vencidas — um único
 * lugar decide como o envio acontece e como o status/erro é registrado.
 */
export async function deliverMessage(message: {
  id: number;
  text: string | null;
  image_base64: string | null;
  image_mimetype: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const evolution = await import("@/lib/evolution.server");

  try {
    if (message.image_base64) {
      await evolution.sendGroupMedia({
        text: message.text || "",
        imageBase64: message.image_base64,
        mimetype: message.image_mimetype,
      });
    } else {
      await evolution.sendGroupText(message.text || "");
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() })
      .eq("id", message.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    const message_ = err instanceof Error ? err.message : String(err);
    const { data, error } = await supabaseAdmin
      .from("messages")
      .update({ status: "failed", error: message_, updated_at: new Date().toISOString() })
      .eq("id", message.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function getStats() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("messages").select("status");
  if (error) throw new Error(error.message);

  const stats = { draft: 0, scheduled: 0, sent: 0, failed: 0 };
  for (const row of data || []) {
    stats[row.status as keyof typeof stats]++;
  }
  return stats;
}
