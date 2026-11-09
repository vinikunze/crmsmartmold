<script lang="ts">
  import { estado } from './estado.svelte';
</script>

{#if estado.aviso}
  <div class="aviso" class:erro={estado.aviso.erro} role="status" aria-live="polite">
    <span>{estado.aviso.texto}</span>
    {#if estado.aviso.acao}
      {@const acao = estado.aviso.acao}
      <button onclick={() => { acao.fazer(); estado.aviso = null; }}>{acao.rotulo}</button>
    {/if}
  </div>
{/if}

<style>
  .aviso {
    position: fixed;
    z-index: 60;
    left: 50%;
    /* acima do botão + (60px), para não cobri-lo */
    bottom: calc(var(--barra-inferior) + 92px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--esp-4);
    width: max-content;
    max-width: calc(100vw - 32px);
    padding: var(--esp-3) var(--esp-4);
    border-radius: var(--r-1);
    background: var(--marca-forte);
    color: #ffffff;
    font-size: var(--fs-300);
    box-shadow: var(--sombra-alta);
    animation: surgir var(--mov);
  }
  .aviso.erro { background: var(--vermelho); color: #ffffff; }
  button {
    border: 0;
    background: none;
    color: inherit;
    font-weight: var(--fw-bold);
    text-decoration: underline;
    padding: var(--esp-1);
  }
  @media (min-width: 1024px) {
    .aviso { bottom: 24px; }
  }
</style>
