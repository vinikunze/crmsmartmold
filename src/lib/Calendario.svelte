<script lang="ts">
  // Calendário do mês com uma gota por dia: dourada e cheia quando bateu a
  // meta de água; azul pela metade ou com um pouco; vazia. Tocar abre o dia.
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import type { Pessoa } from '../../shared/tipos';
  import { estado } from './estado.svelte';
  import { aguaDoDia, formatarMl } from '../../shared/resumo';
  import { semanasDoMes, somarMeses, mesDe, nomeDoMes, nivelGota, type NivelGota } from '../../shared/calendario';
  import { nomeDoDia } from '../../shared/datas';

  let { pessoa }: { pessoa: Pessoa } = $props();

  const hoje = $derived(estado.relogio.dia);
  let mes = $state(mesDe(estado.relogio.dia));
  const semanas = $derived(semanasDoMes(mes));
  const ehMesAtual = $derived(mes === mesDe(hoje));

  // Mês antigo: busca os dados dele antes de desenhar.
  let carregando = $state(false);
  $effect(() => {
    const primeiro = `${mes}-01`;
    if (estado.de && primeiro < estado.de) {
      carregando = true;
      estado.garantir(primeiro).catch((e) => estado.erro(e)).finally(() => (carregando = false));
    }
  });

  // Quanto da gota fica cheio, de baixo para cima (0 a 1).
  const ENCHE: Record<NivelGota, number> = { cheia: 1, metade: 0.55, pouca: 0.22, vazia: 0 };
  const NOME: Record<NivelGota, string> = { cheia: 'meta batida', metade: 'metade ou mais', pouca: 'um pouco', vazia: 'nada' };
  const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const GOTA = 'M12 2.5c0 0-7.5 8.2-7.5 13.2a7.5 7.5 0 0 0 15 0C19.5 10.7 12 2.5 12 2.5Z';

  const dias = $derived(
    semanas.flat().filter((d): d is string => !!d && d <= hoje).map((d) => ({ d, ml: aguaDoDia(estado.agua, pessoa.id, d) })),
  );
  const batidos = $derived(dias.filter((x) => x.ml >= pessoa.meta_agua_ml).length);
</script>

<section class="cartao calendario" aria-labelledby="titulo-cal">
  <div class="cab">
    <button class="seta" onclick={() => (mes = somarMeses(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
    <div class="titulo">
      <h2 id="titulo-cal">{nomeDoMes(mes)}</h2>
      <p class="num">{batidos} {batidos === 1 ? 'dia' : 'dias'} com a meta de água</p>
    </div>
    <button class="seta" onclick={() => (mes = somarMeses(mes, 1))} disabled={ehMesAtual} aria-label="Próximo mês"><ChevronRight size={20} /></button>
  </div>

  {#if carregando}
    <p class="vazio">Carregando esse mês…</p>
  {:else}
    <div class="grade" role="grid" aria-label="Água em {nomeDoMes(mes)}">
      {#each SEMANA as s, i (i)}<span class="semana" aria-hidden="true">{s}</span>{/each}
      {#each semanas.flat() as d, i (d ?? `v${i}`)}
        {#if !d}
          <span></span>
        {:else if d > hoje}
          <span class="dia futuro"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={GOTA} class="contorno" /></svg><small class="num">{Number(d.slice(8))}</small></span>
        {:else}
          {@const ml = aguaDoDia(estado.agua, pessoa.id, d)}
          {@const nivel = nivelGota(ml, pessoa.meta_agua_ml)}
          <a class="dia {nivel}" class:hoje={d === hoje} href="#hoje/{d}"
            aria-label="{nomeDoDia(d, hoje)}: {formatarMl(ml)}, {NOME[nivel]}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <clipPath id="c{d}"><rect x="0" y={22.5 - 20 * ENCHE[nivel]} width="24" height="24" /></clipPath>
              <path d={GOTA} class="fundo-gota" />
              <path d={GOTA} class="agua" clip-path="url(#c{d})" />
              <path d={GOTA} class="contorno" />
            </svg>
            <small class="num">{Number(d.slice(8))}</small>
          </a>
        {/if}
      {/each}
    </div>
    <div class="legenda" aria-hidden="true">
      {#each ['cheia', 'metade', 'vazia'] as const as n (n)}
        <span class="item {n}">
          <svg viewBox="0 0 24 24">
            <clipPath id="l{n}"><rect x="0" y={22.5 - 20 * ENCHE[n]} width="24" height="24" /></clipPath>
            <path d={GOTA} class="fundo-gota" /><path d={GOTA} class="agua" clip-path="url(#l{n})" /><path d={GOTA} class="contorno" />
          </svg>
          {n === 'cheia' ? 'Bateu a meta' : n === 'metade' ? 'Metade' : 'Pouca ou nada'}
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .calendario { display: grid; gap: var(--esp-3); }
  .cab { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; }
  .titulo { text-align: center; }
  .titulo h2 { font-size: var(--fs-500); font-weight: var(--fw-semi); }
  .titulo h2::first-letter { text-transform: uppercase; }
  .titulo p { font-size: var(--fs-200); color: var(--texto-3); }
  .seta { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: none; color: var(--texto-2); }
  .seta:hover:not(:disabled) { background: var(--superficie-2); }
  .seta:disabled { opacity: 0.3; cursor: default; }

  .grade { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px 2px; }
  .semana { text-align: center; font-size: var(--fs-100); font-weight: var(--fw-semi); color: var(--texto-3); padding-bottom: 2px; }
  .dia {
    display: grid;
    justify-items: center;
    gap: 0;
    padding: 4px 0 2px;
    border-radius: var(--r-1);
    color: var(--texto-2);
    text-decoration: none;
  }
  a.dia:hover { background: var(--superficie-2); }
  .dia svg { width: 28px; height: 28px; }
  .dia small { font-size: var(--fs-100); line-height: 1.2; }
  .dia.hoje { box-shadow: inset 0 0 0 2px var(--agua); }
  .dia.hoje small { color: var(--agua); font-weight: var(--fw-bold); }
  .dia.cheia small { color: var(--texto); font-weight: var(--fw-semi); }
  .futuro { opacity: 0.35; }

  .fundo-gota { fill: var(--superficie-2); }
  .agua { fill: var(--agua-barra); }
  .contorno { fill: none; stroke: var(--agua-barra); stroke-width: 1.6; }
  .vazia .contorno, .futuro .contorno { stroke: var(--borda); }
  /* Meta batida: gota dourada (com contorno mais escuro, para aparecer no branco). */
  .cheia .agua { fill: var(--ouro); }
  .cheia .contorno { stroke: var(--ouro-contorno); }

  .legenda { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--esp-2) var(--esp-4); font-size: var(--fs-100); color: var(--texto-3); }
  .legenda .item { display: inline-flex; align-items: center; gap: 4px; }
  .legenda svg { width: 16px; height: 16px; }
</style>
