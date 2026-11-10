<script lang="ts">
  // Vini / Sophia, lado a lado. Com `dia`, cada botão traz uma garrafinha com
  // a água da pessoa naquele dia, para um ver o outro sem trocar de tela.
  // Sem `dia` (Ajustes), só a inicial com a cor da pessoa.
  import { estado } from './estado.svelte';
  import Garrafa from './Garrafa.svelte';
  import { aguaDoDia, porcentagem, formatarMl } from '../../shared/resumo';

  let { dia }: { dia?: string } = $props();
</script>

<div class="pessoas" role="group" aria-label="De quem">
  {#each estado.pessoas as p (p.id)}
    {@const tomado = dia ? aguaDoDia(estado.agua, p.id, dia) : 0}
    {@const pct = porcentagem(tomado, p.meta_agua_ml)}
    <button type="button" class="pessoa" class:com-agua={!!dia} aria-pressed={estado.pessoaId === p.id} onclick={() => estado.escolher(p.id)}>
      {#if dia}
        <span class="mini" aria-hidden="true"><Garrafa pct={pct} tipo={p.recipiente} cor={p.cor} pequena /></span>
      {:else}
        <span class="inicial cor-{p.cor}" aria-hidden="true">{p.nome.slice(0, 1).toUpperCase()}</span>
      {/if}
      <span class="textos">
        <span class="nome">{p.nome}{#if p.id === estado.eu}{' '}<small>(você)</small>{/if}</span>
        {#if dia}
          <span class="agua num">{formatarMl(tomado)}</span>
        {/if}
      </span>
      {#if dia}
        <span class="pct num" class:bateu={pct >= 100}>{pct >= 100 ? '✓' : `${pct}%`}<span class="sr"> da meta de água</span></span>
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
    padding: var(--esp-2) var(--esp-3);
    border-radius: var(--r-2);
    border: 1px solid var(--borda);
    background: var(--superficie);
    color: var(--texto-2);
    text-align: left;
    box-shadow: var(--sombra);
    transition: background var(--mov), border-color var(--mov), box-shadow var(--mov);
  }
  .pessoa.com-agua { min-height: 68px; }
  .pessoa[aria-pressed='true'] { border-color: var(--agua); background: var(--agua-suave); color: var(--texto); box-shadow: 0 0 0 1px var(--agua); }
  .mini { flex: none; width: 26px; height: 46px; }
  .inicial {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--p);
    color: var(--p-sobre);
    font-size: var(--fs-300);
    font-weight: var(--fw-bold);
  }
  .textos { flex: 1; min-width: 0; display: grid; }
  .nome { font-weight: var(--fw-semi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nome small { font-weight: var(--fw-normal); color: var(--texto-3); }
  .agua { font-size: var(--fs-200); color: var(--agua); font-weight: var(--fw-semi); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pct { flex: none; font-size: var(--fs-200); color: var(--texto-3); font-weight: var(--fw-semi); }
  .pct.bateu { color: var(--ouro-texto); font-size: var(--fs-400); }
</style>
