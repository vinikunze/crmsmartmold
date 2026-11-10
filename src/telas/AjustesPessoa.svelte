<script lang="ts">
  // Metas e plano de horários de uma pessoa. Recriado ao trocar de pessoa.
  import { untrack } from 'svelte';
  import { Minus, Plus, Sparkles, CalendarPlus } from '@lucide/svelte';
  import { linkLembretes } from '../lib/api';
  import { horariosDeAgua, AGUA_DE, AGUA_ATE } from '../../shared/lembretes';
  import type { Pessoa, TipoRefeicao, Recipiente, Cor } from '../../shared/tipos';
  import { REFEICOES, RECIPIENTES, CORES } from '../../shared/tipos';
  import Garrafa from '../lib/Garrafa.svelte';
  import { horaValida } from '../../shared/datas';
  import { formatarMl, sugerirMeta } from '../../shared/resumo';
  import { estado } from '../lib/estado.svelte';
  import { api } from '../lib/api';
  import Icone from '../lib/Icone.svelte';

  let { pessoa }: { pessoa: Pessoa } = $props();
  const p = untrack(() => pessoa);

  let nome = $state(p.nome);
  let recipiente = $state<Recipiente>(p.recipiente);
  let cor = $state<Cor>(p.cor);
  let meta = $state(p.meta_agua_ml);
  let copo = $state(p.copo_ml);
  let garrafa = $state(p.garrafa_ml);
  let peso = $state(p.peso_g === null ? '' : String(p.peso_g / 1000).replace('.', ','));
  let controlaKcal = $state(p.meta_kcal !== null);
  let metaKcal = $state(p.meta_kcal ?? 2000);

  const PLANEJAVEIS = REFEICOES.filter((r) => r.tipo !== 'outro');
  const atual = estado.planoDe(p.id);
  let plano = $state(
    PLANEJAVEIS.map((r) => {
      const h = atual.find((x) => x.tipo === r.tipo);
      return { tipo: r.tipo as TipoRefeicao, nome: r.nome, ativo: !!h, hora: h?.hora ?? r.hora };
    }),
  );

  // Lembretes no calendário do celular: usam o plano SALVO da pessoa.
  let lembrarRefeicoes = $state(true);
  let lembrarAgua = $state<number>(120);
  const planoSalvo = $derived(estado.planoDe(p.id));
  const qtdRefeicoes = $derived(lembrarRefeicoes ? planoSalvo.length : 0);
  const qtdAgua = $derived(horariosDeAgua(lembrarAgua).length);
  const AGUA_OPCOES = [
    { valor: 0, nome: 'Não' },
    { valor: 60, nome: '1 em 1 h' },
    { valor: 120, nome: '2 em 2 h' },
    { valor: 180, nome: '3 em 3 h' },
  ];

  let salvando = $state(false);
  let erro = $state('');

  const pesoG = $derived.by(() => {
    const n = Number(peso.replace(',', '.'));
    return peso.trim() && Number.isFinite(n) && n >= 30 && n <= 300 ? Math.round(n * 1000) : null;
  });
  const sugestao = $derived(pesoG ? sugerirMeta(pesoG) : null);

  const passo = (v: number, d: number, min: number, max: number) => Math.min(max, Math.max(min, v + d));

  async function salvar(e: SubmitEvent) {
    e.preventDefault();
    erro = '';
    if (!nome.trim()) return (erro = 'Coloque um nome.');
    if (peso.trim() && pesoG === null) return (erro = 'Peso entre 30 e 300 kg (ex.: 72,5).');
    if (![meta, copo, garrafa].every(Number.isInteger)) return (erro = 'Use números inteiros em ml.');
    if (controlaKcal && (!Number.isInteger(metaKcal) || metaKcal < 800 || metaKcal > 6000)) return (erro = 'A meta de calorias vai de 800 a 6000.');
    const horarios = plano.filter((h) => h.ativo).map((h) => ({ tipo: h.tipo, hora: h.hora }));
    if (horarios.some((h) => !horaValida(h.hora))) return (erro = 'Confira os horários do plano.');
    salvando = true;
    try {
      const nova = await api.editarPessoa(p.id, {
        nome: nome.trim(), recipiente, cor, meta_agua_ml: meta, copo_ml: copo, garrafa_ml: garrafa,
        meta_kcal: controlaKcal ? metaKcal : null, peso_g: pesoG,
      });
      const salvos = await api.salvarHorarios(p.id, horarios);
      estado.guardarPessoa(nova);
      estado.horarios = [...estado.horarios.filter((h) => h.pessoa_id !== p.id), ...salvos];
      estado.avisar(`Ajustes de ${nova.nome} salvos.`);
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Não deu para salvar.';
    } finally {
      salvando = false;
    }
  }
