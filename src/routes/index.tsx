import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Serve a landing page estática (public/landing.html) tal como está —
// não foi reescrita em React de propósito, pra não arriscar a UI de
// captura de leads que já está validada em produção.
async function loadLandingHtml() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  // src/routes -> raiz do projeto -> public/landing.html
  const filePath = path.join(dir, "..", "..", "public", "landing.html");
  return readFile(filePath, "utf8");
}

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () => {
        const html = await loadLandingHtml();
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});
