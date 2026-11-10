<script lang="ts">
  // Gaveta que sobe de baixo no celular e vira painel lateral no computador.
  // Fecha no X, no fundo escurecido, no Esc e arrastando para baixo.
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let { titulo, fechar, children }: { titulo: string; fechar: () => void; children: Snippet } = $props();

  let painel: HTMLElement;
  let arrasto = $state(0);
  let inicioY: number | null = null;

  $effect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const corpo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painel?.querySelector<HTMLElement>('input, button:not(.fechar)')?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = corpo;
      anterior?.focus?.({ preventScroll: true });
    };
  });

  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') fechar();
  }

  function tocou(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    inicioY = e.clientY;
  }
  function moveu(e: PointerEvent) {
    if (inicioY === null) return;
    arrasto = Math.max(0, e.clientY - inicioY);
  }
  function soltou() {
    if (inicioY === null) return;
    if (arrasto > 110) fechar();
    arrasto = 0;
    inicioY = null;
  }
</script>

<svelte:window onkeydown={tecla} />

<div class="fundo" onclick={fechar} aria-hidden="true"></div>
<div
  class="painel"
  role="dialog"
  aria-modal="true"
  aria-label={titulo}
  bind:this={painel}
  style:transform={arrasto ? `translateY(${arrasto}px)` : undefined}
>
  <header
    role="presentation"
    onpointerdown={tocou}
    onpointermove={moveu}
    onpointerup={soltou}
    onpointercancel={soltou}
  >
    <span class="pegador" aria-hidden="true"></span>
    <h2>{titulo}</h2>
    <button class="fechar" onclick={fechar} aria-label="Fechar"><X size={22} /></button>
  </header>
  <div class="conteudo">
    {@render children()}
  </div>
</div>

<style>
  .fundo {
    position: fixed;
    inset: 0;
    background: var(--veu);
    z-index: 40;
    animation: aparecer var(--mov);
  }
  .painel {
    position: fixed;
    z-index: 41;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: calc(100dvh - 24px);
    display: flex;
    flex-direction: column;
    background: var(--fundo);
    border-radius: var(--r-3) var(--r-3) 0 0;
    box-shadow: var(--sombra-alta);
    animation: subir 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
    transition: transform 120ms;
  }
  header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--esp-5) var(--esp-4) var(--esp-2);
    touch-action: none;
  }
  .pegador {
    position: absolute;
    top: 8px;
    left: 50%;
    width: 40px;
    height: 5px;
    margin-left: -20px;
    border-radius: 999px;
    background: var(--borda);
  }
  h2 { font-size: var(--fs-500); font-weight: var(--fw-semi); }
  .fechar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 0;
    background: var(--superficie-2);
    color: var(--texto-2);
  }
  .conteudo {
    overflow-y: auto;
    padding: var(--esp-2) var(--esp-4) calc(var(--esp-5) + env(safe-area-inset-bottom));
    overscroll-behavior: contain;
  }

  @media (min-width: 1024px) {
    .painel {
      left: auto;
      top: 0;
      width: 440px;
      max-height: none;
      border-radius: 0;
      animation: entrarLado 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .pegador { display: none; }
    header { padding-top: var(--esp-4); }
  }

  @keyframes aparecer { from { opacity: 0; } }
  @keyframes subir { from { transform: translateY(100%); } }
  @keyframes entrarLado { from { transform: translateX(100%); } }
</style>
