<script lang="ts">
  // Barras de água por dia, com a linha da meta. Uma série só: sem legenda,
  // o título da seção diz o que é. Passar o mouse ou tocar numa barra mostra
  // o dia e o valor. A lista "Dia a dia" logo abaixo é a versão em tabela.
  import type { ResumoDia } from '../../shared/resumo';
  import { formatarMl } from '../../shared/resumo';
  import { diaDaSemana, diaCurto, nomeDoDia } from '../../shared/datas';

  let { dias, meta, hoje }: { dias: ResumoDia[]; meta: number; hoje: string } = $props();

  const ALTURA = 180;
  const BASE = 22; // espaço do eixo embaixo
  const TOPO = 18; // espaço do rótulo da meta
  let largura = $state(600);
  let ativo = $state<number | null>(null);

  const maximo = $derived(Math.max(meta * 1.15, ...dias.map((d) => d.agua_ml)));
  const area = $derived(ALTURA - BASE - TOPO);
  const y = (ml: number) => TOPO + area - (ml / maximo) * area;
  const passo = $derived(largura / Math.max(1, dias.length));
  const barra = $derived(Math.max(4, Math.min(28, passo * 0.6)));
  const x = (i: number) => i * passo + passo / 2;
  // Rótulos do eixo: todos na semana; no mês, um a cada 5 dias e o de hoje.
  const rotulo = (i: number) => dias.length <= 7 || (dias.length - 1 - i) % 5 === 0;

  /** Barra com o topo arredondado (4 px) e a base reta, presa no eixo. */
  function caminho(i: number, ml: number): string {
    const h = Math.max(0, (ml / maximo) * area);
    if (h === 0) return '';
    const r = Math.min(4, h, barra / 2);
    const x0 = x(i) - barra / 2, x1 = x0 + barra, yb = TOPO + area, yt = yb - h;
    return `M${x0},${yb}V${yt + r}Q${x0},${yt} ${x0 + r},${yt}H${x1 - r}Q${x1},${yt} ${x1},${yt + r}V${yb}Z`;
  }

  const dica = $derived(ativo === null ? null : dias[ativo]);
</script>

<div class="grafico" bind:clientWidth={largura}>
  <svg width={largura} height={ALTURA} role="img" aria-label="Água por dia, em ml, com a linha da meta de {formatarMl(meta)}">
    <!-- linha de base e meta: discretas, para não competir com as barras -->
    <line x1="0" x2={largura} y1={TOPO + area} y2={TOPO + area} class="eixo" />
    <line x1="0" x2={largura} y1={y(meta)} y2={y(meta)} class="meta" />
    <text x={largura} y={y(meta) - 6} text-anchor="end" class="rotulo-meta">meta {formatarMl(meta)}</text>

    {#each dias as d, i (d.dia)}
      <!-- área de toque maior que a barra -->
      <rect
        x={i * passo} y={TOPO} width={passo} height={area} class="alvo"
        role="button" tabindex="-1" aria-label="{nomeDoDia(d.dia, hoje)}: {formatarMl(d.agua_ml)}"
        onpointerenter={() => (ativo = i)} onpointerleave={() => (ativo = null)} onclick={() => (ativo = i)}
        onkeydown={() => {}}
      />
      <path d={caminho(i, d.agua_ml)} class="barra-agua" class:apagada={ativo !== null && ativo !== i} />
      {#if rotulo(i)}
        <text x={x(i)} y={ALTURA - 6} text-anchor="middle" class="eixo-texto" class:hoje={d.dia === hoje}>
          {dias.length <= 7 ? diaDaSemana(d.dia) : diaCurto(d.dia)}
        </text>
      {/if}
    {/each}
  </svg>

  {#if dica && ativo !== null}
    <div class="dica" style:left="{Math.min(Math.max(x(ativo), 70), largura - 70)}px" style:top="{Math.max(0, y(dica.agua_ml) - 52)}px">
      <strong>{nomeDoDia(dica.dia, hoje)}</strong>
      <span class="num">{formatarMl(dica.agua_ml)}{dica.bateu_agua ? ' · meta batida' : ''}</span>
    </div>
  {/if}
</div>

<style>
  .grafico { position: relative; width: 100%; }
  svg { display: block; overflow: visible; }
  .eixo { stroke: var(--borda); stroke-width: 1; }
  .meta { stroke: var(--texto-3); stroke-width: 1.5; stroke-dasharray: 4 4; }
  .rotulo-meta { font-size: 11px; fill: var(--texto-3); font-weight: 600; }
  .eixo-texto { font-size: 11px; fill: var(--texto-3); text-transform: capitalize; }
  .eixo-texto.hoje { fill: var(--texto); font-weight: 700; }
  .barra-agua { fill: var(--agua-barra); transition: opacity var(--mov); pointer-events: none; }
  .barra-agua.apagada { opacity: 0.45; }
  .alvo { fill: transparent; cursor: pointer; outline: none; }
  .dica {
    position: absolute;
    transform: translateX(-50%);
    display: grid;
    gap: 1px;
    padding: 6px 10px;
    border-radius: var(--r-1);
    background: var(--texto);
    color: #fff;
    font-size: var(--fs-200);
    white-space: nowrap;
    pointer-events: none;
    box-shadow: var(--sombra-alta);
  }
</style>