</script>

{#snippet contador(rotulo: string, valor: number, mudar: (v: number) => void, d: number, min: number, max: number)}
  <div class="campo">
    <span>{rotulo}</span>
    <div class="passo" role="group" aria-label={rotulo}>
      <button type="button" onclick={() => mudar(passo(valor, -d, min, max))} disabled={valor <= min} aria-label="Menos {d} ml"><Minus size={18} /></button>
      <output class="num">{formatarMl(valor)}</output>
      <button type="button" onclick={() => mudar(passo(valor, d, min, max))} disabled={valor >= max} aria-label="Mais {d} ml"><Plus size={18} /></button>
    </div>
  </div>
{/snippet}

<form onsubmit={salvar} novalidate>
  <section class="cartao bloco">
    <label class="campo">
      <span>Nome</span>
      <input class="entrada" bind:value={nome} maxlength="30" />
    </label>
  </section>

  <h2 class="secao">A garrafa de {nome.trim() || p.nome}</h2>
  <section class="cartao bloco">
    <fieldset>
      <legend>Formato</legend>
      <div class="formatos">
        {#each RECIPIENTES as r (r.tipo)}
          <button type="button" class="formato" aria-pressed={recipiente === r.tipo} onclick={() => (recipiente = r.tipo)}>
            <span class="desenho"><Garrafa pct={62} tipo={r.tipo} {cor} pequena /></span>
            <span>{r.nome}</span>
          </button>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>Cor</legend>
      <div class="cores">
        {#each CORES as c (c.cor)}
          <button type="button" class="cor cor-{c.cor}" aria-pressed={cor === c.cor} aria-label={c.nome} title={c.nome} onclick={() => (cor = c.cor)}></button>
        {/each}
      </div>
    </fieldset>
    <p class="obs">A cor também pinta a inicial de {nome.trim() || p.nome} nas telas. Quando a meta do dia é batida, a tampa fica dourada.</p>
  </section>

  <h2 class="secao">Água</h2>
  <section class="cartao bloco">
    {@render contador('Meta do dia', meta, (v) => (meta = v), 250, 500, 8000)}
    <div class="peso">
      <label class="campo">
        <span>Peso (opcional)</span>
        <input class="entrada num" inputmode="decimal" bind:value={peso} placeholder="kg" autocomplete="off" />
      </label>
      {#if sugestao}
        <button type="button" class="botao contorno sugerir" onclick={() => (meta = sugestao)} disabled={meta === sugestao}>
          <Sparkles size={16} /> Usar {formatarMl(sugestao)}
        </button>
      {/if}
    </div>
    <p class="obs">
      Sugestão comum: 35 ml por quilo. Para gestação, atividade física puxada ou alguma condição de saúde, vale
      confirmar a meta com um médico ou nutricionista.
    </p>
    <div class="dupla">
      {@render contador('Botão "Copo"', copo, (v) => (copo = v), 50, 50, 2000)}
      {@render contador('Botão "Garrafa"', garrafa, (v) => (garrafa = v), 50, 50, 2000)}
    </div>
  </section>

  <h2 class="secao">Plano de horários</h2>
  <section class="cartao plano">
    <p class="obs">As refeições marcadas aparecem no dia como previstas, e o app avisa quando passa do horário.</p>
    <ul>
      {#each plano as h (h.tipo)}
        <li>
          <label class="marcar">
            <input type="checkbox" bind:checked={h.ativo} />
            <span class="icone-refeicao" class:apagado={!h.ativo}><Icone tipo={h.tipo} /></span>
            <span class="nome">{h.nome}</span>
          </label>
          <input class="entrada hora num" type="time" bind:value={h.hora} disabled={!h.ativo} aria-label="Horário de {h.nome}" />
        </li>
      {/each}
    </ul>
  </section>

  <h2 class="secao">Calorias</h2>
  <section class="cartao bloco">
    <label class="marcar">
      <input type="checkbox" bind:checked={controlaKcal} />
      <span>Quero uma meta de calorias</span>
    </label>
    {#if controlaKcal}
      <label class="campo">
        <span>Meta do dia (kcal)</span>
        <input class="entrada num" type="number" inputmode="numeric" min="800" max="6000" step="50" bind:value={metaKcal} />
      </label>
    {/if}
    <p class="obs">As calorias de cada refeição são opcionais. Sem meta, o total do dia só aparece quando alguma refeição tiver calorias.</p>
  </section>

  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
  <button class="botao bloco salvar" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : `Salvar ajustes de ${nome.trim() || p.nome}`}</button>
</form>

<h2 class="secao">Lembretes no celular</h2>
<section class="cartao bloco">
  <p class="obs">
    O app não manda notificação sozinho. Em vez disso, ele põe lembretes que se repetem todo dia no
    <strong>calendário do celular</strong>, e é o calendário que avisa na hora.
  </p>
  <label class="marcar">
    <input type="checkbox" bind:checked={lembrarRefeicoes} />
    <span>Refeições do plano <small class="num">({planoSalvo.length === 0 ? 'plano vazio' : planoSalvo.map((h) => h.hora).join(', ')})</small></span>
  </label>
  <fieldset>
    <legend>Água, das {Number(AGUA_DE.slice(0, 2))}h às {Number(AGUA_ATE.slice(0, 2))}h</legend>
    <div class="intervalos">
      {#each AGUA_OPCOES as o (o.valor)}
        <button type="button" class="chip" aria-pressed={lembrarAgua === o.valor} onclick={() => (lembrarAgua = o.valor)}>{o.nome}</button>
      {/each}
    </div>
  </fieldset>
  {#if qtdRefeicoes + qtdAgua > 0}
    <a class="botao bloco" href={linkLembretes(p.id, lembrarRefeicoes, lembrarAgua)} target="_blank" rel="noopener">
      <CalendarPlus size={18} /> Adicionar {qtdRefeicoes + qtdAgua} {qtdRefeicoes + qtdAgua === 1 ? 'lembrete' : 'lembretes'} ao calendário
    </a>
  {:else}
    <p class="obs">Escolha pelo menos um lembrete.</p>
  {/if}
  <p class="obs">
    Vale para os horários <strong>salvos</strong> de {p.nome}, neste celular. Mudou um horário? Salve e adicione de novo: o
    lembrete é atualizado. Para tirar um lembrete, apague o evento no calendário e escolha "todos os eventos futuros".
  </p>
</section>


<style>
  form { display: grid; }
  .bloco { display: grid; gap: var(--esp-4); }
  .secao:first-of-type { margin-top: var(--esp-5); }
  .obs { font-size: var(--fs-200); color: var(--texto-3); }
  .dupla { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-3); }
  .peso { display: grid; grid-template-columns: 1fr auto; gap: var(--esp-3); align-items: end; }
  .sugerir { padding: 0 var(--esp-3); }

  .passo { display: flex; align-items: center; height: 48px; border: 1px solid var(--borda); border-radius: var(--r-1); background: var(--superficie); }
  .passo button { display: grid; place-items: center; width: 44px; height: 100%; border: 0; background: none; color: var(--marca); flex: none; }
  .passo button:disabled { color: var(--texto-3); opacity: 0.5; }
  .passo output { flex: 1; text-align: center; font-weight: var(--fw-semi); }

  .plano { display: grid; gap: var(--esp-2); padding-bottom: var(--esp-2); }
  .plano ul { list-style: none; margin: 0; padding: 0; }
  .plano li { display: flex; align-items: center; gap: var(--esp-3); min-height: 60px; border-bottom: 1px solid var(--borda); }
  .plano li:last-child { border-bottom: 0; }
  .marcar { display: flex; align-items: center; gap: var(--esp-3); flex: 1; min-width: 0; cursor: pointer; }
  .marcar input { width: 20px; height: 20px; accent-color: var(--marca); flex: none; }
  .nome { font-weight: var(--fw-medium); }
  .icone-refeicao.apagado { background: var(--superficie-2); color: var(--texto-3); }
  .hora { width: 8.5em; flex: none; }
  .hora:disabled { opacity: 0.45; }

  .formatos { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--esp-2); }
  .formato {
    display: grid;
    justify-items: center;
    gap: var(--esp-1);
    padding: var(--esp-3) var(--esp-1) var(--esp-2);
    border-radius: var(--r-2);
    border: 1px solid var(--borda);
    background: var(--superficie);
    color: var(--texto-2);
    font-size: var(--fs-100);
    font-weight: var(--fw-medium);
    line-height: 1.2;
    transition: border-color var(--mov), background var(--mov);
  }
  .formato[aria-pressed='true'] { border-color: var(--marca); background: var(--marca-suave); color: var(--texto); font-weight: var(--fw-semi); box-shadow: 0 0 0 1px var(--marca); }
  .desenho { width: 34px; height: 60px; }
  .cores { display: flex; flex-wrap: wrap; gap: var(--esp-3); }
  .cor { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--superficie); background: var(--p); box-shadow: 0 0 0 1px var(--borda); transition: box-shadow var(--mov); }
  .cor[aria-pressed='true'] { box-shadow: 0 0 0 3px var(--texto); }

  .intervalos { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
  .marcar small { color: var(--texto-3); }

  .salvar { margin-top: var(--esp-5); }
</style>
