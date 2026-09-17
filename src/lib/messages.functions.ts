import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMessagesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const messages = await import("@/lib/messages.server");
    return { messages: await messages.listMessages(), stats: await messages.getStats() };
  });

const imageSchema = z.object({ base64: z.string(), mimetype: z.string() }).nullish();

export const createMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      text: z.string().nullish(),
      image: imageSchema,
      status: z.enum(["draft", "scheduled", "send_now"]),
      scheduledFor: z.string().nullish(),
    })
  )
  .handler(async ({ data, context }) => {
    const messages = await import("@/lib/messages.server");
    const requestedStatus = data.status === "send_now" ? "draft" : data.status;
    let message = await messages.createMessage({
      text: data.text,
      image: data.image,
      status: requestedStatus,
      scheduledFor: data.scheduledFor,
      createdBy: context.userId,
    });
    if (data.status === "send_now") {
      message = await messages.deliverMessage(message);
    }
    return { message };
  });

export const updateMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.number(),
      text: z.string().nullish(),
      image: imageSchema,
      status: z.enum(["draft", "scheduled"]).optional(),
      scheduledFor: z.string().nullish(),
    })
  )
  .handler(async ({ data }) => {
    const messages = await import("@/lib/messages.server");
    const message = await messages.updateMessage(data.id, {
      text: data.text,
      image: data.image,
      status: data.status,
      scheduledFor: data.scheduledFor,
    });
    return { message };
  });

export const deleteMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const messages = await import("@/lib/messages.server");
    await messages.deleteMessage(data.id);
    return { ok: true };
  });

export const sendMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const messages = await import("@/lib/messages.server");
    const existing = await messages.getMessage(data.id);
    if (!existing) throw new Error("mensagem não encontrada");
    if (existing.status === "sent") throw new Error("essa mensagem já foi enviada");
    const message = await messages.deliverMessage(existing);
    return { message };
  });
