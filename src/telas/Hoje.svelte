<script lang="ts">
  // O dia de uma pessoa: água (com botões de um toque) e as refeições, as do
  // plano de horários e as de fora dele, em ordem de hora.
  import { ChevronLeft, ChevronRight, GlassWater, CupSoda, Plus, Clock, Check, Flame } from '@lucide/svelte';
  import { estado } from '../lib/estado.svelte';
  import EscolhaPessoa from '../lib/EscolhaPessoa.svelte';
  import Icone from '../lib/Icone.svelte';
  import { nomeDoDia, somarDias, diasEntre, dataLonga } from '../../shared/datas';
  import { nomeDaRefeicao } from '../../shared/tipos';
  import { aguaDoDia, porcentagem, formatarMl, ritmoAgua, linhaDoTempo, kcalDoDia, type ItemLinha } from '../../shared/resumo';

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
  const ehHoje = $derived(dia === estado.relogio.dia);
  const ontem = $derived(somarDias(dia, -1));
  const amanha = $derived(somarDias(dia, 1));

  const tomado = $derived(p ? aguaDoDia(estado.agua, p.id, dia) : 0);
  const pct = $derived(p ? porcentagem(tomado, p.meta_agua_ml) : 0);
  const falta = $derived(p ? Math.max(0, p.meta_agua_ml - tomado) : 0);
  const ritmo = $derived(p && ehHoje ? ritmoAgua(tomado, p.meta_agua_ml, estado.relogio.hora) : null);
  const copos = $derived(p ? estado.agua.filter((a) => a.pessoa_id === p.id && a.dia === dia).length : 0);

  const linha = $derived(
    p ? linhaDoTempo(estado.horarios, estado.refeicoes, p.id, dia, estado.relogio.dia, estado.relogio.hora) : [],
  );
  const kcal = $derived(p ? kcalDoDia(estado.refeicoes, p.id, dia) : { total: 0, registradas: 0 });
  const mostrarKcal = $derived(!!p && (p.meta_kcal !== null || kcal.registradas > 0));
  const feitas = $derived(linha.filter((l) => l.previsto && l.estado === 'feita').length);
  const doPlano = $derived(linha.filter((l) => l.previsto).length);

  function registrar(l: ItemLinha) {
    if (!p) return;
    // Num dia passado, sugere o horário do plano; hoje, a hora de agora.
    estado.gaveta = { tipo: 'nova', dia, pessoa_id: p.id, refeicao: l.tipo, hora: ehHoje ? undefined : l.previsto ?? undefined };
  }

  const ROTULO: Record<ItemLinha['estado'], string> = {
    feita: 'Feita',
    atrasada: 'Passou do horário',
    proxima: 'Próxima',
    mais_tarde: 'Mais tarde',
    nao_registrada: 'Não registrada',
  };
</script>

