<script lang="ts">
  // O dia de uma pessoa: saudação com a frase do momento, os dois lado a lado,
  // a garrafa que enche (com botões de um toque) e a linha do dia com as
  // refeições do plano e as de fora dele, cada uma com a sua cor.
  import { ChevronLeft, ChevronRight, GlassWater, CupSoda, Plus, Clock, Flame, Utensils, Check, RotateCw, Pencil } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { estado } from '../lib/estado.svelte';
  import EscolhaPessoa from '../lib/EscolhaPessoa.svelte';
  import Garrafa from '../lib/Garrafa.svelte';
  import Icone from '../lib/Icone.svelte';
  import { nomeDoDia, somarDias, dataLonga, diasEntre } from '../../shared/datas';
  import { nomeDaRefeicao, SEM_DETALHES } from '../../shared/tipos';
  import { oDeSempre } from '../../shared/sugestoes';
  import { horaAgora } from '../../shared/datas';
  import { aguaDoDia, porcentagem, formatarMl, ritmoAgua, linhaDoTempo, kcalDoDia, sequenciaCasal, type ItemLinha } from '../../shared/resumo';
  import { saudacao, fraseDoMomento } from '../../shared/momento';

  let { dia }: { dia: string } = $props();

  let carregando = $state(false);
  $effect(() => {
    const d = dia;
    if (estado.de && d < estado.de) {
      carregando = true;
      estado.garantir(d).catch((e) => estado.erro(e)).finally(() => (carregando = false));
    }
  });

  const p = $derived(estado.pessoa);
  const eu = $derived(estado.pessoas.find((x) => x.id === estado.eu));
  const ehHoje = $derived(dia === estado.relogio.dia);
  const ontem = $derived(somarDias(dia, -1));
  const amanha = $derived(somarDias(dia, 1));

  const tomado = $derived(p ? aguaDoDia(estado.agua, p.id, dia) : 0);
  const pct = $derived(p ? porcentagem(tomado, p.meta_agua_ml) : 0);
  const falta = $derived(p ? Math.max(0, p.meta_agua_ml - tomado) : 0);
  const ritmo = $derived(p && ehHoje ? ritmoAgua(tomado, p.meta_agua_ml, estado.relogio.hora) : null);

  const linha = $derived(
    p ? linhaDoTempo(estado.horarios, estado.refeicoes, p.id, dia, estado.relogio.dia, estado.relogio.hora) : [],
  );
  const kcal = $derived(p ? kcalDoDia(estado.refeicoes, p.id, dia) : { total: 0, registradas: 0 });
  const mostrarKcal = $derived(!!p && (p.meta_kcal !== null || kcal.registradas > 0));
  const feitas = $derived(linha.filter((l) => l.previsto && l.estado === 'feita').length);
  const doPlano = $derived(linha.filter((l) => l.previsto).length);

  // Sequência do casal: dias seguidos em que os dois bateram a meta.
  const casal = $derived(sequenciaCasal(estado.pessoas, estado.agua, estado.relogio.dia));

  const ola = $derived(saudacao(estado.relogio.hora));
  const emoji = $derived(ola === 'Bom dia' ? '☀️' : ola === 'Boa tarde' ? '🌤️' : '🌙');
  const frase = $derived.by(() => {
    if (!p || !ehHoje) return dataLonga(dia);
    const f = fraseDoMomento({
      linha, agora: estado.relogio.hora, tomado, meta: p.meta_agua_ml, ritmo: ritmo?.diferenca ?? null, copo: p.copo_ml,
    });
    // Olhando o dia do outro: diz de quem é.
    return p.id === estado.eu ? f : `${p.nome}: ${f.charAt(0).toLowerCase()}${f.slice(1)}`;
  });

  // Animações: bolhas a cada copo novo; festa ao cruzar a meta. Só quando a
  // água da MESMA pessoa no MESMO dia sobe (trocar de pessoa não anima).
  let respingo = $state(0);
  let festa = $state(false);
  let anterior: { chave: string; ml: number } | null = null;
  let timerFesta: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const chave = `${p?.id}:${dia}`;
    const ml = tomado;
    const meta = p?.meta_agua_ml ?? 0;
    untrack(() => {
      if (anterior && anterior.chave === chave && ml > anterior.ml) {
        respingo++;
        if (anterior.ml < meta && ml >= meta) {
          festa = true;
          clearTimeout(timerFesta);
          timerFesta = setTimeout(() => (festa = false), 2600);
          navigator.vibrate?.([30, 60, 30, 60, 60]);
        } else {
          navigator.vibrate?.(15);
        }
      }
      anterior = { chave, ml };
    });
  });

  function registrar(l: ItemLinha) {
    if (!p) return;
    // Num dia passado, sugere o horário do plano; hoje, a hora de agora.
    estado.gaveta = { tipo: 'nova', dia, pessoa_id: p.id, refeicao: l.tipo, hora: ehHoje ? undefined : l.previsto ?? undefined };
  }

  // Um toque: "o de sempre" ou "só marcar", sem abrir o formulário.
  // A hora é a de agora quando é a próxima refeição de hoje; se já passou do
  // horário (ou é outro dia), é a do plano, que é quando a pessoa deve ter comido.
  let ocupado = $state(false);
  async function rapido(l: ItemLinha, descricao: string) {
    if (!p || ocupado) return;
    ocupado = true;
    const hora = l.estado === 'proxima' || !l.previsto ? horaAgora() : l.previsto;
    await estado.registrarRapido(p.id, dia, hora, l.tipo, descricao);
    ocupado = false;
  }

  const ROTULO: Record<ItemLinha['estado'], string> = {
    feita: 'Feita',
    atrasada: 'Passou do horário',
    proxima: 'Próxima',
    mais_tarde: 'Mais tarde',
    nao_registrada: 'Não registrada',
  };

  // "9 de novembro", junto de "Hoje" e "Ontem".
  const diaCurtoExtenso = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  const GOTAS = Array.from({ length: 14 }, (_, i) => ({ angulo: (i / 14) * 360, distancia: 70 + (i % 3) * 18, atraso: (i % 4) * 40 }));
