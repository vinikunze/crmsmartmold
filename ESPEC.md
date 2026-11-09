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
