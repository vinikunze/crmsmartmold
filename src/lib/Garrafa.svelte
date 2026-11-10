<script lang="ts" module>
  import type { Recipiente } from '../../shared/tipos';

  /** Retângulo de cantos arredondados, como caminho. */
  const rr = (x: number, y: number, w: number, h: number, r: number) =>
    `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

  /** `traco`: desenhado só com linha. `frente`: linha por cima da água (o padrão é atrás do corpo). */
  interface Peca { d: string; traco?: boolean; frente?: boolean }
  interface Forma {
    /** Contorno do corpo; também recorta a água. */
    corpo: string;
    /** Altura da água com 100% e com 0% (y no desenho de 100 × 180). */
    topo: number;
    fundo: number;
    /** Tampa: na cor da pessoa; fica dourada quando a meta é batida. */
    tampa: Peca[];
    /** Detalhes que ficam sempre na cor da pessoa (anel, alça, canudo). */
    detalhe: Peca[];
    /** Onde ficam os risquinhos de 25, 50 e 75% (x inicial e final). */
    marcas: [number, number];
    brilho: string;
  }

  export const FORMAS: Record<Recipiente, Forma> = {
    garrafa: {
      corpo: 'M40 22 H60 V32 C60 40 86 42 86 60 V156 Q86 172 70 172 H30 Q14 172 14 156 V60 C14 42 40 40 40 32 Z',
      topo: 52, fundo: 170,
      tampa: [{ d: rr(35, 5, 30, 17, 5) }],
      detalhe: [{ d: rr(37, 24, 26, 7, 2) }],
      marcas: [74, 82],
      brilho: 'M22 70 V140',
    },
    squeeze: {
      corpo: 'M30 46 H70 Q78 46 78 54 V94 Q73 103 78 112 V158 Q78 172 64 172 H36 Q22 172 22 158 V112 Q27 103 22 94 V54 Q22 46 30 46 Z',
      topo: 56, fundo: 170,
      tampa: [{ d: rr(40, 13, 20, 14, 4) }, { d: rr(28, 24, 44, 18, 6) }],
      detalhe: [{ d: rr(26, 40, 48, 7, 3) }],
      marcas: [62, 69],
      brilho: 'M30 60 V90',
    },
    copo: {
      corpo: 'M20 44 H72 L65 162 Q64 172 55 172 H37 Q28 172 27 162 Z',
      topo: 52, fundo: 170,
      tampa: [{ d: rr(15, 33, 62, 13, 5) }],
      detalhe: [
        { d: 'M50 36 L58 7', traco: true }, // canudo
        { d: 'M71 66 H84 Q92 66 92 74 V104 Q92 112 84 112 H68', traco: true }, // alça
      ],
      marcas: [54, 61],
      brilho: 'M29 58 L33 130',
    },
    garrafao: {
      corpo: 'M38 24 H62 V38 L84 52 Q90 56 90 64 V158 Q90 172 76 172 H24 Q10 172 10 158 V64 Q10 56 16 52 L38 38 Z',
      topo: 60, fundo: 170,
      tampa: [{ d: rr(35, 8, 30, 16, 5) }],
      detalhe: [{ d: rr(58, 68, 16, 34, 7), traco: true, frente: true }], // pegador
      marcas: [79, 86],
      brilho: 'M18 72 V150',
    },
  };
</script>

<script lang="ts">
  // A garrafa de cada pessoa, que enche conforme a porcentagem da meta.
  // O formato e a cor são escolhidos em Ajustes. A água tem duas ondas
  // andando e sobe com animação; a cada copo novo (`respingo` muda) sobem
  // bolhinhas. Meta batida: a tampa fica dourada e aparece um brilho.
  // Dois jeitos: grande, no destaque azul da tela Hoje; pequena, nos botões
  // de pessoa, sobre fundo claro (ou escuro, no tema escuro).
  import type { Cor } from '../../shared/tipos';

  let {
    pct,
    tipo = 'garrafa',
    cor = 'azul',
    pequena = false,
    respingo = 0,
    rotulo,
  }: { pct: number; tipo?: Recipiente; cor?: Cor; pequena?: boolean; respingo?: number; rotulo?: string } = $props();

  const f = $derived(FORMAS[tipo] ?? FORMAS.garrafa);
  const nivel = $derived(Math.min(100, Math.max(0, pct)));
  const bateu = $derived(pct >= 100);
  // Com 0% deixa um fiozinho de água no fundo, para a garrafa não parecer quebrada.
  const y = $derived(f.fundo - (Math.max(nivel, 2) / 100) * (f.fundo - f.topo));

  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  // Onda de período 100, de x = -100 a 300: andando 100 para o lado, volta igual.
  const ONDA = 'M-100 0 Q-75 -5 -50 0 T0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 V200 H-100 Z';
  const BOLHAS = [
    { x: 36, r: 3, atraso: 0 },
    { x: 50, r: 4, atraso: 120 },
    { x: 60, r: 2.5, atraso: 220 },
    { x: 43, r: 2, atraso: 320 },
    { x: 55, r: 3, atraso: 420 },
  ];
  const ESTRELA = 'M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z';
</script>

<!-- Sem rótulo, é só enfeite: o botão ou o texto em volta já dizem a quantidade. -->
<svg viewBox="0 0 100 180" class="garrafa cor-{cor}" class:pequena class:bateu role={rotulo ? 'img' : undefined}
  aria-label={rotulo || undefined} aria-hidden={rotulo ? undefined : 'true'}>
  <defs>
    <clipPath id="{id}-corpo"><path d={f.corpo} /></clipPath>
  </defs>

  {#each f.detalhe.filter((p) => p.traco && !p.frente) as p (p.d)}<path d={p.d} class="detalhe traco" />{/each}
  <path class="vidro" d={f.corpo} />

  <g clip-path="url(#{id}-corpo)">
    <g class="nivel" style:transform="translateY({y}px)">
      <path d={ONDA} class="onda atras" />
      <path d={ONDA} class="onda frente" />
    </g>
    {#if !pequena}
      {#key respingo}
        {#if respingo}
          {#each BOLHAS as b (b.x)}
            <circle cx={b.x} cy={f.fundo - 6} r={b.r} class="bolha" style:animation-delay="{b.atraso}ms"
              style:--subida="{Math.max(20, f.fundo - y - 4)}px" />
          {/each}
        {/if}
      {/key}
    {/if}
  </g>

  <!-- marcas de 25, 50 e 75% e o brilho do vidro -->
  {#if !pequena}
    {#each [25, 50, 75] as m (m)}
      {@const my = f.fundo - (m / 100) * (f.fundo - f.topo)}
      <line x1={f.marcas[0]} x2={f.marcas[1]} y1={my} y2={my} class="marca" />
    {/each}
    <path d={f.brilho} class="brilho" />
  {/if}
  <path class="contorno" d={f.corpo} />
  {#each f.detalhe.filter((p) => !p.traco || p.frente) as p (p.d)}<path d={p.d} class="detalhe" class:traco={p.traco} />{/each}
  {#each f.tampa as p (p.d)}<path d={p.d} class="tampa" />{/each}

  {#if bateu && !pequena}
    <!-- O grupo põe a estrela no lugar; a animação mexe só no tamanho dela. -->
    <g transform="translate(88 14)"><path d={ESTRELA} class="estrela" /></g>
    <g transform="translate(10 34) scale(0.55)"><path d={ESTRELA} class="estrela menor" /></g>
  {/if}
</svg>

<style>
  .garrafa { display: block; width: 100%; height: 100%; overflow: visible; }

  /* Grande, no destaque azul: contorno branco, detalhes no tom claro da cor da pessoa. */
  .tampa { fill: var(--p-clara); transition: fill 400ms; }
  .detalhe { fill: var(--p-clara); }
  .detalhe.traco { fill: none; stroke: var(--p-clara); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .vidro { fill: rgb(255 255 255 / 0.1); }
  .contorno { fill: none; stroke: rgb(255 255 255 / 0.9); stroke-width: 3; stroke-linejoin: round; }
  .brilho { fill: none; stroke: rgb(255 255 255 / 0.45); stroke-width: 4; stroke-linecap: round; }
  .marca { stroke: rgb(255 255 255 / 0.55); stroke-width: 2; stroke-linecap: round; }
  .onda.frente { fill: #8fd0ff; }
  .onda.atras { fill: #cdeaff; opacity: 0.55; }
  .bolha { fill: rgb(255 255 255 / 0.85); opacity: 0; animation: bolha 900ms ease-out forwards; }

  /* Meta batida: tampa dourada e brilhos. */
  .bateu .tampa { fill: var(--ouro-claro); }
  .estrela { fill: var(--ouro-claro); transform-box: fill-box; transform-origin: center; animation: piscar 1.8s ease-in-out infinite; }
  .estrela.menor { animation-delay: 600ms; }

  /* Pequena, sobre a superfície do tema: tudo na cor da pessoa. */
  .pequena .tampa, .pequena .detalhe { fill: var(--p); }
  .pequena .detalhe.traco { fill: none; stroke: var(--p); stroke-width: 7; }
  .pequena .vidro { fill: var(--agua-suave); }
  .pequena .contorno { stroke: var(--p); stroke-width: 6; }
  .pequena .onda.frente { fill: var(--agua-barra); }
  .pequena .onda.atras { fill: var(--agua-barra); opacity: 0.35; }
  .pequena.bateu .tampa { fill: var(--ouro); stroke: var(--ouro-contorno); stroke-width: 3; }

  .nivel { transition: transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .onda { animation: andar 3.2s linear infinite; }
  .onda.atras { animation-duration: 5s; animation-direction: reverse; }

  @keyframes andar { from { transform: translateX(0); } to { transform: translateX(-100px); } }
  @keyframes bolha {
    0% { opacity: 0; transform: translateY(0); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateY(calc(-1 * var(--subida))); }
  }
  @keyframes piscar { 0%, 100% { opacity: 0.35; scale: 0.7; } 50% { opacity: 1; scale: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .onda, .bolha, .estrela { animation: none; }
  }
</style>
