import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/refresh-explore")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET não configurado", { status: 500 });
        }
        const supplied =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          new URL(request.url).searchParams.get("secret");
        if (supplied !== secret) {
          return new Response("unauthorized", { status: 401 });
        }

        try {
          const { refreshExploreDestinations } = await import("@/lib/explore.server");
          const results = await refreshExploreDestinations();
          return new Response(JSON.stringify({ ok: true, ...results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
