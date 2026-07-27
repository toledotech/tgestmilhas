# TGestMilhas — Monitor de Passagens com Milhas

Serviço de scraping (Playwright) que consulta Smiles, LATAM Pass e TudoAzul
em busca de passagens com milhas, exposto via HTTP para ser consumido por um
workflow no n8n (agendamento, filtro de ofertas e alerta via WhatsApp). Inclui
também uma landing page de captura de leads para o grupo gratuito (Fase 2 da
estratégia de monetização).

## Landing page (captura de leads)

`public/index.html` — formulário de email + perfil de viajante, salvo via
`POST /api/leads` na tabela `leads` do Postgres (`DATABASE_URL`). Ao
cadastrar, mostra o link do grupo gratuito definido em `FREE_GROUP_URL`
(`.env`) — troque pelo link real assim que o grupo (WhatsApp ou Telegram)
existir.

```bash
npm run dev
# abra http://localhost:3000
```

## Painel admin (`/admin`)

Painel protegido por login (múltiplos usuários) para:
- ver a lista de leads capturados
- escrever e disparar uma mensagem (texto + imagem opcional) direto pro
  grupo do WhatsApp, via Evolution API

### Setup

1. **Banco**: `DATABASE_URL` já configurada (mesma do `/api/leads`) — as
   tabelas `admin_users` e `admin_sessions` são criadas automaticamente.
2. **Primeiro admin**: defina `ADMIN_BOOTSTRAP_USER` e
   `ADMIN_BOOTSTRAP_PASSWORD` no `.env` antes do primeiro deploy — se a
   tabela `admin_users` estiver vazia, esse usuário é criado no startup.
   Depois disso, use o próprio painel (seção "Adicionar administrador") pra
   cadastrar outros — essas duas variáveis não têm mais efeito depois que o
   primeiro usuário existe.
3. **Sessão**: defina `SESSION_SECRET` com uma string aleatória longa.
4. **Evolution API — instância dedicada**: **não reaproveite** uma instância
   de WhatsApp que já seja usada para atendimento do negócio. Crie uma nova
   instância só para o grupo do Alerta de Milhas:
   ```bash
   curl -X POST http://<evolution-api>/instance/create \
     -H "Content-Type: application/json" -H "apikey: <API_KEY>" \
     -d '{"instanceName": "alertademilhas", "qrcode": true}'
   ```
   Escaneie o QR code retornado com o número dedicado. Adicione esse número
   como participante do grupo gratuito, depois busque o JID do grupo:
   ```bash
   curl -H "apikey: <API_KEY>" \
     http://<evolution-api>/group/fetchAllGroups/alertademilhas?getParticipants=false
   ```
   Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` e
   `WHATSAPP_GROUP_JID` no `.env` com os valores encontrados.

Login em `/admin/login`; sem sessão válida, `/admin` e `/api/admin/*`
redirecionam/retornam 401.

## Rodando localmente (scraper)

```bash
npm install       # instala deps e baixa o Chromium do Playwright
cp .env.example .env
npm run dev
```

```bash
curl "http://localhost:3000/search?origin=GRU&destination=MIA&date=2026-12-15&program=smiles"
```

`program` é opcional e aceita uma lista separada por vírgula
(`smiles,latampass,tudoazul`); se omitido, busca em todos.

Resposta:

```json
{
  "flights": [
    { "program": "smiles", "origin": "GRU", "destination": "MIA", "date": "2026-12-15", "miles": 12000, "taxes": 89, "flightNumber": "G3 1234", "link": "https://..." }
  ],
  "errors": [
    { "program": "latampass", "message": "timeout após 45000ms" }
  ]
}
```

## Deploy na VPS (junto com o n8n)

Ver [docs/n8n-setup.md](docs/n8n-setup.md) — cobre subir o container, a
Evolution API e importar o workflow pronto em `n8n/workflow.json`.

## Status da busca (Smiles / LATAM Pass / TudoAzul)

Depois de investir bastante em scraping direto (Playwright) e esbarrar em
bot-detection avançado (tipo Akamai/DataDome — ver histórico de commits pra
detalhes), migramos Smiles e TudoAzul pra **API da seats.aero**
(`src/seatsAero.js` + `src/scrapers/seatsAeroScraper.js`), que já entrega
esses dados sem precisar brigar com o site. Configure `SEATS_AERO_API_KEY`
no `.env` — sem ela, `/search?program=smiles` e `program=tudoazul` retornam
erro controlado (`SEATS_AERO_API_KEY não configurada`).

- **Smiles** e **TudoAzul**: via seats.aero (`source: smiles` e `source:
  azul`). Cliente escrito e pronto (`src/seatsAero.js`), mas **ainda não
  testado contra a API real** — não tínhamos a chave no momento em que foi
  implementado. A forma dos campos (`Trips`, `YMileageCost` etc.) segue
  exatamente a documentação oficial
  ([Concepts](https://developers.seats.aero/reference/concepts-copy),
  [Cached Search](https://developers.seats.aero/reference/cached-search)) —
  validar assim que a chave estiver configurada.
- **LATAM Pass**: **não é suportado pela seats.aero** (confirmado na lista
  oficial de sources da documentação). Continua via scraper Playwright em
  `src/scrapers/latampass.js`, que preenche origem/destino/data mas ainda
  não confirma o botão de submit final via clique programático — não
  revalidado com o stealth plugin ainda.
- Acesso à API da seats.aero exige aprovação comercial pra esse caso de uso
  (não é liberado no self-serve do plano Pro) — pedido em andamento, ver
  [docs/seats-aero-email-draft.md](docs/seats-aero-email-draft.md).

Os scrapers antigos de Smiles/TudoAzul via Playwright (`src/scrapers/
smiles.js`, `src/scrapers/tudoazul.js`) foram mantidos no repositório como
referência da investigação de bot-detection, mas não são mais usados em
produção (`server.js` não os importa mais).

Para depurar o scraper da LATAM Pass, rode com o navegador visível:

```bash
PLAYWRIGHT_HEADLESS=false npm run dev
```
