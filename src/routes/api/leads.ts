import { createFileRoute } from "@tanstack/react-router";

const FREE_GROUP_URL = process.env.FREE_GROUP_URL || "https://chat.whatsapp.com/SEU_LINK_AQUI";

export const Route = createFileRoute("/api/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { saveLead } = await import("@/lib/leads.server");
          await saveLead(body || {});
          return new Response(JSON.stringify({ groupUrl: FREE_GROUP_URL }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
