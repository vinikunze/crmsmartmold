<script lang="ts">
  import { onMount } from 'svelte';
  import { estado } from './lib/estado.svelte';
  import Gaveta from './lib/Gaveta.svelte';
  import Aviso from './lib/Aviso.svelte';
  import Hoje from './telas/Hoje.svelte';
  import Historico from './telas/Historico.svelte';
  import Ajustes from './telas/Ajustes.svelte';
  import FormRefeicao from './telas/FormRefeicao.svelte';
  import FormAgua from './telas/FormAgua.svelte';
  import { diaValido } from '../shared/datas';
  import { aguaDoDia, porcentagem } from '../shared/resumo';
  import { Sun, ChartColumn, Settings, Plus } from '@lucide/svelte';

  const TELAS = [
    { id: 'hoje', nome: 'Hoje', icone: Sun },
    { id: 'historico', nome: 'Histórico', icone: ChartColumn },
    { id: 'ajustes', nome: 'Ajustes', icone: Settings },
  ] as const;

  // Rotas pelo endereço: #hoje, #hoje/2026-11-07, #historico, #ajustes.
  // O botão voltar do celular funciona sem esforço.
  const lerRota = () => {
    const [tela = 'hoje', param] = location.hash.slice(1).split('/');
    return { tela: tela || 'hoje', dia: tela === 'hoje' && diaValido(param) ? param : null };
  };
  let rota = $state(lerRota());
  let pronto = $state(false);
  let erroInicial = $state('');

  onMount(() => {
    const aoMudar = () => {
      rota = lerRota();
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', aoMudar);
    estado.carregar()
      .then(() => (pronto = true))
      .catch((e) => (erroInicial = e.message));
    return () => window.removeEventListener('hashchange', aoMudar);
  });

  // Dia da tela Hoje: o do endereço ou hoje. Dia no futuro vira hoje.
  const dia = $derived(rota.dia && rota.dia <= estado.relogio.dia ? rota.dia : estado.relogio.dia);
  const titulo = $derived(TELAS.find((t) => t.id === rota.tela)?.nome ?? 'em dia.');

  function nova() {
    estado.gaveta = { tipo: 'nova', dia: rota.tela === 'hoje' ? dia : estado.relogio.dia, pessoa_id: estado.pessoaId };
  }

  const fechar = () => (estado.gaveta = null);
  const tituloGaveta = (g: NonNullable<typeof estado.gaveta>) =>
    g.tipo === 'nova' ? 'Nova refeição' : g.tipo === 'editar' ? 'Refeição' : `Água de ${estado.nomeDe(g.pessoa_id)}`;
</script>

<div class="casca">
  <nav class="lateral" aria-label="Telas">
    <div class="logo">
      <span class="palavra">em dia<span class="ponto">.</span></span>
      <span class="casal">Vinícius &amp; Sophia</span>
    </div>
    {#each TELAS.slice(0, 2) as t (t.id)}
      <a href="#{t.id}" aria-current={rota.tela === t.id ? 'page' : undefined}>
        <t.icone size={20} /> {t.nome}
      </a>
    {/each}
    {#if pronto}
      <p class="sobretitulo grupo">Água hoje</p>
      {#each estado.pessoas as p (p.id)}
        {@const pct = porcentagem(aguaDoDia(estado.agua, p.id, estado.relogio.dia), p.meta_agua_ml)}
        <div class="agua-lateral">
          <span>{p.nome}</span>
          <span class="num">{pct}%</span>
          <div class="barra" aria-hidden="true"><i style:width="{Math.min(100, pct)}%"></i></div>
        </div>
      {/each}
    {/if}
    <div class="pe">
      <a href="#ajustes" aria-current={rota.tela === 'ajustes' ? 'page' : undefined}>
        <Settings size={20} /> Ajustes
      </a>
    </div>
  </nav>

  <div class="principal">
    <header class="topo">
      {#if rota.tela === 'hoje'}
        <h1 class="titulo marca">em dia<span class="ponto">.</span></h1>
      {:else}
        <h1 class="titulo">{titulo}</h1>
      {/if}
      <div class="acoes-topo">
        {#if pronto && rota.tela !== 'ajustes'}
          <button class="botao so-computador" onclick={nova}><Plus size={18} /> Nova refeição</button>
        {/if}
        <!-- No celular, Ajustes mora aqui (como no app de finanças) e o + fica no meio da barra de baixo. -->
        <a class="engrenagem so-celular" href="#ajustes" aria-label="Ajustes" aria-current={rota.tela === 'ajustes' ? 'page' : undefined}>
          <Settings size={22} />
        </a>
      </div>
    </header>

    <main>
      {#if erroInicial}
        <div class="cartao erro-inicial" role="alert">
          <p>{erroInicial}</p>
          <div class="botoes-erro">
            <button class="botao" onclick={() => location.reload()}>Tentar de novo</button>
            <a class="botao secundario" href="/cdn-cgi/access/logout">Sair</a>
          </div>
        </div>
      {:else if !pronto}
        <p class="vazio">Carregando…</p>
      {:else if rota.tela === 'hoje'}
        <Hoje {dia} />
      {:else if rota.tela === 'historico'}
        <Historico />
      {:else if rota.tela === 'ajustes'}
        <Ajustes />
      {:else}
        <p class="cartao vazio">Página não encontrada. <a href="#hoje">Voltar para hoje</a></p>
      {/if}
    </main>
  </div>

  <!-- Hoje · + · Histórico: o + no meio não cobre nada da tela. -->
  <nav class="inferior" aria-label="Telas">
    {#each TELAS.slice(0, 1) as t (t.id)}
      <a href="#{t.id}" aria-current={rota.tela === t.id ? 'page' : undefined}><t.icone size={22} /><span>{t.nome}</span></a>
    {/each}
    <div class="centro">
      <button class="mais" onclick={nova} disabled={!pronto} aria-label="Nova refeição"><Plus size={28} /></button>
    </div>
    {#each TELAS.slice(1, 2) as t (t.id)}
      <a href="#{t.id}" aria-current={rota.tela === t.id ? 'page' : undefined}><t.icone size={22} /><span>{t.nome}</span></a>
    {/each}
  </nav>
</div>

{#if estado.gaveta}
  {@const g = estado.gaveta}
  <Gaveta titulo={tituloGaveta(g)} {fechar}>
    {#if g.tipo === 'nova'}
      <FormRefeicao nova={g} {fechar} />
    {:else if g.tipo === 'editar'}
      {#key g.refeicao.id}<FormRefeicao editar={g.refeicao} {fechar} />{/key}
    {:else}
      <FormAgua pessoaId={g.pessoa_id} dia={g.dia} {fechar} />
    {/if}
  </Gaveta>
{/if}

<Aviso />

<style>
  .casca { min-height: 100dvh; }
  .principal {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 var(--esp-4) calc(var(--barra-inferior) + 48px + env(safe-area-inset-bottom));
  }
  .topo {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--esp-2);
    min-height: 64px;
    padding: calc(var(--esp-3) + env(safe-area-inset-top)) 0 var(--esp-3);
    background: var(--fundo);
  }
  .titulo { font-size: var(--fs-600); font-weight: var(--fw-bold); letter-spacing: -0.01em; }
  .marca, .palavra { color: var(--marca); letter-spacing: -0.03em; }
  .ponto { color: var(--sol); }
  .so-computador { display: none !important; }
  .erro-inicial { display: grid; gap: var(--esp-4); color: var(--texto-2); }
  .botoes-erro { display: flex; flex-wrap: wrap; gap: var(--esp-2); }

  .inferior {
    position: fixed;
    z-index: 30;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: calc(var(--barra-inferior) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--superficie);
    border-top: 1px solid var(--borda);
  }
  .inferior a {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--texto-3);
    text-decoration: none;
    font-size: var(--fs-100);
    font-weight: var(--fw-medium);
  }
  .inferior a[aria-current='page'] { color: var(--marca); font-weight: var(--fw-bold); }

  .centro { display: grid; place-items: center; }
  .mais {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    margin-top: -26px;
    border-radius: 50%;
    border: 4px solid var(--fundo);
    background: var(--marca);
    color: #ffffff;
    box-shadow: 0 8px 20px rgb(23 38 31 / 0.28);
    transition: transform var(--mov);
  }
  .mais:active { transform: scale(0.94); }
  .mais:disabled { opacity: 0.6; }

  .acoes-topo { display: flex; align-items: center; gap: var(--esp-2); }
  .engrenagem { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--texto-2); }
  .engrenagem:hover { background: var(--superficie-2); }
  .engrenagem[aria-current='page'] { background: var(--marca-suave); color: var(--marca); }

  .lateral { display: none; }

  @media (min-width: 1024px) {
    .inferior, .so-celular { display: none !important; }
    .so-computador { display: inline-flex !important; }
    .lateral {
      position: fixed;
      inset: 0 auto 0 0;
      width: var(--lateral);
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--esp-5) var(--esp-3);
      background: var(--superficie);
      border-right: 1px solid var(--borda);
      overflow-y: auto;
    }
    .logo { display: grid; padding: 0 var(--esp-3) var(--esp-5); }
    .palavra { font-size: var(--fs-600); font-weight: var(--fw-bold); line-height: 1; }
    .casal { font-size: var(--fs-100); font-weight: var(--fw-semi); letter-spacing: 0.06em; text-transform: uppercase; color: var(--texto-3); margin-top: 6px; }
    .lateral a {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      min-height: 44px;
      padding: 0 var(--esp-3);
      border-radius: var(--r-1);
      color: var(--texto-2);
      text-decoration: none;
      font-weight: var(--fw-medium);
    }
    .lateral a:hover { background: var(--superficie-2); }
    .lateral a[aria-current='page'] { background: var(--marca-suave); color: var(--marca); font-weight: var(--fw-semi); }
    .grupo { padding: var(--esp-5) var(--esp-3) var(--esp-2); }
    .agua-lateral {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px var(--esp-2);
      padding: var(--esp-2) var(--esp-3);
      font-size: var(--fs-300);
      color: var(--texto-2);
    }
    .agua-lateral .num { color: var(--agua); font-weight: var(--fw-semi); }
    .agua-lateral .barra { grid-column: 1 / -1; height: 6px; }
    .pe { margin-top: auto; padding-top: var(--esp-4); }
    .principal { margin-left: var(--lateral); padding: 0 var(--esp-6) var(--esp-6); max-width: calc(820px + var(--lateral)); }
  }
</style>
