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

## Status dos scrapers

**Causa raiz identificada** (depois de várias rodadas de investigação): os
três sites sempre funcionavam em teste manual (navegador comum) e sempre
falhavam rodando via Playwright — o padrão consistente era o autocomplete de
origem/destino nunca retornar sugestões quando controlado por automação.
Confirmado ao vivo na Smiles: `navigator.webdriver` é `false` num navegador
normal e `true` por padrão no Chromium controlado pelo Playwright — o site
provavelmente usa isso (ou fingerprinting mais sofisticado) para silenciar
respostas de autocomplete de sessões automatizadas, sem bloquear a página em
si (por isso a digitação sempre "funcionava", mas a sugestão nunca aparecia).

Mitigação aplicada em `src/scrapers/base.js` (`createStealthPage`) +
`playwright-extra` com `puppeteer-extra-plugin-stealth` no lançamento do
browser (`src/server.js`) — mascara `navigator.webdriver`, plugins,
languages e outros sinais comuns de detecção. **Testado ao vivo e não foi
suficiente pra Smiles nem TudoAzul** — o autocomplete continua não
retornando sugestões mesmo com essa camada, o que sugere uma proteção mais
robusta (tipo Akamai/DataDome/PerimeterX), não só a checagem simples de
`navigator.webdriver`. Contornar esse tipo de proteção de forma confiável
normalmente exige investimento adicional significativo (proxies
residenciais, browsers "undetectable" como patchright, rotação de
fingerprint) — pode não valer a pena para o volume desse projeto.

**Recomendação**: dado esse teto de investigação, a rota de scraping direto
tem retorno decrescente a partir daqui. Vale reconsiderar as APIs pagas
mencionadas na fase de planejamento (ex: apidevoos.dev, BuscaMilhas) como
caminho mais rápido para ter a busca funcionando de verdade — ver histórico
de decisão no início do projeto.

- **Smiles**: autocomplete nunca retorna sugestões via Playwright (mesmo com
  stealth). Fluxo de UI (popup, expandir buscador, abrir calendário) está
  todo mapeado e correto em `src/scrapers/smiles.js` — só falta essa camada
  de detecção ser contornada, se optarem por continuar tentando.
- **LATAM Pass**: chega a preencher origem/destino/datas, mas o botão de
  submit final não confirma a busca via clique programático (framework
  parece exigir um evento "confiável"). Não testado ainda com o stealth
  plugin — pode valer revalidar antes de descartar.
- **TudoAzul**: mesmo padrão da Smiles — autocomplete não retorna sugestão
  via Playwright, mesmo com stealth. É a que tinha chegado mais longe
  (chegou a navegar pra página de resultados em teste manual).

Para depurar, rode com o navegador visível e logging extra:

```bash
PLAYWRIGHT_HEADLESS=false SCRAPER_DEBUG=1 npm run dev
```
