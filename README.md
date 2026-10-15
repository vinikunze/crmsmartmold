# CRM Smart Mold

CRM integrado à landing page [smartmoldbrasil.com.br](https://smartmoldbrasil.com.br): recebe os leads do formulário, classifica cada contato em **Lead A, B ou C** e acompanha a oportunidade num pipeline comercial.

Roda inteiro na Cloudflare: **Worker** (API + painel) e banco **D1** (`crmsmartmold-db`).

## Funcionalidades

- **Entrada de leads** pelo formulário do site (`POST /api/public/leads`, JSON ou formulário HTML), com proteção anti-robô (campo isca), limite por IP e CORS restrito ao domínio do site. Contatos repetidos (mesmo e-mail ou telefone) atualizam o lead em aberto em vez de duplicar.
- **Qualificação A/B/C** por pontuação (0–100) com base em volume da obra, perfil do cliente, prazo de compra e região atendida — regras em [`src/criteria.ts`](src/criteria.ts). Opcionalmente, a **IA (Claude)** lê todas as respostas e refina a classificação com uma justificativa.
- **Pipeline** com 10 etapas: Novo lead → Em contato → Call agendada → Call realizada → Visita técnica → Follow-up → Proposta enviada → Negociação → Ganho / Perdido (com motivo da perda). Quadro com arrastar-e-soltar.
- **Busca e filtros** por nome, cidade, e-mail, telefone, categoria, etapa, cidade, origem, responsável e período; **exportação CSV** (abre direto no Excel).
- **Ficha do lead**: respostas originais, motivo da classificação, responsável, valor estimado, histórico e anotações, atalhos para WhatsApp/ligação/e-mail.
- **Login** com senha provisória e troca obrigatória no 1º acesso, bloqueio após 5 tentativas (15 min), limite por IP, sessões em cookie `HttpOnly`/`SameSite=Strict`, proteção CSRF.
- **Usuários e papéis**: o administrador convida pessoas (senha provisória), define papel (**Administrador** ou **Vendedor**), redefine senha, desbloqueia, desativa ou remove. Áreas de usuários, integrações e exclusão de leads são restritas a administradores.
- **Integrações por webhook** (Hotmart, RD Station, Typeform, Elementor, Zapier…): gera a URL, recebe um evento de teste, permite **mapear** os campos recebidos para os campos do CRM, definir a etapa de entrada e **condições** (ex.: `data.purchase.status = APPROVED` → Ganho) e reprocessar eventos para validar.

## Meta Ads (Facebook e Instagram)

- **Receber leads** dos formulários instantâneos: webhook em `/api/meta/webhook` (verificação `hub.challenge`, assinatura `X-Hub-Signature-256`, deduplicação). O CRM busca os dados do lead na Graph API, classifica e guarda campanha, conjunto e anúncio de origem.
- **API de Conversões**: envia ao Pixel `Lead A/B/C` após a classificação, o nome da etapa a cada avanço no funil e `Purchase` (com o valor estimado) em Ganho. Usa `lead_id` da Meta quando o lead veio de lá, e e-mail/telefone/nome/cidade com hash SHA-256.
- Status, URL do webhook, botão de teste e histórico ficam em **Integrações → Meta Ads**.

Configuração (secrets do Worker; o `META_PIXEL_ID` já está no `wrangler.jsonc`):

| Secret | O que é |
|---|---|
| `META_APP_SECRET` | Chave secreta do app (developers.facebook.com → Configurações do app → Básico) |
| `META_VERIFY_TOKEN` | Texto qualquer escolhido por você; o mesmo vai no cadastro do webhook na Meta |
| `META_PAGE_TOKEN` | Token permanente da página (usuário do sistema com `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`) |
| `META_CAPI_TOKEN` | Token da API de Conversões (Gerenciador de Eventos → pixel → Configurações) |

## Estrutura

```
src/             Worker (API)
  index.ts       rotas, formulário público, CSRF/CORS
  criteria.ts    etapas do pipeline e critérios A/B/C  ← ajuste aqui
  mapping.ts     nomes de campo aceitos e mapeamento de webhooks
  ai.ts          classificação com Claude (opcional)
  auth.ts        login, sessões, bloqueio, senhas
  leads.ts       leads, filtros, CSV, painel
  users.ts       gestão de usuários
  integrations.ts webhooks
  meta.ts        Meta Lead Ads + API de Conversões
  schema.ts      atualizações automáticas do banco
public/          painel web (HTML/CSS/JS, sem build)
migrations/      esquema do banco D1
scripts/criar-admin.mjs  cria/redefine um administrador
test/            testes das regras de classificação e mapeamento
```

## Desenvolvimento

```bash
npm install
npm run db:migrate:local
node scripts/criar-admin.mjs voce@empresa.com "Seu Nome" --local   # mostra a senha provisória
npm run dev          # http://localhost:8787
npm test             # testes
npm run typecheck
```

## Publicação

```bash
npm run db:migrate:remote      # aplica o esquema no D1 de produção (idempotente)
npm run deploy                 # publica o Worker "crmsmartmold"
```

Configurações em [`wrangler.jsonc`](wrangler.jsonc):

- `ALLOWED_ORIGINS` — domínios que podem enviar o formulário via JavaScript.
- `AI_MODEL` — modelo usado na classificação por IA.
- Secret `ANTHROPIC_API_KEY` (opcional) — ativa a classificação por IA: `npx wrangler secret put ANTHROPIC_API_KEY`.

## Conectando o formulário do site

No painel, menu **Formulário do site**, há o endereço de envio e um formulário HTML pronto para colar na landing page. Os campos reconhecidos são `nome`, `telefone`/`whatsapp`, `email`, `cidade`, `uf`, `perfil`, `produto`, `tipo_obra`, `volume`/`metragem`/`quantidade`, `prazo`, `mensagem` e `utm_*` (os nomes do Elementor, como `form_fields[name]`, também funcionam). Há ainda uma página de teste em `/formulario-exemplo.html`.

## Segurança antes de usar com dados reais

- Troque a senha provisória no primeiro acesso e crie um usuário por pessoa.
- Considere colocar o painel atrás do **Cloudflare Access** (Zero Trust) para uma segunda camada de proteção.
- A URL de cada webhook funciona como senha: gere uma nova se ela vazar.
- Os dados ficam no D1 da sua conta Cloudflare; exporte CSV periodicamente como backup.
