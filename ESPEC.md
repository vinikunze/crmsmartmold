# em dia. — água e alimentação do casal (especificação)

Pedido da Sophia ao Vini em 09/11/2026: "algum site pra mim cuidar da minha
alimentação, quantidade de água no dia". Feito no mesmo estilo do `nossoap`
e do app de finanças. Este arquivo é a referência; o que não está aqui ainda
não foi decidido.

## Em uma frase

Um app só do Vini e da Sophia para acompanhar **quanta água tomaram** e **o
que comeram, a que horas**, contra metas e um plano de horários que cada um
define.

## Quem usa

- Só os dois. Cada um tem o **próprio login** e os **próprios dados** (água,
  refeições, metas, plano), mas um vê e pode lançar no dia do outro.
- Ao abrir, o app mostra o dia de quem está logado; dá para trocar com um
  toque (Vini / Sophia), e cada botão já mostra o % de água da pessoa.

## Água

- **Meta do dia** em ml (padrão 2 L). Em Ajustes, informando o peso, o app
  sugere 35 ml por quilo (entre 1,5 L e 4 L), com o aviso de confirmar com
  médico ou nutricionista em casos especiais.
- **Um toque**: botões "Copo" (padrão 250 ml) e "Garrafa" (500 ml), com
  tamanhos ajustáveis; "Outro" abre um valor livre e a lista do dia para
  apagar enganos. Todo copo tem "Desfazer" no aviso.
- **Ritmo**: hoje, o app diz se está no ritmo para bater a meta até as 22h ou
  quantos ml está atrás.

## Refeições

| Campo | Obrigatório | Observação |
|---|---|---|
| De quem | sim | Vini, Sophia ou **Os dois** (cria uma para cada) |
| Refeição | sim | Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar, Ceia, Outro. Vem escolhida pela hora |
| Dia e horário | sim | Agora, por padrão. Dá para lançar dias passados |
| O que comeu | sim | Texto livre, até 300 caracteres. Sugestões "Repetir" com o que a pessoa mais come naquela refeição |
| Calorias | não | Para quem quiser contar |
| Observação | não | "comi com pressa", "sem fome"… |

## Plano de horários

- Cada um marca quais refeições fazem parte do dia e o horário de cada uma
  (padrão: café 7h30, almoço 12h, lanche 16h, jantar 20h).
- No dia, as refeições do plano aparecem mesmo antes de serem registradas:
  **Próxima**, **Mais tarde**, **Passou do horário** (1 h depois sem
  registro) ou, em dia passado, **Não registrada**. Registrada mostra a hora
  real e "previsto 12:00" quando foi em outro horário.

## Calorias (opcional)

Meta de calorias liga/desliga em Ajustes. Sem meta, o total do dia só aparece
quando alguma refeição tiver calorias.

## Telas

Barra inferior no celular, barra lateral no computador (com a água dos dois
sempre à vista).

1. **Hoje**: setas para o dia anterior/seguinte, troca de pessoa, cartão da
   água com os botões, calorias (se usar) e a linha do tempo das refeições.
2. **Histórico** (7 ou 30 dias): dias seguidos batendo a água, média de água,
   dias com a meta, % das refeições do plano registradas, gráfico de água por
   dia com a linha da meta, e a lista dia a dia (tocar abre o dia).
3. **Ajustes**: nome, metas, tamanhos dos botões, plano de horários,
   calorias, conta.

Botão **+** sempre visível para lançar refeição. As gavetas sobem de baixo no
celular e abrem de lado no computador, como nos outros apps.

## Visual

**Verde-folha e azul-água** sobre branco esverdeado, tema claro único, no
mesmo sistema do `nossoap` (Inter, cartões, gavetas). Verde é ação e
refeições; azul é água; laranja só para "passou do horário"; o ponto do logo
é amarelo-sol. Todos os textos passam de 4,5:1.

## Visual da tela Hoje, versão 2 (pedido do Vini, 09/11/2026)

