<script lang="ts">
  // Água com valor livre, e a lista do dia para apagar algum engano.
  import { Trash, GlassWater } from '@lucide/svelte';
  import { estado } from '../lib/estado.svelte';
  import { formatarMl } from '../../shared/resumo';

  let { pessoaId, dia, fechar }: { pessoaId: number; dia: string; fechar: () => void } = $props();

  const ATALHOS = [100, 200, 300, 750, 1000];
  let ml = $state<number | null>(null);
  let erro = $state('');
  let salvando = $state(false);

  const registros = $derived(
    estado.agua.filter((a) => a.pessoa_id === pessoaId && a.dia === dia).sort((a, b) => b.hora.localeCompare(a.hora) || b.id - a.id),
  );

  async function salvar(e: SubmitEvent) {
    e.preventDefault();
    erro = '';
    if (ml === null || !Number.isInteger(ml) || ml < 10 || ml > 3000) return (erro = 'Coloque entre 10 ml e 3000 ml.');
    salvando = true;
    await estado.beber(pessoaId, dia, ml);
    salvando = false;
    fechar();
  }

  function lerMl(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '');
    ml = v === '' ? null : Number(v);
  }
</script>

<form onsubmit={salvar} novalidate>
  <div class="opcoes">
    {#each ATALHOS as a (a)}
      <button type="button" class="chip num" aria-pressed={ml === a} onclick={() => (ml = a)}>{formatarMl(a)}</button>
    {/each}
  </div>
  <label class="campo">
    <span>Quantidade (ml)</span>
    <input class="entrada num" inputmode="numeric" autocomplete="off" placeholder="Ex.: 350" value={ml ?? ''} oninput={lerMl} />
  </label>
  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
  <button class="botao bloco" type="submit" disabled={salvando}><GlassWater size={18} /> Adicionar água</button>
</form>

<h3 class="sobretitulo titulo-lista">Registros do dia</h3>
{#if registros.length}
  <ul class="cartao lista">
    {#each registros as a (a.id)}
      <li>
        <span class="num hora">{a.hora}</span>
        <span class="num ml">{formatarMl(a.ml)}</span>
        <button class="apagar" onclick={() => estado.desbeber(a)} aria-label="Apagar {formatarMl(a.ml)} das {a.hora}"><Trash size={18} /></button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="vazio">Nenhuma água registrada nesse dia.</p>
{/if}

<style>
  form { display: grid; gap: var(--esp-4); }
  .opcoes { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
  .titulo-lista { margin: var(--esp-5) 0 var(--esp-2); }
  .lista { list-style: none; margin: 0; padding: 0 var(--esp-3); }
  .lista li { display: flex; align-items: center; gap: var(--esp-3); min-height: 52px; border-bottom: 1px solid var(--borda); }
  .lista li:last-child { border-bottom: 0; }
  .hora { color: var(--texto-3); font-size: var(--fs-300); }
  .ml { flex: 1; font-weight: var(--fw-semi); color: var(--agua); }
  .apagar { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: var(--r-1); background: none; color: var(--vermelho); }
  .apagar:hover { background: var(--vermelho-suave); }
</style>
