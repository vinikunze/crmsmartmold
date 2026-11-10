<script lang="ts">
  // Metas e horários de cada um (dá para ajustar os do outro também) e conta.
  import { LogOut, SunMoon, Sun, Moon } from '@lucide/svelte';
  import { escolhaAtual, escolherTema, type EscolhaTema } from '../lib/tema';

  let tema = $state<EscolhaTema>(escolhaAtual());
  const TEMAS = [
    { valor: 'auto', nome: 'Automático', icone: SunMoon },
    { valor: 'claro', nome: 'Claro', icone: Sun },
    { valor: 'escuro', nome: 'Escuro', icone: Moon },
  ] as const;

  function mudarTema(t: EscolhaTema) {
    tema = t;
    escolherTema(t);
  }
  import { estado } from '../lib/estado.svelte';
  import EscolhaPessoa from '../lib/EscolhaPessoa.svelte';
  import AjustesPessoa from './AjustesPessoa.svelte';
</script>

<EscolhaPessoa />

{#if estado.pessoa}
  {#key estado.pessoa.id}<AjustesPessoa pessoa={estado.pessoa} />{/key}
{/if}

<h2 class="secao">Aparência</h2>
<div class="cartao aparencia">
  <div class="temas" role="group" aria-label="Tema">
    {#each TEMAS as t (t.valor)}
      <button class="chip" aria-pressed={tema === t.valor} onclick={() => mudarTema(t.valor)}><t.icone size={16} /> {t.nome}</button>
    {/each}
  </div>
  <p class="obs">Automático segue o celular: fica escuro quando o modo escuro dele liga. Vale só para este aparelho.</p>
</div>

<h2 class="secao">Conta</h2>
<div class="cartao conta">
  <p>Entrou como <strong>{estado.email}</strong></p>
  <!-- Sai do Access: a próxima visita pede o código por e-mail de novo. -->
  <a class="botao secundario" href="/cdn-cgi/access/logout"><LogOut size={18} /> Sair</a>
</div>

<style>
  .conta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--esp-3); }
  .conta p { overflow-wrap: anywhere; }
  .aparencia { display: grid; gap: var(--esp-3); }
  .temas { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--esp-2); }
  .temas .chip { justify-content: center; }
  .obs { font-size: var(--fs-200); color: var(--texto-3); }
</style>
