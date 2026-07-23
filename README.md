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

Sites de milhas são SPAs com proteção anti-bot e mudam layout com frequência
— os seletores em `src/scrapers/*.js` foram validados manualmente contra os
sites reais, mas quebram sem aviso. Antes de confiar em produção:

- **Smiles**: em progresso, ainda não fecha ponta a ponta de forma confiável.
  Validado ao vivo e funcionando: fechamento do popup promocional, abertura
  do buscador, digitação real disparando o autocomplete. Identificamos (e
  corrigimos) uma causa raiz real: o **movimento do mouse do Playwright**
  passando sobre o header dispara submenus de navegação por hover que
  sobrepõem o buscador — a correção foi trocar todos os cliques desse fluxo
  por `elemento.evaluate(el => el.click())` (clique via JS, sem mover o
  cursor), o que eliminou a interceptação em testes manuais isolados.
  Porém, ao rodar a MESMA função através da classe `SmilesScraper` (não como
  script solto), a seleção do autocomplete voltou a falhar de forma
  consistente (3/3 execuções), enquanto um script standalone com a lógica
  idêntica funcionou. Não identifiquei ainda por que o comportamento difere
  entre os dois — hipótese mais provável é rate limiting/anti-bot da própria
  Smiles depois de muitas requisições automatizadas seguidas vindas do mesmo
  IP/sessão durante os testes de hoje (não é algo que o código controla).
  `selectDate` (navegação de mês no calendário) e a extração dos cards de
  resultado (`[data-testid="flight-card"]`) ainda não foram exercitados de
  ponta a ponta porque o fluxo trava antes de chegar neles. Próximo passo:
  testar novamente depois de um tempo (para descartar rate limiting) e, se
  persistir, comparar passo a passo a execução via classe vs. script solto
  com logging extra.
- **LATAM Pass**: validado ao vivo até a seleção de origem, destino, data de
  ida e data de volta no widget (tudo funcionando via clique JS sem mover o
  mouse). Confirmado também que a URL direta com `?origin=&destination=...`
  **não funciona** para busca com milhas — `redemption=true` redireciona
  para login, então o scraper precisa interagir com o widget mesmo. O que
  falta: o botão de submit final não confirma a busca via clique JS (o
  aria-label continua "Sem campos preenchidos" mesmo com tudo selecionado),
  possivelmente porque o framework exige um evento de clique "confiável"
  (`isTrusted`) nesse ponto específico — ao contrário da Smiles, onde era o
  oposto (mouse real atrapalhava). Precisa de mais uma rodada de teste ao
  vivo combinando as duas abordagens.
- **TudoAzul**: a que chegou mais longe das três. Validado ao vivo ponta a
  ponta manualmente: popup de cookies, autocomplete de origem/destino (usa
  `role="option"` limpo, mais fácil que Smiles/LATAM), calendário via
  `data-date="AAAA-MM-DD"` nos botões de dia (também mais simples — sem
  precisar de aria-label com nome de mês por extenso), e o clique em "Buscar
  passagens" **navegou de verdade** para a página de resultados com
  origin/destination/data corretos na URL — nenhuma das outras duas chegou
  nesse ponto. A página de resultados carregada no teste manual não mostrou
  nenhum card de voo, mas mesmo depois de codificar a mesma lógica em
  `TudoAzulScraper`, o autocomplete de origem já falha antes de chegar lá
  ("campo Origem não encontrado") — mesmo padrão dos outros dois: funciona
  no teste manual ao vivo, mas falha ao rodar via classe/script. Ainda não
  investigado a fundo (suspeita segue sendo timing/rate-limiting, não lógica
  errada).

Para depurar, rode com o navegador visível:

```bash
PLAYWRIGHT_HEADLESS=false npm run dev
```
