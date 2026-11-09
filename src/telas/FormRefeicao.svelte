<script lang="ts">
  // Lançar ou editar uma refeição. Só "o que comeu" é obrigatório: refeição
  // e horário já vêm preenchidos pela hora. "Os dois" lança a mesma refeição
  // para o casal de uma vez (almoçaram juntos).
  import { untrack } from 'svelte';
  import { Trash, Users } from '@lucide/svelte';
  import type { Refeicao, TipoRefeicao } from '../../shared/tipos';
  import { REFEICOES } from '../../shared/tipos';
  import { horaAgora, horaValida, diaValido } from '../../shared/datas';
  import { tipoPelaHora, maisComidos } from '../../shared/sugestoes';
  import { estado, type Gaveta } from '../lib/estado.svelte';
  import { api, novaChave } from '../lib/api';
  import Icone from '../lib/Icone.svelte';

  let { nova, editar, fechar }: { nova?: Extract<Gaveta, { tipo: 'nova' }>; editar?: Refeicao; fechar: () => void } = $props();

  // Valores iniciais: lidos uma vez ao abrir. A gaveta é recriada a cada refeição.
  const base = untrack(() => editar);
  const inicio = untrack(() => nova);
  const hojeDia = estado.relogio.dia;

  const diaInicial = base?.dia ?? inicio?.dia ?? hojeDia;
  const horaInicial = base?.hora ?? inicio?.hora ?? (diaInicial === hojeDia ? horaAgora() : '12:00');
  const donoInicial = base?.pessoa_id ?? inicio?.pessoa_id ?? estado.pessoaId;
  let dia = $state(diaInicial);
  let hora = $state(horaInicial);
  /** Para quem: ids das pessoas. Editando, é sempre a dona da refeição. */
  let quem = $state<number[]>([donoInicial]);
  let tipo = $state<TipoRefeicao>(base?.tipo ?? inicio?.refeicao ?? tipoPelaHora(horaInicial, estado.planoDe(donoInicial)));
  let descricao = $state(base?.descricao ?? '');
  let kcal = $state<number | null>(base?.kcal ?? null);
  let obs = $state(base?.obs ?? '');
  let salvando = $state(false);
  let erro = $state('');
  let confirmarApagar = $state(false);
  // Uma chave por pessoa, a mesma em todas as tentativas: reenviar não duplica.
  const chaves = new Map<number, string>();

  const osDois = $derived(quem.length > 1);
  const sugestoes = $derived(
    maisComidos(estado.refeicoes, quem[0], tipo).filter((s) => s.trim().toLowerCase() !== descricao.trim().toLowerCase()),
  );

  function escolherQuem(ids: number[]) {
    quem = ids;
  }

  async function salvar(e: SubmitEvent) {
    e.preventDefault();
    erro = '';
    if (!descricao.trim()) return (erro = 'Conte o que comeu.');
    if (!diaValido(dia)) return (erro = 'Escolha o dia.');
    if (dia > hojeDia) return (erro = 'Ainda não chegou esse dia.');
    if (!horaValida(hora)) return (erro = 'Escolha o horário.');
    if (kcal !== null && (!Number.isInteger(kcal) || kcal < 1 || kcal > 5000)) return (erro = 'Calorias vão de 1 a 5000.');
    salvando = true;
    const dados = { dia, hora, tipo, descricao: descricao.trim(), kcal, obs: obs.trim() || null };
    try {
      if (base) {
        estado.guardarRefeicao(await api.editarRefeicao(base.id, dados));
        estado.avisar('Refeição salva.');
      } else {
        for (const pessoa_id of quem) {
          if (!chaves.has(pessoa_id)) chaves.set(pessoa_id, novaChave());
          const r = await api.criarRefeicao({ ...dados, chave: chaves.get(pessoa_id)!, pessoa_id });
          estado.guardarRefeicao(r);
        }
        const nome = REFEICOES.find((r) => r.tipo === tipo)?.nome ?? 'Refeição';
        estado.avisar(osDois ? `${nome} lançado para os dois.` : `${nome} registrado.`);
      }
      fechar();
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Não deu para salvar.';
    } finally {
      salvando = false;
    }
  }

  async function apagar() {
    if (!base) return;
    if (!confirmarApagar) return (confirmarApagar = true);
    salvando = true;
    try {
      await api.apagarRefeicao(base.id);
      estado.tirarRefeicao(base.id);
      estado.avisar('Refeição apagada.');
      fechar();
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Não deu para apagar.';
      salvando = false;
    }
  }

  function lerKcal(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '');
    kcal = v === '' ? null : Number(v);
  }