</script>

<header class="ola">
  <div class="ola-texto">
    <h2>{ola}{eu ? `, ${eu.nome}` : ''}! <span aria-hidden="true">{emoji}</span></h2>
    <p>{frase}</p>
  </div>
  <a class="casal" class:juntos={casal.faltam_hoje.length === 0} href="#historico"
    aria-label="Sequência do casal: {casal.dias} {casal.dias === 1 ? 'dia' : 'dias'} seguidos com os dois batendo a meta de água">
    <span class="avatares" aria-hidden="true">
      {#each estado.pessoas as x (x.id)}
        <span class="avatar cor-{x.cor}">{x.nome.slice(0, 1).toUpperCase()}</span>
      {/each}
    </span>
    {#if casal.dias > 0}
      <span class="juntos-dias num" aria-hidden="true"><Flame size={12} /> {casal.dias} {casal.dias === 1 ? 'dia' : 'dias'}</span>
    {/if}
  </a>
</header>

<nav class="dias" aria-label="Escolher o dia">
  <a class="seta" href="#hoje/{ontem}" aria-label="Dia anterior"><ChevronLeft size={20} /></a>
  <div class="dia">
    <strong>{nomeDoDia(dia, estado.relogio.dia)}</strong>
    {#if diasEntre(dia, estado.relogio.dia) <= 1}<span class="data">{diaCurtoExtenso(dia)}</span>{/if}
    {#if !ehHoje}<a class="link" href="#hoje">Voltar para hoje</a>{/if}
  </div>
  {#if ehHoje}
    <span class="seta vazia" aria-hidden="true"></span>
  {:else}
    <a class="seta" href="#hoje/{amanha}" aria-label="Dia seguinte"><ChevronRight size={20} /></a>
  {/if}
</nav>

<EscolhaPessoa {dia} />

{#if !p}
  <p class="cartao vazio">Escolha de quem é o dia.</p>
{:else if carregando}
  <p class="vazio">Carregando esse dia…</p>
{:else}
  <section class="heroi" aria-labelledby="titulo-agua">
    <div class="topo-heroi">
      <button class="garrafa" onclick={() => estado.beber(p.id, dia, p.copo_ml)} aria-label="Tomar um copo de {formatarMl(p.copo_ml)}">
        <Garrafa {pct} {respingo} tipo={p.recipiente} cor={p.cor} />
        {#if festa}
          <span class="festa" aria-hidden="true">
            {#each GOTAS as g, i (i)}
              <i style:--angulo="{g.angulo}deg" style:--distancia="{g.distancia}px" style:animation-delay="{g.atraso}ms"></i>
            {/each}
          </span>
        {/if}
      </button>

      <div class="info">
        <p class="rotulo" id="titulo-agua"><GlassWater size={16} /> Água {ehHoje ? 'hoje' : 'no dia'}</p>
        <p class="grande num" class:ouro={pct >= 100}>{formatarMl(tomado)}</p>
        <p class="de num">de {formatarMl(p.meta_agua_ml)} · {pct}%</p>
        {#if festa}
          <p class="parabens" role="status">Meta batida! 🎉</p>
        {:else if pct >= 100}
          <p class="nota forte">Meta batida{ehHoje ? ' hoje' : ''}. 💧</p>
        {:else}
          <p class="nota">Faltam {formatarMl(falta)}</p>
          {#if ritmo}
            <p class="nota">
              {ritmo.diferenca >= 0 ? 'No ritmo até as 22h' : `${formatarMl(-ritmo.diferenca)} atrás do ritmo`}
            </p>
          {/if}
        {/if}
      </div>
    </div>

    <div class="beber">
      <button class="botao-agua" onclick={() => estado.beber(p.id, dia, p.copo_ml)}>
        <GlassWater size={20} /> <span>Copo<small class="num">{formatarMl(p.copo_ml)}</small></span>
      </button>
      <button class="botao-agua" onclick={() => estado.beber(p.id, dia, p.garrafa_ml)}>
        <CupSoda size={20} /> <span>Garrafa<small class="num">{formatarMl(p.garrafa_ml)}</small></span>
      </button>
      <button class="botao-agua" onclick={() => (estado.gaveta = { tipo: 'agua', dia, pessoa_id: p.id })}>
        <Plus size={20} /> <span>Outro<small>valor</small></span>
      </button>
    </div>
  </section>

  {#if mostrarKcal}
    <div class="cartao kcal">
      <span class="icone-refeicao ref-lanche_tarde"><Flame size={20} /></span>
      <div class="kcal-texto">
        <p><strong class="num">{kcal.total.toLocaleString('pt-BR')} kcal</strong>{#if p.meta_kcal} <span class="meta num">de {p.meta_kcal.toLocaleString('pt-BR')}</span>{/if}</p>
        <p class="meta">{kcal.registradas === 0 ? 'Nenhuma refeição com calorias' : `Somando ${kcal.registradas} ${kcal.registradas === 1 ? 'refeição' : 'refeições'} com calorias`}</p>
      </div>
      {#if p.meta_kcal}
        <div class="barra kcal-barra" aria-hidden="true"><i style:width="{Math.min(100, porcentagem(kcal.total, p.meta_kcal))}%"></i></div>
      {/if}
    </div>
  {/if}

  <section class="cartao refeicoes" aria-labelledby="titulo-refeicoes">
    <div class="cab-cartao">
      <span class="icone-refeicao ref-almoco"><Utensils size={20} /></span>
      <div>
        <h2 id="titulo-refeicoes">Refeições</h2>
        <p>{ehHoje ? (p.id === estado.eu ? 'O seu dia até agora' : `O dia de ${p.nome} até agora`) : 'O que foi registrado'}</p>
      </div>
      {#if doPlano}
        <div class="direita">
          <p class="contagem num"><strong>{feitas}</strong> de {doPlano}</p>
          <p>do plano</p>
        </div>
      {/if}
    </div>

    {#if linha.length === 0}
      <p class="vazio">
        Nada registrado {ehHoje ? 'ainda hoje' : 'nesse dia'}. Toque em <strong>+</strong> para lançar uma refeição,
        ou monte o plano de horários em <a href="#ajustes">Ajustes</a>.
      </p>
    {:else}
      <ol class="linha">
        {#each linha as l (l.tipo + l.hora + (l.refeicoes[0]?.id ?? ''))}
          <li class={l.estado}>
            <span class="hora num">{l.hora}</span>
            <span class="marcador">
              <span class="icone-refeicao {l.estado === 'feita' ? `ref-${l.tipo}` : 'pendente'}"><Icone tipo={l.tipo} /></span>
            </span>
            <div class="corpo">
              <div class="topo-item">
                <strong>{nomeDaRefeicao(l.tipo)}</strong>
                {#if l.estado !== 'feita'}
                  <span class="selo {l.estado}">{ROTULO[l.estado]}</span>
                {:else if l.previsto && l.refeicoes[0].hora !== l.previsto}
                  <span class="previsto num"><Clock size={12} /> previsto {l.previsto}</span>
                {/if}
              </div>
              {#if l.refeicoes.length}
                {#each l.refeicoes as r (r.id)}
                  <button class="comida" onclick={() => (estado.gaveta = { tipo: 'editar', refeicao: r })}>
                    <span class:sem-detalhes={r.descricao === SEM_DETALHES}>{r.descricao === SEM_DETALHES ? 'Sem detalhes. Toque para contar o que comeu.' : r.descricao}</span>
                    {#if l.refeicoes.length > 1 || r.kcal}
                      <small class="num">{#if l.refeicoes.length > 1}{r.hora}{/if}{#if l.refeicoes.length > 1 && r.kcal} · {/if}{#if r.kcal}{r.kcal} kcal{/if}</small>
                    {/if}
                  </button>
                {/each}
              {:else}
                {#if l.estado === 'mais_tarde'}
                  <button class="link" onclick={() => registrar(l)}>Registrar {nomeDaRefeicao(l.tipo).toLowerCase()}</button>
                {:else}
                  {@const sempre = oDeSempre(estado.refeicoes, p.id, l.tipo)}
                  <div class="rapidos">
                    {#if sempre}
                      <button class="rapido principal" disabled={ocupado} onclick={() => rapido(l, sempre)} aria-label="Registrar o de sempre: {sempre}">
                        <RotateCw size={15} /> <span>{sempre}</span>
                      </button>
                    {/if}
                    <button class="rapido" disabled={ocupado} onclick={() => rapido(l, SEM_DETALHES)} aria-label="Só marcar {nomeDaRefeicao(l.tipo).toLowerCase()} como feito">
                      <Check size={15} /> Só marcar
                    </button>
                    <button class="rapido" onclick={() => registrar(l)} aria-label="Escrever o que comeu no {nomeDaRefeicao(l.tipo).toLowerCase()}">
                      <Pencil size={15} /> Escrever
                    </button>
                  </div>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}

<style>
  /* ---------- saudação ---------- */
  .ola { display: flex; align-items: center; justify-content: space-between; gap: var(--esp-3); margin: var(--esp-1) 0 var(--esp-4); }
  .ola-texto { min-width: 0; }
  .ola h2 { font-size: var(--fs-600); font-weight: var(--fw-bold); letter-spacing: -0.02em; line-height: 1.2; }
  .ola p { margin-top: 2px; font-size: var(--fs-300); color: var(--texto-2); }
  .casal { flex: none; display: grid; justify-items: center; gap: 2px; text-decoration: none; }
  .avatares { display: flex; padding: 2px; border-radius: 999px; border: 2px solid transparent; transition: border-color var(--mov); }
  /* Os dois bateram a meta hoje: aro dourado em volta das iniciais. */
  .juntos .avatares { border-color: var(--ouro); }
  .avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid var(--fundo);
    background: var(--p);
    color: var(--p-sobre);
    font-weight: var(--fw-bold);
  }
  .avatar + .avatar { margin-left: -12px; }
  .juntos-dias {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--ouro-suave);
    color: var(--ouro-texto);
    font-size: var(--fs-100);
    font-weight: var(--fw-semi);
  }

  /* ---------- dia ---------- */
  .dias {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    margin-bottom: var(--esp-3);
    padding: 2px;
    border-radius: 999px;
    background: var(--superficie-2);
  }
  .seta { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; color: var(--texto-2); }
  a.seta:hover { background: var(--superficie); }
  .dia { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 0 var(--esp-2); text-align: center; }
  .dia strong { font-size: var(--fs-300); }
  .dia .data { font-size: var(--fs-300); color: var(--texto-3); }
  .dia .link { padding: 0; font-size: var(--fs-200); }

  /* ---------- água ---------- */
  .heroi {
    position: relative;
    margin-top: var(--esp-4);
    display: grid;
    gap: var(--esp-4);
    padding: var(--esp-5);
    border-radius: 22px;
    background:
      radial-gradient(120% 80% at 0% 0%, rgb(143 208 255 / 0.28) 0%, transparent 60%),
      var(--heroi);
    color: #fff;
    box-shadow: var(--sombra-alta);
    overflow: hidden;
  }
  .topo-heroi { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: var(--esp-5); }
  .garrafa {
    position: relative;
    width: 112px;
    height: 190px;
    padding: 0;
    border: 0;
    background: none;
    transition: transform var(--mov);
  }
  .garrafa:active { transform: scale(0.96); }
  .info { display: grid; gap: 2px; min-width: 0; }
  .rotulo { display: flex; align-items: center; gap: 6px; font-size: var(--fs-100); font-weight: var(--fw-semi); letter-spacing: 0.06em; text-transform: uppercase; color: rgb(255 255 255 / 0.88); }
  .grande { font-size: 2.75rem; font-weight: var(--fw-bold); color: var(--agua-clara); line-height: 1.05; letter-spacing: -0.03em; margin-top: var(--esp-1); }
  .grande.ouro { color: var(--ouro-claro); }
  .de { font-size: var(--fs-400); font-weight: var(--fw-medium); color: rgb(255 255 255 / 0.9); margin-bottom: var(--esp-2); }
  .nota { font-size: var(--fs-200); color: rgb(255 255 255 / 0.88); }
  .nota.forte, .parabens { font-weight: var(--fw-semi); color: #fff; }
  .parabens { font-size: var(--fs-500); animation: pulo 600ms cubic-bezier(0.2, 1.6, 0.4, 1); }

  .beber { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--esp-2); }
  .botao-agua {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--esp-2);
    min-height: 56px;
    padding: var(--esp-2);
    border: 0;
    border-radius: var(--r-btn);
    background: var(--superficie);
    color: var(--agua);
    font-weight: var(--fw-semi);
    box-shadow: 0 4px 12px rgb(10 40 70 / 0.18);
    transition: transform var(--mov), background var(--mov);
  }
  .botao-agua:hover { background: var(--agua-suave); }
  .botao-agua:active { transform: scale(0.95); }
  .botao-agua :global(svg) { flex: none; }
  .botao-agua span { display: grid; line-height: 1.15; text-align: left; font-size: var(--fs-300); }
  .botao-agua small { font-size: var(--fs-100); font-weight: var(--fw-medium); color: var(--texto-3); }

  /* gotas que saem da garrafa ao bater a meta */
  .festa { position: absolute; left: 50%; top: 45%; pointer-events: none; }
  .festa i {
    position: absolute;
    width: 10px;
    height: 13px;
    margin: -6px 0 0 -5px;
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: #cdeaff;
    opacity: 0;
    animation: gota 1200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }
  .festa i:nth-child(3n) { background: #ffffff; }
  .festa i:nth-child(2n) { background: var(--ouro-claro); }

  @keyframes gota {
    0% { opacity: 1; transform: rotate(var(--angulo)) translateY(0) scale(0.4); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: rotate(var(--angulo)) translateY(calc(-1 * var(--distancia))) scale(1); }
  }
  @keyframes pulo { from { transform: scale(0.6); opacity: 0; } }

  /* ---------- calorias ---------- */
  .kcal { display: flex; flex-wrap: wrap; align-items: center; gap: var(--esp-3); margin-top: var(--esp-4); }
  .kcal-texto { flex: 1; min-width: 0; }
  .meta { font-size: var(--fs-200); color: var(--texto-3); }
  .kcal-barra { flex-basis: 100%; }
  .kcal-barra > i { background: var(--kcal); }

  /* ---------- refeições ---------- */
  .refeicoes { margin-top: var(--esp-5); padding-bottom: var(--esp-2); }
  .contagem { font-size: var(--fs-300); color: var(--texto-2); }
  .contagem strong { font-size: var(--fs-500); color: var(--texto); }

  .linha { list-style: none; margin: 0; padding: 0; }
  .linha li { display: grid; grid-template-columns: 3em 40px 1fr; gap: var(--esp-3); align-items: start; padding-bottom: var(--esp-4); }
  .hora { padding-top: 10px; font-size: var(--fs-200); font-weight: var(--fw-semi); color: var(--texto-2); text-align: right; }
  li:not(.feita) .hora { color: var(--texto-3); font-weight: var(--fw-medium); }

  /* a linha vertical que liga uma refeição à seguinte */
  .marcador { position: relative; display: grid; justify-items: center; align-self: stretch; }
  li:not(:last-child) .marcador::after {
    content: '';
    position: absolute;
    top: 44px;
    bottom: calc(-1 * var(--esp-4) + 4px);
    left: 50%;
    width: 2px;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--borda);
  }
  li.feita:not(:last-child) .marcador::after { background: var(--linha-feita); }

  .icone-refeicao.pendente { background: var(--superficie); color: var(--texto-3); box-shadow: inset 0 0 0 1.5px var(--borda); }
  .atrasada .icone-refeicao.pendente { background: var(--alerta-suave); color: var(--alerta); box-shadow: none; }
  .proxima .icone-refeicao.pendente { background: var(--agua-suave); color: var(--agua); box-shadow: inset 0 0 0 1.5px var(--agua); }

  /* minmax(0, 1fr): sem isso um texto comprido sem quebra alarga a coluna e vaza do cartão. */
  .corpo { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; padding-top: 2px; }
  .topo-item { display: flex; flex-wrap: wrap; align-items: center; gap: var(--esp-2); min-height: 24px; }
  .previsto { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-100); color: var(--texto-3); }
  .comida {
    display: grid;
    gap: 1px;
    width: 100%;
    padding: var(--esp-2) var(--esp-3);
    margin-top: var(--esp-1);
    border: 0;
    border-radius: var(--r-1);
    background: var(--fundo);
    text-align: left;
    color: var(--texto-2);
    font-size: var(--fs-300);
    transition: background var(--mov);
  }
  .comida:hover { background: var(--superficie-2); }
  .comida span { overflow-wrap: anywhere; }
  .comida small { font-size: var(--fs-100); color: var(--texto-3); }
  .corpo .link { justify-self: start; padding: 2px 0; }
  .sem-detalhes { color: var(--texto-3); font-style: italic; }
  .rapidos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--esp-1); }
  .rapido {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 40px;
    min-width: 0;
    max-width: 100%;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--borda);
    background: var(--superficie);
    color: var(--texto-2);
    font-size: var(--fs-200);
    font-weight: var(--fw-medium);
    transition: background var(--mov), transform var(--mov);
  }
  .rapido:active { transform: scale(0.97); }
  .rapido:hover:not(:disabled) { background: var(--superficie-2); }
  .rapido:disabled { opacity: 0.6; }
  .rapido :global(svg) { flex: none; }
  .rapido.principal { flex: 1 1 100%; justify-content: flex-start; font-size: var(--fs-300); background: var(--marca-suave); border-color: transparent; color: var(--marca); font-weight: var(--fw-semi); }
  .rapido.principal span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nao_registrada strong, .mais_tarde strong { color: var(--texto-2); font-weight: var(--fw-medium); }

  @media (max-width: 380px) {
    .topo-heroi { grid-template-columns: 92px 1fr; gap: var(--esp-4); }
    .garrafa { width: 92px; height: 156px; }
    .grande { font-size: var(--fs-800); }
  }
</style>
