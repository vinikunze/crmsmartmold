<script lang="ts">
  // Metas e horários de cada um (dá para ajustar os do outro também) e conta.
  import { LogOut } from '@lucide/svelte';
  import { estado } from '../lib/estado.svelte';
  import EscolhaPessoa from '../lib/EscolhaPessoa.svelte';
  import AjustesPessoa from './AjustesPessoa.svelte';
</script>

<EscolhaPessoa />

{#if estado.pessoa}
  {#key estado.pessoa.id}<AjustesPessoa pessoa={estado.pessoa} />{/key}
{/if}

<h2 class="secao">Conta</h2>
<div class="cartao conta">
  <p>Entrou como <strong>{estado.email}</strong></p>
  <!-- Sai do Access: a próxima visita pede o código por e-mail de novo. -->
  <a class="botao secundario" href="/cdn-cgi/access/logout"><LogOut size={18} /> Sair</a>
</div>

<style>
  .conta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--esp-3); }
  .conta p { overflow-wrap: anywhere; }
</style>
