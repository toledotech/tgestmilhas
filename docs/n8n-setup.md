# Configurando o n8n para usar o scraper de milhas

## 1. Subir o scraper na VPS

```bash
git clone <este repositório> TGestMilhas
cd TGestMilhas
docker network ls   # confirme o nome da rede onde o n8n já roda
```

Edite `docker-compose.yml` e ajuste `networks.n8n_network` para o nome real
da rede do seu n8n (ex: `n8n_default`, `root_default`, etc. — depende de como
o n8n foi instalado). Depois:

```bash
docker compose up -d --build
docker compose logs -f milhas-scraper   # deve mostrar "rodando em http://localhost:3000"
```

Teste de dentro da VPS:

```bash
curl "http://localhost:3000/search?program=smiles&origin=GRU&destination=MIA&date=2026-12-15"
```

## 2. Evolution API (envio do WhatsApp)

Se você ainda não tem uma instância da Evolution API rodando na VPS:

1. Suba o container da Evolution API na mesma rede Docker do n8n (ver
   [documentação oficial](https://doc.evolution-api.com/)).
2. Crie uma instância (`SEU_INSTANCE_NAME`) e conecte via QR code:
   `POST /instance/create` e depois `GET /instance/connect/SEU_INSTANCE_NAME`.
3. Guarde a `apikey` gerada.

## 3. Importar o workflow no n8n

1. Abra o n8n → menu (⋮) → **Import from File** → selecione `n8n/workflow.json`.
2. No node **Buscar voos**, ajuste `origin`, `destination`, `date` e `program`
   para a rota que você quer monitorar (pode duplicar o fluxo para várias rotas).
3. No node **Filtrar ofertas baratas**, ajuste os limites de milhas/taxa.
4. No node **Enviar WhatsApp (Evolution API)**:
   - troque `SEU_INSTANCE_NAME` pelo nome da sua instância
   - troque `SUA_API_KEY_EVOLUTION` pela apikey (idealmente como *credential*
     do n8n, não hardcoded — use "Header Auth" credential em vez do valor fixo)
   - troque `55SEUNUMERO` pelo seu número com DDI+DDD
5. Ative o workflow e rode **Execute Workflow** manualmente uma vez para
   confirmar que a mensagem chega no seu WhatsApp.

## 4. Ajuste dos scrapers (importante)

Os scrapers em `src/scrapers/*.js` foram construídos com seletores
validados manualmente contra os sites reais, mas sites de milhas mudam
layout com frequência e têm proteção anti-bot. Se o `/search` passar a
retornar `errors` para algum programa:

1. Rode localmente com `PLAYWRIGHT_HEADLESS=false npm run dev` para ver o
   navegador interagindo e identificar onde o fluxo quebrou.
2. Ajuste os seletores no scraper correspondente.
3. O scraper da **Smiles** é o único validado ponta a ponta até o passo de
   preencher origem/destino; o clique na sugestão do autocomplete é o trecho
   mais frágil (revalide antes de confiar 100% nos resultados).
