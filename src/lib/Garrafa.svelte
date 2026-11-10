<script lang="ts">
  // Garrafa d'água desenhada, que enche conforme a porcentagem da meta.
  // A água tem duas ondas andando (uma na frente, outra atrás) e sobe com
  // animação. A cada copo novo (`respingo` muda), sobem bolhinhas.
  // Dois jeitos: grande, no destaque azul da tela Hoje; pequena, nos
  // botões de pessoa, sobre fundo branco.

  let {
    pct,
    pequena = false,
    respingo = 0,
    rotulo,
  }: { pct: number; pequena?: boolean; respingo?: number; rotulo?: string } = $props();

  // Área de água: do fundo (y 170) até o ombro (y 52). Acima de 100% não passa da boca.
  const FUNDO = 170;
  const TOPO = 52;
  const nivel = $derived(Math.min(100, Math.max(0, pct)));
  // Com 0% deixa um fiozinho de água no fundo, para a garrafa não parecer quebrada.
  const y = $derived(FUNDO - Math.max(nivel, 2) / 100 * (FUNDO - TOPO));

  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  // Onda de período 100, de x = -100 a 300: andando 100 para o lado, volta igual.
  const ONDA = 'M-100 0 Q-75 -5 -50 0 T0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 V200 H-100 Z';
  const BOLHAS = [
    { x: 32, r: 3, atraso: 0 },
    { x: 50, r: 4, atraso: 120 },
    { x: 66, r: 2.5, atraso: 220 },
    { x: 42, r: 2, atraso: 320 },
    { x: 58, r: 3, atraso: 420 },
  ];
</script>

<!-- Sem rótulo, é só enfeite: o botão ou o texto em volta já dizem a quantidade. -->
<svg viewBox="0 0 100 180" class="garrafa" class:pequena role={rotulo ? 'img' : undefined} aria-label={rotulo || undefined} aria-hidden={rotulo ? undefined : 'true'}>
  <defs>
    <clipPath id="{id}-corpo">
      <path d="M40 22 H60 V32 C60 40 86 42 86 60 V156 Q86 172 70 172 H30 Q14 172 14 156 V60 C14 42 40 40 40 32 Z" />
    </clipPath>
  </defs>

  <!-- tampa -->
  <rect x="35" y="5" width="30" height="17" rx="5" class="tampa" />
  <!-- vidro -->
  <path class="vidro" d="M40 22 H60 V32 C60 40 86 42 86 60 V156 Q86 172 70 172 H30 Q14 172 14 156 V60 C14 42 40 40 40 32 Z" />

  <g clip-path="url(#{id}-corpo)">
    <g class="nivel" style:transform="translateY({y}px)">
      <path d={ONDA} class="onda atras" />
      <path d={ONDA} class="onda frente" />
    </g>
    {#if !pequena}
      {#key respingo}
        {#if respingo}
          {#each BOLHAS as b (b.x)}
            <circle cx={b.x} cy={FUNDO - 6} r={b.r} class="bolha" style:animation-delay="{b.atraso}ms"
              style:--subida="{Math.max(20, FUNDO - y - 4)}px" />
          {/each}
        {/if}
      {/key}
    {/if}
  </g>

  <!-- marcas de 25, 50 e 75% e o brilho do vidro -->
  {#if !pequena}
    {#each [25, 50, 75] as m (m)}
      <line x1="74" x2="82" y1={FUNDO - (m / 100) * (FUNDO - TOPO)} y2={FUNDO - (m / 100) * (FUNDO - TOPO)} class="marca" />
    {/each}
  {/if}
  <path d="M22 70 V140" class="brilho" />
  <path class="contorno" d="M40 22 H60 V32 C60 40 86 42 86 60 V156 Q86 172 70 172 H30 Q14 172 14 156 V60 C14 42 40 40 40 32 Z" />
</svg>

<style>
  .garrafa { display: block; width: 100%; height: 100%; overflow: visible; }

  /* Grande, no destaque azul */
  .tampa { fill: rgb(255 255 255 / 0.9); }
  .vidro { fill: rgb(255 255 255 / 0.1); }
  .contorno { fill: none; stroke: rgb(255 255 255 / 0.9); stroke-width: 3; stroke-linejoin: round; }
  .brilho { stroke: rgb(255 255 255 / 0.45); stroke-width: 4; stroke-linecap: round; }
  .marca { stroke: rgb(255 255 255 / 0.55); stroke-width: 2; stroke-linecap: round; }
  .onda.frente { fill: #8fd0ff; }
  .onda.atras { fill: #cdeaff; opacity: 0.55; }
  .bolha { fill: rgb(255 255 255 / 0.85); opacity: 0; animation: bolha 900ms ease-out forwards; }

  /* Pequena, sobre o branco */
  .pequena .tampa { fill: var(--agua); }
  .pequena .vidro { fill: var(--agua-suave); }
  .pequena .contorno { stroke: var(--agua); stroke-width: 6; }
  .pequena .brilho { display: none; }
  .pequena .onda.frente { fill: var(--agua-barra); }
  .pequena .onda.atras { fill: var(--agua-barra); opacity: 0.35; }

  .nivel { transition: transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .onda { animation: andar 3.2s linear infinite; }
  .onda.atras { animation-duration: 5s; animation-direction: reverse; }

  @keyframes andar { from { transform: translateX(0); } to { transform: translateX(-100px); } }
  @keyframes bolha {
    0% { opacity: 0; transform: translateY(0); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateY(calc(-1 * var(--subida))); }
  }

  @media (prefers-reduced-motion: reduce) {
    .onda, .bolha { animation: none; }
  }
</style>
