<script lang="ts">
  // Histórico de uma pessoa: a sequência de dias batendo a água (com o
  // recorde), o calendário de gotinhas do mês, as médias dos últimos 7 ou 30
  // dias, o gráfico de água por dia e a lista dos dias (que é também a tabela
  // do gráfico: tocar num dia abre ele).
  import { Flame, ChevronRight, Check, Trophy } from '@lucide/svelte';
  import Calendario from '../lib/Calendario.svelte';
  import { recordeAgua } from '../../shared/calendario';
  import { estado } from '../lib/estado.svelte';
  import EscolhaPessoa from '../lib/EscolhaPessoa.svelte';
  import GraficoAgua from '../lib/GraficoAgua.svelte';
  import { somarDias, nomeDoDia } from '../../shared/datas';
  import { historico, sequenciaAgua, formatarMl } from '../../shared/resumo';

  let periodo = $state<7 | 30>(7);

  const p = $derived(estado.pessoa);
  const hojeDia = $derived(estado.relogio.dia);
  const de = $derived(somarDias(hojeDia, -(periodo - 1)));

  $effect(() => {
    estado.garantir(somarDias(hojeDia, -40)).catch((e) => estado.erro(e));
  });

  const dias = $derived(p ? historico(p, estado.horarios, estado.refeicoes, estado.agua, de, hojeDia) : []);
  // Para a sequência, olha mais para trás que o período mostrado.
  const longo = $derived(p ? historico(p, estado.horarios, estado.refeicoes, estado.agua, estado.de || de, hojeDia) : []);
  const sequencia = $derived(sequenciaAgua(longo, hojeDia));
  const recorde = $derived(recordeAgua(longo));
  const bateuHoje = $derived(longo.some((d) => d.dia === hojeDia && d.bateu_agua));

  // Médias só com os dias que já terminaram: hoje ainda está pela metade.
  const fechados = $derived(dias.filter((d) => d.dia < hojeDia));
  const media = $derived(fechados.length ? Math.round(fechados.reduce((t, d) => t + d.agua_ml, 0) / fechados.length / 10) * 10 : 0);
  const bateram = $derived(fechados.filter((d) => d.bateu_agua).length);
  const planoTotal = $derived(fechados.reduce((t, d) => t + d.plano, 0));
  const planoFeito = $derived(fechados.reduce((t, d) => t + Math.min(d.do_plano, d.plano), 0));
  const pctPlano = $derived(planoTotal ? Math.floor((planoFeito / planoTotal) * 100) : null);
</script>

<EscolhaPessoa dia={hojeDia} />