<nav class="dias" aria-label="Escolher o dia">
  <a class="seta" href="#hoje/{ontem}" aria-label="Dia anterior"><ChevronLeft size={22} /></a>
  <div class="dia">
    <strong>{nomeDoDia(dia, estado.relogio.dia)}</strong>
    {#if ehHoje || diasEntre(dia, estado.relogio.dia) === 1}<small>{dataLonga(dia)}</small>{/if}
    {#if !ehHoje}<a class="link" href="#hoje">Voltar para hoje</a>{/if}
  </div>
  {#if ehHoje}
    <span class="seta" aria-hidden="true"></span>
  {:else}
    <a class="seta" href="#hoje/{amanha}" aria-label="Dia seguinte"><ChevronRight size={22} /></a>
  {/if}
</nav>

<EscolhaPessoa {dia} />

{#if !p}
  <p class="cartao vazio">Escolha de quem é o dia.</p>
{:else if carregando}
  <p class="vazio">Carregando esse dia…</p>
{:else}
  <section class="heroi" aria-labelledby="titulo-agua">
    <div class="cab">
      <p class="rotulo" id="titulo-agua"><GlassWater size={16} /> Água {ehHoje ? 'hoje' : 'no dia'}</p>
      {#if pct >= 100}<p class="selo-bateu"><Check size={14} /> Meta batida</p>{/if}
    </div>
    <p class="grande num">{formatarMl(tomado)} <span class="de">de {formatarMl(p.meta_agua_ml)}</span></p>
    <div class="barra clara" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Água do dia">
      <i style:width="{Math.min(100, pct)}%"></i>
    </div>
    <p class="nota num">
      {pct}% · {copos} {copos === 1 ? 'registro' : 'registros'}{#if falta > 0}{` · faltam ${formatarMl(falta)}`}{/if}
    </p>
    {#if ritmo && pct < 100}
      <p class="nota ritmo">
        {#if ritmo.diferenca >= 0}
          No ritmo para bater a meta até as 22h.
        {:else}
          {formatarMl(-ritmo.diferenca)} atrás do ritmo: até agora o ideal seria {formatarMl(ritmo.esperado)}.
        {/if}
      </p>
    {/if}
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
      <span class="icone-refeicao"><Flame size={20} /></span>
      <div class="kcal-texto">
        <p><strong class="num">{kcal.total.toLocaleString('pt-BR')} kcal</strong>{#if p.meta_kcal} <span class="meta num">de {p.meta_kcal.toLocaleString('pt-BR')}</span>{/if}</p>
        <p class="meta">{kcal.registradas === 0 ? 'Nenhuma refeição com calorias' : `Somando ${kcal.registradas} ${kcal.registradas === 1 ? 'refeição' : 'refeições'} com calorias`}</p>
      </div>
      {#if p.meta_kcal}
        <div class="barra kcal-barra" aria-hidden="true"><i style:width="{Math.min(100, porcentagem(kcal.total, p.meta_kcal))}%"></i></div>
      {/if}
    </div>
  {/if}

  <div class="cab-secao">
    <h2 class="secao">Refeições</h2>
    {#if doPlano}<p class="contagem num">{feitas} de {doPlano} do plano</p>{/if}
  </div>

  {#if linha.length === 0}
    <p class="cartao vazio">
      Nada registrado {ehHoje ? 'ainda hoje' : 'nesse dia'}. Toque em <strong>+</strong> para lançar uma refeição,
      ou monte o plano de horários em <a href="#ajustes">Ajustes</a>.
    </p>
  {:else}
    <ol class="cartao linha">
      {#each linha as l (l.tipo + l.hora + (l.refeicoes[0]?.id ?? ''))}
        <li class={l.estado}>
          <span class="hora num">{l.hora}</span>
          <span class="icone-refeicao" class:apagado={l.estado !== 'feita'}><Icone tipo={l.tipo} /></span>
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
                  <span>{r.descricao}</span>
                  {#if l.refeicoes.length > 1 || r.kcal}
                    <small class="num">{#if l.refeicoes.length > 1}{r.hora}{/if}{#if l.refeicoes.length > 1 && r.kcal} · {/if}{#if r.kcal}{r.kcal} kcal{/if}</small>
                  {/if}
                </button>
              {/each}
            {:else}
              <button class="link" onclick={() => registrar(l)}>Registrar {nomeDaRefeicao(l.tipo).toLowerCase()}</button>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
{/if}

<style>
  .dias { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; margin-bottom: var(--esp-3); }
  .seta { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--texto-2); }
  a.seta:hover { background: var(--superficie-2); }
  .dia { display: grid; justify-items: center; text-align: center; }
  .dia strong { font-size: var(--fs-500); }
  .dia small { font-size: var(--fs-200); color: var(--texto-3); }
  .dia .link { padding: 0; font-size: var(--fs-200); }

  .heroi {
    margin-top: var(--esp-4);
    display: grid;
    gap: var(--esp-2);
    padding: var(--esp-5);
    border-radius: var(--r-3);
    background: var(--heroi);
    color: #fff;
    box-shadow: var(--sombra-alta);
  }
  .cab { display: flex; justify-content: space-between; align-items: center; gap: var(--esp-2); }
  .rotulo { display: flex; align-items: center; gap: 6px; font-size: var(--fs-100); font-weight: var(--fw-semi); letter-spacing: 0.06em; text-transform: uppercase; color: rgb(255 255 255 / 0.88); }
  .selo-bateu { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: rgb(255 255 255 / 0.16); font-size: var(--fs-100); font-weight: var(--fw-semi); }
  .grande { font-size: var(--fs-800); font-weight: var(--fw-bold); color: var(--agua-clara); line-height: 1.1; }
  .de { font-size: var(--fs-500); font-weight: var(--fw-medium); color: rgb(255 255 255 / 0.88); }
  .nota { font-size: var(--fs-200); color: rgb(255 255 255 / 0.88); }
  .ritmo { font-weight: var(--fw-medium); }
  .barra.clara { height: 10px; background: rgb(255 255 255 / 0.18); }
  .barra.clara > i { background: var(--agua-clara); }

  .beber { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--esp-2); margin-top: var(--esp-3); }
  .botao-agua {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--esp-2);
    min-height: 56px;
    padding: var(--esp-2);
    border: 0;
    border-radius: var(--r-btn);
    background: #ffffff;
    color: var(--agua);
    font-weight: var(--fw-semi);
    transition: transform var(--mov), background var(--mov);
  }
  .botao-agua:hover { background: var(--agua-suave); }
  .botao-agua:active { transform: scale(0.96); }
  .botao-agua :global(svg) { flex: none; }
  .botao-agua span { display: grid; line-height: 1.15; text-align: left; font-size: var(--fs-300); }
  .botao-agua small { font-size: var(--fs-100); font-weight: var(--fw-medium); color: var(--texto-3); }

  .kcal { display: flex; flex-wrap: wrap; align-items: center; gap: var(--esp-3); margin-top: var(--esp-4); }
  .kcal-texto { flex: 1; min-width: 0; }
  .meta { font-size: var(--fs-200); color: var(--texto-3); }
  .kcal-barra { flex-basis: 100%; }
  .kcal-barra > i { background: var(--marca); }

  .cab-secao { display: flex; align-items: baseline; justify-content: space-between; gap: var(--esp-2); }
  .contagem { font-size: var(--fs-200); color: var(--texto-3); }

  .linha { list-style: none; margin: 0; padding: 0 var(--esp-3); }
  .linha li { display: flex; align-items: flex-start; gap: var(--esp-3); padding: var(--esp-3) 0; border-bottom: 1px solid var(--borda); }
  .linha li:last-child { border-bottom: 0; }
  .hora { flex: none; width: 3.2em; padding-top: 10px; font-size: var(--fs-200); font-weight: var(--fw-semi); color: var(--texto-2); }
  .icone-refeicao.apagado { background: var(--superficie-2); color: var(--texto-3); }
  .atrasada .icone-refeicao.apagado { background: var(--alerta-suave); color: var(--alerta); }
  .proxima .icone-refeicao.apagado { background: var(--agua-suave); color: var(--agua); }
  .corpo { flex: 1; min-width: 0; display: grid; gap: 2px; padding-top: 2px; }
  .topo-item { display: flex; flex-wrap: wrap; align-items: center; gap: var(--esp-2); min-height: 24px; }
  .previsto { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-100); color: var(--texto-3); }
  .comida {
    display: grid;
    gap: 1px;
    width: 100%;
    padding: 2px 0;
    border: 0;
    background: none;
    text-align: left;
    color: var(--texto-2);
    font-size: var(--fs-300);
  }
  .comida:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .comida span { overflow-wrap: anywhere; }
  .comida small { font-size: var(--fs-100); color: var(--texto-3); }
  .corpo .link { justify-self: start; padding: 2px 0; }
  .nao_registrada strong, .mais_tarde strong { color: var(--texto-2); font-weight: var(--fw-medium); }
</style>
