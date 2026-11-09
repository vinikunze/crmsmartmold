# em dia.

Água e alimentação do Vini e da Sophia: meta de água do dia, o que comeram
em cada refeição, horários planejados e o histórico. App privado, só para os
dois.

Especificação e decisões: [`ESPEC.md`](ESPEC.md). Telas de exemplo (com
dados de teste): [`telas-exemplo/`](telas-exemplo).

Mesmo desenho do `nossoap` e do app de finanças (`assessor-do-casal/app`):
tudo na Cloudflare, plano gratuito. Um **Worker** serve o site (Svelte) e a
API (`worker/index.ts`), o banco é **D1** e o login é o **Access** na frente
de tudo.

## Pastas

| Pasta | O que tem |
|---|---|
| `shared/` | Lógica pura, usada pela tela e pela API: datas no horário de Brasília, água do dia e ritmo, linha do tempo das refeições, histórico e sequência, sugestões |
| `worker/` | API. Confere o login, valida tudo, grava no D1 |
| `src/` | Telas (Svelte 5): Hoje, Histórico, Ajustes e as gavetas de refeição e água |
| `migrations/` | Estrutura do banco |
| `tests/` | Testes da lógica (`npm test`) |
| `scripts/testar-api.mjs` | 36 verificações da API contra o servidor local |
| `scripts/embutir.mjs` | Embute o site dentro do Worker no `npm run build` (mesmo do `nossoap`) |

## Rodar no computador

```bash
npm install
npm run db:local        # cria o banco de teste em .wrangler/
npm run dev             # http://localhost:5173 — já "logado" como o Vini
node scripts/testar-api.mjs   # com o dev rodando
npm test                # lógica pura
npm run check           # tipos
```

O login é simulado pelo bloco `access.dev` do `wrangler.jsonc`, que só vale
no computador.

## Publicar

Banco D1 `em-dia` (`5c6d87af-a9f0-48cc-ade5-435062042c9f`, região ENAM) **já
criado**, com a migração `0001` aplicada e registrada em `d1_migrations`.
Endereço previsto: **https://em-dia.vinihkunze.workers.dev**.

Passos no painel da Cloudflare (iguais aos do `nossoap`):

1. **Workers & Pages → Create → Import a repository** → este repositório.
   Raiz: a pasta deste app (`em-dia/` enquanto ele morar aqui; `/` se for
   para um repositório próprio). Build: `npm run build`. Deploy:
   `npx wrangler deploy`. Cada push na branch de produção publica.
2. **Access**: na aba Access do Worker (ou Zero Trust → Access →
   Applications → Self-hosted), domínio `em-dia.vinihkunze.workers.dev`,
   política "Allow" com os dois e-mails, login por código no e-mail
   (One-time PIN).
3. Abrir no celular e **Adicionar à tela de início**.

Sem o passo 2 o site abre, mas a API recusa tudo (não há login), então nenhum
dado fica exposto.

**Mudança no banco** não é aplicada pelo deploy. Crie
`migrations/000N_nome.sql` e aplique no remoto (MCP da Cloudflare ou
`npm run db:remote`). Ao aplicar pelo MCP, registre também em `d1_migrations`.

## Decisões que não são óbvias

- **O dia é o de Brasília, decidido no aparelho.** O app manda `dia`
  (AAAA-MM-DD) e `hora` (HH:MM) de cada registro. O copo das 23h50 não cai no
  dia seguinte por causa do UTC do servidor. A API recusa dia depois de
  amanhã e mais de dois anos atrás.
- **Água em ml inteiros**; na tela, `750 ml` ou `1,25 L`.
- **`chave` gerada no aparelho** em cada registro: se a rede cair e o app
  reenviar, o banco devolve o que já existe em vez de duplicar (como no
  `nossoap`). "Os dois" usa uma chave por pessoa.
- **Os dois podem lançar e editar para os dois.** Quem lançou fica em
  `criado_por`, mas não aparece. Ajustes de um também podem ser feitos pelo
  outro.
- **Ritmo da água**: o ideal é ir tomando aos poucos das 7h às 22h. "Atrás do
  ritmo" compara o que tomou com essa reta, de 50 em 50 ml.
- **Refeição atrasada**: do plano, sem registro, 1 hora depois do horário.
  Num dia que já passou, vira "não registrada" (sem alarme).
- **Histórico usa a meta de hoje** para dizer se bateu a água em dias
  passados (a meta não é guardada por dia). Médias contam só os dias que já
  terminaram.
- **Sequência não zera durante o dia**: se hoje ainda não bateu, conta até
  ontem.
- **Resumo calculado no aparelho**: ao abrir vêm os últimos 35 dias numa
  chamada só (`/api/dados`). Dia mais antigo é buscado quando alguém abre.
- **Sem service worker e sem notificações**, pelo mesmo motivo dos outros
  apps: o Access redireciona para o login, e cache offline no meio disso dá
  tela em branco. Notificação no celular precisaria de service worker.
- **A API confere o e-mail de novo** (`EMAILS_PERMITIDOS`), além do Access.