Para ter a mesma cara caprichada dos outros dois apps (a maquete 3D do
`nossoap`, a saudação e os ícones coloridos do app de finanças):

- **Garrafa que enche** no lugar da barra: água com ondas, sobe com animação
  a cada copo (com bolhinhas). Tocar na garrafa toma um copo. Ao bater a meta,
  gotas saem da garrafa, aparece "Meta batida! 🎉" e o celular vibra (Android;
  o iPhone não deixa site vibrar).
- **Saudação**: "Bom dia/Boa tarde/Boa noite, Vini!" com as iniciais dos dois
  (Vini azul, Sophia rosa, como no app de finanças) e a **frase do momento**,
  nesta ordem: refeição que passou do horário, quantos copos para entrar no
  ritmo, próxima refeição em até 1 h, meta batida, próxima refeição, quanto
  falta. Olhando o dia do outro, a frase começa com o nome dele.
- **Os dois lado a lado**: cada botão de pessoa tem uma garrafinha com a água
  do dia e o %.
- **Linha do dia**: as refeições ligadas por uma linha vertical, cada uma com
  a sua cor (café âmbar, lanche da manhã mostarda, almoço verde, lanche da
  tarde laranja, jantar roxo, ceia anil, outro rosa). Pendente fica sem cor;
  próxima em azul; atrasada em laranja. As mesmas cores nos ícones do
  formulário.
- **Barra de baixo**: Hoje · **+** (no meio, não cobre mais nada da tela) ·
  Histórico. Ajustes virou a engrenagem no topo.
- Todas as cores novas conferidas: ícones a 4:1 ou mais no fundo deles,
  branco sobre as cores das pessoas a 5:1 ou mais.

### Segunda rodada (10/11/2026)

- **Histórico** abre com a **sequência** em destaque: chama acesa, "N dias
  seguidos" e o **recorde** ("seu recorde!" quando empata). Se hoje ainda
  não bateu, convida: "Bata hoje para virar N+1!".
- **Calendário de gotinhas** do mês (domingo primeiro): gota cheia = bateu a
  meta, pela metade = 50% ou mais, quase vazia = um pouco, vazia = nada. Hoje
  tem contorno azul; dias futuros apagados. Setas trocam de mês (o mês antigo
  é buscado no servidor). Tocar num dia abre ele.
- Médias logo abaixo, com 7/30 dias; barras do gráfico em degradê da própria
  cor da água, e a linha da meta explicada numa legenda embaixo (o rótulo em
  cima das barras tapava a última).
- **Tema escuro** azul-noite. Ajustes → Aparência: Automático (segue o
  celular, padrão), Claro ou Escuro, guardado no aparelho. O `index.html`
  aplica o tema antes de desenhar, para não piscar claro. No escuro o verde
  e o azul ficam claros e o texto dos botões verdes fica escuro. Todas as
  cores do escuro conferidas: textos a 5:1 ou mais, ícones de refeição a 6:1.
- As cores que estavam fixas nos componentes (aviso, dica do gráfico, linha
  do dia, barra de calorias, véu da gaveta) viraram variáveis do tema.

### Terceira rodada: a cara do casal (10/11/2026)

A partir do que o Vini pediu nos outros apps (dourado como marca, objetos
desenhados como os de verdade, tudo como "nós", telas enxutas):

- **Dourado é a cor de conquista**, e só disso: meta batida (tampa da
  garrafa dourada com brilhos, número grande dourado, gota dourada no
  calendário, ✓ dourado no botão da pessoa), sequências e troféu, e o ponto
  do logo. Verde continua sendo ação, azul água, laranja só "passou do
  horário". Mesmos tons de dourado do `nossoap`.
- **Tema escuro virou azul-marinho com dourado**, como o `nossoap`.
- **Cada um escolhe a sua garrafa** (Ajustes → "A garrafa de…"): formato
  (garrafa, squeeze, copo térmico, garrafão) e cor (azul, rosa, verde, roxo,
  laranja, grafite). A cor pinta a tampa e os detalhes da garrafa e a inicial
  da pessoa. Padrão: Vini garrafa azul, Sophia rosa. Migração
  `0002_garrafa.sql` (`pessoas.recipiente`, `pessoas.cor`). Um pode mudar a
  do outro, como o resto dos ajustes.
