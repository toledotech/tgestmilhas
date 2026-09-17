# TGestMilhas — Alerta de Milhas

Landing page de captura de leads + painel admin, na mesma stack dos outros
produtos ToledoTech: **Vite + TanStack Start (React 19) + TanStack Router/Query
+ Supabase (Auth + Postgres) + Tailwind 4 + `@toledotech/tgest-ui`**.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha as chaves do Supabase e da Evolution API
npm run dev
# abra http://localhost:3000
```

## Landing page (captura de leads)

`public/landing.html` — mantida como HTML estático (não foi reescrita em
React de propósito, pra não arriscar a UI de captura já validada em
produção). Servida pela rota `/` ([src/routes/index.tsx](src/routes/index.tsx)),
que só lê o arquivo do disco. O formulário chama `POST /api/leads`
([src/routes/api/leads.ts](src/routes/api/leads.ts)), que grava na tabela
`leads` do Supabase e responde com o link do grupo (`FREE_GROUP_URL`).

## Painel admin (`/app`)

- **Login** (`/entrar`) via Supabase Auth — e-mail + senha.
- **Mensagens** (`/app`) — criar/editar/excluir rascunhos e agendamentos,
  enviar na hora pro grupo do WhatsApp via Evolution API.
- **Leads** (`/app/leads`) — lista os leads capturados na landing.
- **Usuários** (`/app/usuarios`) — adicionar/remover administradores
  (cria usuário no Supabase Auth).

Toda rota sob `/app` é protegida por um guard em
[src/routes/app.tsx](src/routes/app.tsx) que redireciona pra `/entrar` se
não houver sessão Supabase válida.

### Setup do Supabase

1. Crie (ou reutilize) um projeto Supabase — pegue `Project URL`,
   `anon key` e `service_role key` em **Project Settings → API**.
2. As tabelas `leads`, `messages` e `admin_users` já existem (foram criadas
   quando o projeto ainda usava Postgres cru) — só ajuste `admin_users`
   pra remover a coluna de senha (autenticação agora é via Supabase Auth,
   não mais bcrypt local).
3. Crie o primeiro administrador em **Authentication → Users → Add user**
   (ou pela própria tela `/app/usuarios` depois de ter pelo menos um admin
   criado manualmente uma vez) e insira a linha correspondente em
   `admin_users` (`id` = UUID do usuário criado, `email`, `name`).

### Envio agendado de mensagens

Não tem mais `setInterval` rodando dentro do processo — o disparo das
mensagens agendadas vencidas é a rota
[src/routes/api/cron/send-scheduled-messages.ts](src/routes/api/cron/send-scheduled-messages.ts),
protegida pelo header `x-cron-secret` (comparado a `CRON_SECRET`). Configure
um workflow no n8n (que já roda na mesma VPS) com:

- **Schedule Trigger** — a cada 1 minuto
- **HTTP Request** — `GET https://seu-dominio/api/cron/send-scheduled-messages`
  com o header `x-cron-secret: <CRON_SECRET>`

### Evolution API — instância dedicada

**Não reaproveite** uma instância de WhatsApp já usada pra atendimento do
negócio. Crie uma instância só pro grupo do Alerta de Milhas:

```bash
curl -X POST http://<evolution-api>/instance/create \
  -H "Content-Type: application/json" -H "apikey: <API_KEY>" \
  -d '{"instanceName": "alertademilhas", "qrcode": true}'
```

Escaneie o QR code com o número dedicado, adicione esse número no grupo
gratuito e busque o JID do grupo:

```bash
curl -H "apikey: <API_KEY>" \
  http://<evolution-api>/group/fetchAllGroups/alertademilhas?getParticipants=false
```

Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` e
`WHATSAPP_GROUP_JID` no `.env`.

## Deploy na VPS

Build via Docker (`oven/bun`), publicado no GHCR e deploy via SSH —
ver `.github/workflows/docker.yml` do TGestCRM como referência de pipeline.
Localmente:

```bash
docker compose up -d --build
docker compose logs -f tgestmilhas
```

O `docker-compose.yml` já está apontando pra rede `easypanel-curso` (mesma
onde rodam `curso_evolution-api`, `curso_n8n` e `curso_bancodedados`).
