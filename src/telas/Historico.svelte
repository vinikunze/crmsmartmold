<script lang="ts">
  // Últimos 7 ou 30 dias de uma pessoa: sequência batendo a água, médias,
  // gráfico de água por dia com a linha da meta, e a lista dos dias (que é
  // também a tabela do gráfico: tocar num dia abre ele).
  import { Flame, ChevronRight, Check } from '@lucide/svelte';
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

  // Médias só com os dias que já terminaram: hoje ainda está pela metade.
  const fechados = $derived(dias.filter((d) => d.dia < hojeDia));
  const media = $derived(fechados.length ? Math.round(fechados.reduce((t, d) => t + d.agua_ml, 0) / fechados.length / 10) * 10 : 0);
  const bateram = $derived(fechados.filter((d) => d.bateu_agua).length);
  const planoTotal = $derived(fechados.reduce((t, d) => t + d.plano, 0));
  const planoFeito = $derived(fechados.reduce((t, d) => t + Math.min(d.do_plano, d.plano), 0));
  const pctPlano = $derived(planoTotal ? Math.floor((planoFeito / planoTotal) * 100) : null);
</script>

<EscolhaPessoa dia={hojeDia} />

<div class="periodo" role="group" aria-label="Período">
  <button class="chip" aria-pressed={periodo === 7} onclick={() => (periodo = 7)}>7 dias</button>
  <button class="chip" aria-pressed={periodo === 30} onclick={() => (periodo = 30)}>30 dias</button>
</div>

{#if p}
  <div class="numeros">
    <div class="cartao numero destaque">
      <span class="icone"><Flame size={20} /></span>
      <p class="valor num">{sequencia} {sequencia === 1 ? 'dia' : 'dias'}</p>
      <p class="legenda">seguidos batendo a água</p>
    </div>
    <div class="cartao numero">
      <p class="valor num">{formatarMl(media)}</p>
      <p class="legenda">de água por dia, em média</p>
    </div>
    <div class="cartao numero">
      <p class="valor num">{bateram} de {fechados.length}</p>
      <p class="legenda">dias com a meta de água</p>
    </div>
    {#if pctPlano !== null}
      <div class="cartao numero">
        <p class="valor num">{pctPlano}%</p>
        <p class="legenda">das refeições do plano registradas</p>
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
  .periodo { display: flex; gap: var(--esp-2); margin: var(--esp-4) 0; }
  .numeros { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--esp-3); }
  @media (min-width: 640px) { .numeros { grid-template-columns: repeat(4, 1fr); } }
  .numero { display: grid; align-content: start; gap: 2px; }
  .destaque { background: var(--agua-suave); border-color: transparent; }
  .icone { color: var(--agua); margin-bottom: var(--esp-1); }
  .valor { font-size: var(--fs-600); font-weight: var(--fw-bold); }
  .destaque .valor { color: var(--agua); }
  .legenda { font-size: var(--fs-200); color: var(--texto-3); }
  .destaque .legenda { color: var(--texto-2); }
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