</script>

<form onsubmit={salvar} novalidate>
  {#if base}
    <p class="dono">De <strong>{estado.nomeDe(base.pessoa_id)}</strong></p>
  {:else}
    <fieldset>
      <legend>De quem</legend>
      <div class="opcoes">
        {#each estado.pessoas as p (p.id)}
          <button type="button" class="chip" aria-pressed={!osDois && quem[0] === p.id} onclick={() => escolherQuem([p.id])}>{p.nome}</button>
        {/each}
        {#if estado.pessoas.length > 1}
          <button type="button" class="chip" aria-pressed={osDois} onclick={() => escolherQuem(estado.pessoas.map((p) => p.id))}>
            <Users size={16} /> Os dois
          </button>
        {/if}
      </div>
    </fieldset>
  {/if}

  <fieldset>
    <legend>Refeição</legend>
    <div class="opcoes tipos">
      {#each REFEICOES as r (r.tipo)}
        <button type="button" class="chip" aria-pressed={tipo === r.tipo} onclick={() => (tipo = r.tipo)}>
          <Icone tipo={r.tipo} tamanho={16} /> {r.nome}
        </button>
      {/each}
    </div>
  </fieldset>

  <div class="dupla">
    <label class="campo">
      <span>Dia</span>
      <input class="entrada" type="date" bind:value={dia} max={hojeDia} />
    </label>
    <label class="campo">
      <span>Horário</span>
      <input class="entrada num" type="time" bind:value={hora} />
    </label>
  </div>

  <label class="campo">
    <span>O que comeu</span>
    <textarea class="entrada" bind:value={descricao} maxlength="300" placeholder="Ex.: Arroz, feijão, frango grelhado e salada"></textarea>
  </label>

  {#if sugestoes.length}
    <div class="sugestoes">
      <p class="sobretitulo">Repetir</p>
      <div class="opcoes">
        {#each sugestoes as s (s)}
          <button type="button" class="chip sugestao" onclick={() => (descricao = s)}>{s}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="dupla">
    <label class="campo">
      <span>Calorias (opcional)</span>
      <input class="entrada num" inputmode="numeric" autocomplete="off" placeholder="kcal" value={kcal ?? ''} oninput={lerKcal} />
    </label>
    <label class="campo">
      <span>Observação</span>
      <input class="entrada" bind:value={obs} maxlength="300" placeholder="Ex.: comi com pressa" />
    </label>
  </div>

  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}

  <div class="acoes">
    <button class="botao bloco" type="submit" disabled={salvando}>
      {salvando ? 'Salvando…' : base ? 'Salvar' : osDois ? 'Registrar para os dois' : 'Registrar'}
    </button>
    {#if base}
      <button type="button" class="botao perigo bloco" onclick={apagar} disabled={salvando}>
        <Trash size={18} /> {confirmarApagar ? 'Toque de novo para apagar' : 'Apagar refeição'}
      </button>
    {/if}
  </div>
</form>

<style>
  form { display: grid; gap: var(--esp-4); }
  .dono { font-size: var(--fs-300); color: var(--texto-2); }
  .opcoes { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
  .opcoes :global(svg) { flex: none; }
  .dupla { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-3); align-items: start; }
  .sugestoes { display: grid; gap: var(--esp-2); margin-top: calc(-1 * var(--esp-2)); }
  .sugestao { max-width: 100%; overflow: hidden; text-overflow: ellipsis; background: var(--marca-suave); border-color: transparent; color: var(--marca); }
  .acoes { display: grid; gap: var(--esp-2); margin-top: var(--esp-2); }
</style>