{#if p}
  <section class="sequencia" aria-label="Sequência">
    <span class="chama" class:acesa={sequencia > 0}><Flame size={36} strokeWidth={1.75} /></span>
    <div class="seq-texto">
      <p class="seq-numero num">{sequencia} {sequencia === 1 ? 'dia seguido' : 'dias seguidos'}</p>
      <p class="seq-legenda">
        {#if sequencia === 0}
          batendo a meta de água. {bateuHoje ? '' : 'Bata hoje para começar!'}
        {:else if !bateuHoje}
          batendo a meta de água. Bata hoje para virar {sequencia + 1}!
        {:else}
          batendo a meta de água, contando hoje.
        {/if}
      </p>
    </div>
    {#if recorde > 0}
      <div class="recorde" title="Maior sequência">
        <Trophy size={18} />
        <span class="num"><strong>{recorde}</strong> {recorde === 1 ? 'dia' : 'dias'}</span>
        <small>{recorde === sequencia ? 'seu recorde!' : 'recorde'}</small>
      </div>
    {/if}
  </section>

  <Calendario pessoa={p} />

  <div class="cab-periodo">
    <h2 class="secao">Médias</h2>
    <div class="periodo" role="group" aria-label="Período">
      <button class="chip" aria-pressed={periodo === 7} onclick={() => (periodo = 7)}>7 dias</button>
      <button class="chip" aria-pressed={periodo === 30} onclick={() => (periodo = 30)}>30 dias</button>
    </div>
  </div>
  <div class="numeros">
    <div class="cartao numero">
      <p class="valor num">{formatarMl(media)}</p>
      <p class="legenda">por dia, em média</p>
    </div>
    <div class="cartao numero">
      <p class="valor num">{bateram} de {fechados.length}</p>
      <p class="legenda">dias com a meta</p>
    </div>
    {#if pctPlano !== null}
      <div class="cartao numero">
        <p class="valor num">{pctPlano}%</p>
        <p class="legenda">do plano registrado</p>
      </div>
    {/if}
  </div>
  <p class="obs">Médias dos dias completos, sem contar hoje.</p>

  <h2 class="secao">Água por dia</h2>
  <div class="cartao">
    <GraficoAgua {dias} meta={p.meta_agua_ml} hoje={hojeDia} />
  </div>

  <h2 class="secao">Dia a dia</h2>
  <ul class="cartao lista">
    {#each [...dias].reverse() as d (d.dia)}
      <li>
        <a href="#hoje/{d.dia}">
          <span class="nome-dia">{nomeDoDia(d.dia, hojeDia)}</span>
          <span class="agua num" class:bateu={d.bateu_agua}>
            {#if d.bateu_agua}<Check size={14} aria-label="Meta batida" />{/if}{formatarMl(d.agua_ml)}
          </span>
          <span class="ref num">
            {#if d.plano}{Math.min(d.do_plano, d.plano)}/{d.plano} do plano{:else}{d.refeicoes} {d.refeicoes === 1 ? 'refeição' : 'refeições'}{/if}
          </span>
          <ChevronRight size={18} />
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .sequencia {
    display: flex;
    align-items: center;
    gap: var(--esp-4);
    margin: var(--esp-4) 0;
    padding: var(--esp-4) var(--esp-5);
    border-radius: 22px;
    background: var(--alerta-suave);
  }
  .chama { flex: none; display: grid; place-items: center; width: 60px; height: 60px; border-radius: 18px; background: var(--superficie); color: var(--texto-3); box-shadow: var(--sombra); }
  .chama.acesa { color: var(--alerta); }
  .chama.acesa :global(svg) { fill: var(--alerta); fill-opacity: 0.18; animation: tremular 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
  .seq-texto { flex: 1; min-width: 0; }
  .seq-numero { font-size: var(--fs-600); font-weight: var(--fw-bold); color: var(--alerta); line-height: 1.1; letter-spacing: -0.02em; }
  .seq-legenda { font-size: var(--fs-300); color: var(--texto-2); }
  .recorde { flex: none; display: grid; justify-items: center; color: var(--alerta); text-align: center; }
  .recorde span { font-size: var(--fs-300); color: var(--texto); }
  .recorde small { font-size: var(--fs-100); color: var(--texto-3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--fw-semi); }
  @keyframes tremular { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.06) rotate(-3deg); } }

  .cab-periodo { display: flex; align-items: center; justify-content: space-between; gap: var(--esp-3); margin: var(--esp-6) 0 var(--esp-3); }
  .cab-periodo .secao { margin: 0; }
  .periodo { display: flex; gap: var(--esp-2); }
  .numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--esp-2); }
  @media (max-width: 400px) { .numeros .valor { font-size: var(--fs-500); } }
  @media (min-width: 640px) { .numeros { grid-template-columns: repeat(3, 1fr); } }
  .numero { display: grid; align-content: start; gap: 2px; }
  .valor { font-size: var(--fs-600); font-weight: var(--fw-bold); }
  .legenda { font-size: var(--fs-200); color: var(--texto-3); }
  .obs { font-size: var(--fs-100); color: var(--texto-3); margin-top: var(--esp-2); }

  .lista { list-style: none; margin: 0; padding: 0 var(--esp-3); }
  .lista li { border-bottom: 1px solid var(--borda); }
  .lista li:last-child { border-bottom: 0; }
  .lista a {
    display: grid;
    grid-template-columns: 1fr auto auto 18px;
    align-items: center;
    gap: var(--esp-3);
    min-height: 52px;
    color: var(--texto);
    text-decoration: none;
  }
  .lista a :global(svg:last-child) { color: var(--texto-3); }
  .nome-dia { font-weight: var(--fw-medium); }
  .agua { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-300); color: var(--texto-2); min-width: 4.5em; justify-content: flex-end; }
  .agua.bateu { color: var(--agua); font-weight: var(--fw-semi); }
  .ref { font-size: var(--fs-200); color: var(--texto-3); min-width: 6.5em; text-align: right; }
</style>
