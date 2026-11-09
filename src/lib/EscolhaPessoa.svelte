<script lang="ts">
  // Vini / Sophia. Cada botão mostra quanto da meta de água a pessoa já
  // tomou no dia, para um ver o outro sem trocar de tela.
  import { estado } from './estado.svelte';
  import { aguaDoDia, porcentagem } from '../../shared/resumo';

  let { dia }: { dia?: string } = $props();
</script>

<div class="pessoas" role="group" aria-label="De quem">
  {#each estado.pessoas as p (p.id)}
    {@const pct = dia ? porcentagem(aguaDoDia(estado.agua, p.id, dia), p.meta_agua_ml) : null}
    <button type="button" class="pessoa" aria-pressed={estado.pessoaId === p.id} onclick={() => estado.escolher(p.id)}>
      <span class="inicial" aria-hidden="true">{p.nome.slice(0, 1).toUpperCase()}</span>
      <span class="nome">{p.nome}{#if p.id === estado.eu}{' '}<small>(você)</small>{/if}</span>
      {#if pct !== null}
        <span class="pct num" aria-label="{pct}% da água">{pct}%</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .pessoa {
    display: flex;
    align-items: center;
    gap: var(--esp-2);
    min-height: 52px;
    padding: 0 var(--esp-3);
    border-radius: var(--r-2);
    border: 1px solid var(--borda);
    background: var(--superficie);
    color: var(--texto-2);
    text-align: left;
    transition: background var(--mov), border-color var(--mov);
  }
  .pessoa[aria-pressed='true'] { border-color: var(--marca); background: var(--marca-suave); color: var(--texto); }
  .inicial {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--superficie-2);
    font-size: var(--fs-300);
    font-weight: var(--fw-bold);
  }
  .pessoa[aria-pressed='true'] .inicial { background: var(--marca); color: var(--sobre-marca); }
  .nome { flex: 1; min-width: 0; font-weight: var(--fw-semi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nome small { font-weight: var(--fw-normal); color: var(--texto-3); }
  .pct { font-size: var(--fs-200); color: var(--agua); font-weight: var(--fw-semi); }
</style>