- **Sequência do casal**: dias seguidos em que **os dois** bateram a própria
  meta de água, com a mesma regra da individual (hoje em andamento não
  zera). Aparece como etiqueta dourada embaixo das iniciais na tela Hoje
  (toque leva ao Histórico; aro dourado nas iniciais quando os dois já
  bateram hoje) e num cartão no Histórico, que diz quem falta hoje.

Ainda na fila: "Como foi a semana", medalhas, foto no lugar das iniciais.

### Lembrar e registrar sem esforço (10/11/2026)

O uso real dos dois primeiros dias (7 registros de água, só 3 refeições,
nenhuma caloria) mostrou onde estava o atrito.

- **Lembretes no calendário do celular** (Ajustes → "Lembretes no celular"):
  o app gera um arquivo `.ics` com eventos que se repetem **todo dia**, cada
  um com o aviso na hora (`VALARM`): as refeições do plano salvo e a água de
  1 em 1, 2 em 2 ou 3 em 3 horas, das 8h às 20h. Quem avisa é o calendário
  do celular. Mesmo molde do app de finanças: `GET
  /api/pessoas/:id/lembretes.ics`, servido `inline` (no iPhone abre direto
  "Adicionar ao calendário"), horários em UTC (Brasília é UTC−3 fixo).
  Cada lembrete tem sempre o mesmo `UID`: adicionar de novo depois de mudar
  um horário atualiza em vez de duplicar. Trocar o intervalo da água ou tirar
  uma refeição do plano **não apaga** os lembretes antigos: isso é feito no
  calendário. Não é assinatura automática, pelo mesmo motivo do app de
  finanças (precisaria de um endereço sem login).
- **Registrar refeição com um toque**: refeição do plano ainda sem registro
  (próxima, atrasada ou de um dia passado) mostra **o de sempre** (o que a
  pessoa mais come naquela refeição), **Só marcar** e **Escrever**. Hora:
  agora, se é a próxima de hoje; a do plano, se já passou do horário ou é
  outro dia. Todos têm "Desfazer" no aviso.
- **Só marcar** grava a descrição fixa `Sem detalhes` (a coluna é
  obrigatória): a tela mostra apagado, com "toque para contar o que comeu";
  abrir traz o campo vazio; e ela não entra nas sugestões de "Repetir".
- **Calorias somem do formulário** para quem não ligou a meta de calorias em
  Ajustes (continuam aparecendo ao editar uma refeição que já tem).

## Infraestrutura

Igual ao `nossoap`: Worker + D1 + Access, plano gratuito, site embutido no
Worker. Banco `em-dia` criado em 09/11/2026. Os limites gratuitos são por
conta e divididos com `nosso-ap`, `financas-casal` e `crmsmartmold-db`; dois
usuários registrando água e refeições ficam milhares de vezes abaixo.

## Fora do escopo (por enquanto)

- Notificações ("hora de beber água", "hora do almoço"): precisam de service
  worker, que hoje briga com o login do Access.
- Peso ao longo do tempo, medidas, gráfico de calorias.
- Foto do prato.
- Tabela de alimentos / cálculo automático de calorias.
- Integração com os outros apps.

## Pendências

- **Vini, na Cloudflare**: importar o repositório no Workers Builds e ligar o
  Access (passos no README). O banco já está pronto.
- Em 09/11/2026 o Vini apagou o CRM da Smart Mold que morava neste
  repositório (continua só no histórico do git) e o renomeou de
  `crmsmartmold` para `emdia`. O Worker na Cloudflare também se chama
  `emdia`: o nome no `wrangler.jsonc` precisa ser igual, senão a publicação
  automática falha (aconteceu na primeira tentativa, com `em-dia`).
