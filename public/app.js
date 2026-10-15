// CRM Smart Mold — painel administrativo (SPA sem build)

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TZ = 'America/Sao_Paulo';
const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ }) : '');
const fmtDataHora = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fmtMoeda = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

const state = {
  user: null,
  meta: null,
  usuarios: [],
  origens: [],
  cidades: [],
  filtros: { q: '', categoria: [], etapa: '', cidade: '', origem: '', responsavel: '', de: '', ate: '', ordem: 'recentes', pagina: 1 },
  refresh: null,
};

// ---------- API ----------

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: { 'X-CRM': '1' }, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/login')) {
      const expirou = Boolean(state.user);
      state.user = null;
      renderLogin(expirou ? 'Sua sessão expirou. Entre novamente.' : '');
    } else if (res.status === 403 && data.erro?.includes('senha provisória')) {
      renderTrocarSenha();
    }
    throw new ApiError(res.status, data.erro || `Erro ${res.status}`);
  }
  return data;
}

function toast(msg) {
  $$('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function erroToast(err) {
  if (err instanceof ApiError && (err.status === 401 || (err.status === 403 && err.message.includes('senha provisória')))) return;
  toast(err.message || 'Algo deu errado.');
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Copiado!');
  } catch {
    toast('Não foi possível copiar automaticamente. Selecione e copie.');
  }
}

// ---------- Tema ----------

function aplicarTema(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function lerTema() {
  try {
    return localStorage.getItem('crm-tema') || 'auto';
  } catch {
    return 'auto';
  }
}
function alternarTema() {
  const ordem = ['auto', 'light', 'dark'];
  const novo = ordem[(ordem.indexOf(lerTema()) + 1) % 3];
  try {
    localStorage.setItem('crm-tema', novo);
  } catch {
    /* sem armazenamento */
  }
  aplicarTema(novo);
  const b = $('#btn-tema');
  if (b) b.textContent = rotuloTema();
}
const rotuloTema = () => ({ auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro' })[lerTema()];
aplicarTema(lerTema());

// ---------- Helpers de UI ----------

const etapas = () => state.meta?.etapas || [];
const nomeEtapa = (id) => etapas().find((e) => e.id === id)?.nome || id;
const badgeCat = (cat, score) =>
  `<span class="badge" title="Lead ${esc(cat)}${score != null ? ` · ${esc(score)} pts` : ''}"><span class="dot ${esc(cat)}"></span>Lead ${esc(cat)}${
    score != null ? ` <span class="muted">${esc(score)}</span>` : ''
  }</span>`;
const opcoesEtapa = (sel) => etapas().map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
const isAdmin = () => state.user?.papel === 'admin';

function linkWhats(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return `https://wa.me/${d}`;
}

const ICONES = {
  painel: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  leads: '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
  pipeline: '<path d="M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z"/>',
  usuarios: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
  integracoes: '<path d="M10.59 13.41a1.98 1.98 0 0 0 2.82 0l4-4a2 2 0 1 0-2.83-2.83l-.88.88-1.41-1.41.88-.88a4 4 0 0 1 5.66 5.66l-4 4a4 4 0 0 1-5.66 0l1.42-1.42zm2.82-2.82a1.98 1.98 0 0 0-2.82 0l-4 4a2 2 0 1 0 2.83 2.83l.88-.88 1.41 1.41-.88.88a4 4 0 0 1-5.66-5.66l4-4a4 4 0 0 1 5.66 0l-1.42 1.42z"/>',
  site: '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm2 3v11h14V8H5zm2 2h6v2H7v-2zm0 4h10v2H7v-2z"/>',
};
const icone = (n) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONES[n]}</svg>`;

// ---------- Login e senha ----------

function marca() {
  return `<div class="brand"><div class="brand-mark">SM</div><div><div class="brand-name">Smart Mold</div><div class="brand-sub">CRM comercial</div></div></div>`;
}

function renderLogin(aviso = '') {
  fecharDrawer();
  $('#app').innerHTML = `
    <div class="auth"><form class="auth-box" id="form-login" autocomplete="on">
      ${marca()}
      <h1>Entrar</h1>
      ${aviso ? `<div class="alert warn">${esc(aviso)}</div>` : ''}
      <div class="alert error hidden" id="login-erro" role="alert"></div>
      <label class="field">E-mail<input class="input" type="email" name="email" autocomplete="username" required autofocus /></label>
      <label class="field">Senha<input class="input" type="password" name="senha" autocomplete="current-password" required /></label>
      <button class="btn primary" type="submit">Entrar</button>
      <p class="muted small">Acesso restrito à equipe Smart Mold. Após 5 tentativas incorretas a conta é bloqueada por 15 minutos.</p>
    </form></div>`;
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('button', e.target);
    btn.disabled = true;
    try {
      const { user } = await api('/api/auth/login', { method: 'POST', body: { email: f.get('email'), senha: f.get('senha') } });
      state.user = user;
      if (user.trocar_senha) renderTrocarSenha();
      else iniciarApp();
    } catch (err) {
      const box = $('#login-erro');
      box.textContent = err.message;
      box.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}

function formSenhaHtml(obrigatorio) {
  return `
    <form id="form-senha" class="${obrigatorio ? 'auth-box' : ''}" style="display:flex;flex-direction:column;gap:14px">
      ${obrigatorio ? marca() : ''}
      <h1>${obrigatorio ? 'Defina sua senha' : 'Trocar senha'}</h1>
      ${obrigatorio ? '<div class="alert warn">Você entrou com uma senha provisória. Crie uma senha pessoal para continuar.</div>' : ''}
      <div class="alert error hidden" id="senha-erro" role="alert"></div>
      <label class="field">Senha atual${obrigatorio ? ' (provisória)' : ''}<input class="input" type="password" name="senha_atual" autocomplete="current-password" required /></label>
      <label class="field">Nova senha<input class="input" type="password" name="nova_senha" autocomplete="new-password" minlength="10" required /></label>
      <label class="field">Confirme a nova senha<input class="input" type="password" name="confirma" autocomplete="new-password" minlength="10" required /></label>
      <p class="muted small" style="margin:0">Mínimo de 10 caracteres, com letras e números.</p>
      <div class="actions">
        <button class="btn primary" type="submit">Salvar nova senha</button>
        ${obrigatorio ? '<button class="btn ghost" type="button" id="btn-sair-senha">Sair</button>' : '<button class="btn ghost" type="button" data-fechar>Cancelar</button>'}
      </div>
    </form>`;
}

function ligarFormSenha(root, aoConcluir) {
  $('#form-senha', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const box = $('#senha-erro', root);
    if (f.get('nova_senha') !== f.get('confirma')) {
      box.textContent = 'As senhas não conferem.';
      box.classList.remove('hidden');
      return;
    }
    try {
      await api('/api/auth/senha', { method: 'POST', body: { senha_atual: f.get('senha_atual'), nova_senha: f.get('nova_senha') } });
      toast('Senha alterada com sucesso.');
      aoConcluir();
    } catch (err) {
      box.textContent = err.message;
      box.classList.remove('hidden');
    }
  });
}

function renderTrocarSenha() {
  fecharDrawer();
  $('#app').innerHTML = `<div class="auth">${formSenhaHtml(true)}</div>`;
  ligarFormSenha($('#app'), async () => {
    const { user } = await api('/api/auth/me');
    state.user = user;
    iniciarApp();
  });
  $('#btn-sair-senha').addEventListener('click', sair);
}

function modalTrocarSenha() {
  const m = abrirModal(formSenhaHtml(false));
  ligarFormSenha(m, () => m.remove());
}

async function sair() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignora */
  }
  state.user = null;
  location.hash = '';
  renderLogin();
}

// ---------- Modal ----------

function abrirModal(html) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-fechar]')) m.remove();
  });
  document.body.appendChild(m);
  $('input, select, textarea', m)?.focus();
  return m;
}

// ---------- Shell e rotas ----------

const ROTAS = {
  painel: { titulo: 'Painel', render: viewPainel },
  leads: { titulo: 'Leads', render: viewLeads },
  pipeline: { titulo: 'Pipeline', render: viewPipeline },
  usuarios: { titulo: 'Usuários', render: viewUsuarios, admin: true },
  integracoes: { titulo: 'Integrações', render: viewIntegracoes, admin: true },
  site: { titulo: 'Formulário do site', render: viewSite },
};

function renderShell(ativa) {
  const item = (id, rot) =>
    `<a href="#/${id}" class="${ativa === id ? 'active' : ''}" ${ativa === id ? 'aria-current="page"' : ''}>${icone(id)}${esc(rot)}</a>`;
  $('#app').innerHTML = `
    <div class="shell" id="shell">
      <aside class="sidebar" aria-label="Menu">
        ${marca()}
        <nav class="nav">
          ${item('painel', 'Painel')}
          ${item('leads', 'Leads')}
          ${item('pipeline', 'Pipeline')}
          ${item('site', 'Formulário do site')}
          ${isAdmin() ? `<div class="nav-sep">Administração</div>${item('usuarios', 'Usuários')}${item('integracoes', 'Integrações')}` : ''}
        </nav>
        <div class="sidebar-foot">
          <div><div class="user-chip">${esc(state.user.nome)}</div><div class="muted small">${esc(state.user.email)} · ${state.user.papel === 'admin' ? 'Administrador' : 'Vendedor'}</div></div>
          <button class="btn ghost sm" id="btn-senha" type="button">Trocar senha</button>
          <button class="btn ghost sm" id="btn-tema" type="button">${rotuloTema()}</button>
          <button class="btn ghost sm" id="btn-sair" type="button">Sair</button>
        </div>
      </aside>
      <div>
        <div class="topbar"><button class="btn sm" id="btn-menu" type="button" aria-label="Abrir menu">☰ Menu</button><strong>Smart Mold CRM</strong><span></span></div>
        <main class="main" id="main"></main>
      </div>
    </div>`;
  $('#btn-sair').addEventListener('click', sair);
  $('#btn-senha').addEventListener('click', modalTrocarSenha);
  $('#btn-tema').addEventListener('click', alternarTema);
  $('#btn-menu').addEventListener('click', () => $('#shell').classList.toggle('menu-open'));
  $('.nav').addEventListener('click', () => $('#shell').classList.remove('menu-open'));
}

async function navegar() {
  if (!state.user) return;
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  let chave = partes[0] || 'painel';
  if (!ROTAS[chave] || (ROTAS[chave].admin && !isAdmin())) chave = 'painel';
  renderShell(chave);
  document.title = `${ROTAS[chave].titulo} · CRM Smart Mold`;
  state.refresh = null;
  try {
    await ROTAS[chave].render($('#main'), partes.slice(1));
  } catch (err) {
    erroToast(err);
  }
}

async function carregarBase() {
  const [meta, stats] = await Promise.all([api('/api/meta'), api('/api/stats')]);
  state.meta = meta;
  aplicarStats(stats);
}

function aplicarStats(stats) {
  state.usuarios = stats.usuarios;
  state.origens = stats.origens.map((o) => o.origem);
  state.cidades = stats.cidades.map((c) => c.cidade);
}

async function iniciarApp() {
  try {
    await carregarBase();
  } catch (err) {
    erroToast(err);
    return;
  }
  navegar();
}

window.addEventListener('hashchange', navegar);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = $$('.modal').pop();
    if (modal) modal.remove();
    else fecharDrawer();
  }
});

// ---------- Painel ----------

async function viewPainel(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Painel</h1><p>Visão geral do funil comercial.</p></div>
    <div class="actions"><a class="btn" href="#/leads">Ver leads</a><button class="btn primary" type="button" id="btn-novo">+ Novo lead</button></div></div>
    <div id="painel-corpo"><p class="muted">Carregando…</p></div>`;
  $('#btn-novo').addEventListener('click', modalNovoLead);
  const carregar = async () => {
    const [stats, recentes] = await Promise.all([api('/api/stats'), api('/api/leads?limite=8')]);
    aplicarStats(stats);
    const porEtapa = Object.fromEntries(stats.porEtapa.map((r) => [r.etapa, r]));
    const abertos = stats.porEtapa.filter((r) => !stats.fechadas.includes(r.etapa)).reduce((s, r) => s + r.n, 0);
    const cat = Object.fromEntries(stats.porCategoria.map((r) => [r.categoria, r.n]));
    const maxEtapa = Math.max(1, ...stats.etapas.map((e) => porEtapa[e.id]?.n || 0));
    $('#painel-corpo').innerHTML = `
      <div class="grid grid-4">
        <div class="card kpi"><div class="label">Leads em aberto</div><div class="value">${fmtNum(abertos)}</div><div class="hint">fora de Ganho/Perdido</div></div>
        <div class="card kpi"><div class="label">Novos (7 dias)</div><div class="value">${fmtNum(stats.ultimos7dias)}</div><div class="hint">${fmtNum(stats.ultimos30dias)} nos últimos 30 dias</div></div>
        <div class="card kpi"><div class="label">Leads A em aberto</div><div class="value">${fmtNum(cat.A || 0)}</div><div class="hint">maior prioridade</div></div>
        <div class="card kpi"><div class="label">Ganhos (30 dias)</div><div class="value">${fmtNum(stats.ganhos30dias.n)}</div><div class="hint">${fmtMoeda(stats.ganhos30dias.valor)} estimados</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card"><h2>Funil comercial</h2><p class="muted small" style="margin:2px 0 0">Leads por etapa do pipeline</p>
          <div class="funnel">${stats.etapas
            .map((e) => {
              const n = porEtapa[e.id]?.n || 0;
              return `<a class="funnel-row" href="#/leads" data-etapa="${e.id}" title="${esc(e.nome)}: ${n} lead(s)" style="text-decoration:none">
                <span>${esc(e.nome)}</span><span class="track">${n ? `<span class="fill" style="display:block;width:${(n / maxEtapa) * 100}%"></span>` : ""}</span><span class="n">${fmtNum(n)}</span></a>`;
            })
            .join('')}</div>
        </div>
        <div class="card"><h2>Entrada de leads — últimos 30 dias</h2><p class="muted small" style="margin:2px 0 0">Por categoria de qualificação</p>
          <div class="chart" id="chart-dias"></div>
          <div class="legend">${['A', 'B', 'C'].map((c) => `<span><span class="dot ${c}" style="width:10px;height:10px;border-radius:3px;display:inline-block"></span>Lead ${c} · ${fmtNum(cat[c] || 0)} em aberto</span>`).join('')}</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><div class="page-head" style="margin-bottom:8px"><h2>Últimos leads</h2><a class="btn sm" href="#/leads">Ver todos</a></div>
        ${tabelaLeads(recentes.leads, { compacta: true })}
      </div>`;
    graficoDias($('#chart-dias'), stats.porDia);
    $$('.funnel-row').forEach((a) =>
      a.addEventListener('click', () => {
        limparFiltros();
        state.filtros.etapa = a.dataset.etapa;
      }),
    );
    ligarTabela($('#painel-corpo'));
  };
  state.refresh = carregar;
  await carregar();
}

function caminhoTopoArredondado(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function graficoDias(el, porDia) {
  const dias = [];
  const hoje = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 86400000);
    dias.push(d.toLocaleDateString('en-CA', { timeZone: TZ }));
  }
  const dados = Object.fromEntries(dias.map((d) => [d, { A: 0, B: 0, C: 0 }]));
  for (const r of porDia) if (dados[r.dia]) dados[r.dia][r.categoria] = r.n;
  const totais = dias.map((d) => dados[d].A + dados[d].B + dados[d].C);
  const max = Math.max(4, ...totais);
  const passo = Math.ceil(max / 4);
  const topo = passo * 4;
  const W = 600, H = 200, ML = 28, MB = 22, MT = 6;
  const ph = H - MB - MT;
  const bw = (W - ML) / dias.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Leads recebidos por dia nos últimos 30 dias">`;
  for (let i = 0; i <= 4; i++) {
    const y = MT + ph - (ph * i) / 4;
    svg += `<line class="grid-line" x1="${ML}" x2="${W}" y1="${y}" y2="${y}"/><text class="axis" x="${ML - 6}" y="${y + 3}" text-anchor="end">${passo * i}</text>`;
  }
  dias.forEach((d, i) => {
    const x = ML + i * bw + 2;
    const w = Math.max(2, bw - 4);
    let base = MT + ph;
    const segs = ['C', 'B', 'A'].filter((c) => dados[d][c] > 0);
    segs.forEach((c, j) => {
      const h = (dados[d][c] / topo) * ph;
      const gap = j < segs.length - 1 ? 2 : 0;
      const y = base - h;
      const hh = Math.max(1, h - gap);
      svg +=
        j === segs.length - 1
          ? `<path d="${caminhoTopoArredondado(x, y, w, hh, 4)}" fill="var(--cat-${c.toLowerCase()})"/>`
          : `<rect x="${x}" y="${y + gap}" width="${w}" height="${hh}" fill="var(--cat-${c.toLowerCase()})"/>`;
      base = y;
    });
    if (i % 5 === 4 || i === 0) {
      const [, m, dd] = d.split('-');
      svg += `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${dd}/${m}</text>`;
    }
    svg += `<rect x="${ML + i * bw}" y="${MT}" width="${bw}" height="${ph}" fill="transparent" data-i="${i}"/>`;
  });
  svg += '</svg>';
  el.innerHTML = svg + '<div class="tooltip hidden"></div>';
  const tip = $('.tooltip', el);
  $$('rect[data-i]', el).forEach((r) => {
    const mostrar = (ev) => {
      const i = Number(r.dataset.i);
      const d = dias[i];
      const [a, m, dd] = d.split('-');
      tip.innerHTML = `<b>${dd}/${m}/${a}</b>${['A', 'B', 'C']
        .map((c) => `<div><span><span class="dot ${c}" style="display:inline-block;width:8px;height:8px;border-radius:50%"></span> Lead ${c}</span><span>${dados[d][c]}</span></div>`)
        .join('')}<div><span>Total</span><strong>${totais[i]}</strong></div>`;
      tip.classList.remove('hidden');
      const box = el.getBoundingClientRect();
      const px = (ev.clientX ?? box.left + ((ML + i * bw) / W) * box.width) - box.left;
      tip.style.left = `${Math.min(Math.max(px - 60, 0), box.width - 140)}px`;
      tip.style.top = `-10px`;
    };
    r.addEventListener('mousemove', mostrar);
    r.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  });
}

// ---------- Filtros ----------

function limparFiltros() {
  state.filtros = { q: '', categoria: [], etapa: '', cidade: '', origem: '', responsavel: '', de: '', ate: '', ordem: state.filtros.ordem, pagina: 1 };
}

function queryFiltros(extra = {}) {
  const f = state.filtros;
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.categoria.length) p.set('categoria', f.categoria.join(','));
  if (f.etapa) p.set('etapa', f.etapa);
  if (f.cidade) p.set('cidade', f.cidade);
  if (f.origem) p.set('origem', f.origem);
  if (f.responsavel) p.set('responsavel', f.responsavel);
  if (f.de) p.set('de', f.de);
  if (f.ate) p.set('ate', f.ate);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

function barraFiltros({ semEtapa = false } = {}) {
  const f = state.filtros;
  return `
    <div class="filters" id="filtros">
      <input class="input search" type="search" name="q" placeholder="Buscar por nome, cidade ou telefone" value="${esc(f.q)}" aria-label="Buscar" />
      <div class="chips" role="group" aria-label="Categoria">${['A', 'B', 'C']
        .map((c) => `<button type="button" data-cat="${c}" aria-pressed="${f.categoria.includes(c)}"><span class="dot ${c}" style="width:8px;height:8px;border-radius:50%;display:inline-block"></span>${c}</button>`)
        .join('')}</div>
      ${semEtapa ? '' : `<select class="input" name="etapa" aria-label="Etapa"><option value="">Todas as etapas</option>${opcoesEtapa(f.etapa)}</select>`}
      <select class="input" name="cidade" aria-label="Cidade"><option value="">Todas as cidades</option>${state.cidades
        .map((c) => `<option ${c === f.cidade ? 'selected' : ''}>${esc(c)}</option>`)
        .join('')}</select>
      <select class="input" name="origem" aria-label="Origem"><option value="">Todas as origens</option>${state.origens
        .map((o) => `<option ${o === f.origem ? 'selected' : ''}>${esc(o)}</option>`)
        .join('')}</select>
      <select class="input" name="responsavel" aria-label="Responsável"><option value="">Todos os responsáveis</option><option value="nenhum" ${
        f.responsavel === 'nenhum' ? 'selected' : ''
      }>Sem responsável</option>${state.usuarios.map((u) => `<option value="${u.id}" ${String(u.id) === f.responsavel ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select>
      <span class="period"><input class="input" type="date" name="de" value="${esc(f.de)}" aria-label="Data inicial" /><span class="muted">até</span><input class="input" type="date" name="ate" value="${esc(f.ate)}" aria-label="Data final" /></span>
      <button class="btn ghost sm" type="button" id="btn-limpar">Limpar filtros</button>
    </div>`;
}

function ligarFiltros(root, aoMudar) {
  let timer;
  $('input[name=q]', root).addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filtros.q = e.target.value.trim();
      state.filtros.pagina = 1;
      aoMudar();
    }, 300);
  });
  $$('select, input[type=date]', root).forEach((el) =>
    el.addEventListener('change', () => {
      state.filtros[el.name] = el.value;
      state.filtros.pagina = 1;
      aoMudar();
    }),
  );
  $$('[data-cat]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const c = b.dataset.cat;
      const lista = state.filtros.categoria;
      state.filtros.categoria = lista.includes(c) ? lista.filter((x) => x !== c) : [...lista, c];
      b.setAttribute('aria-pressed', state.filtros.categoria.includes(c));
      state.filtros.pagina = 1;
      aoMudar();
    }),
  );
  $('#btn-limpar', root).addEventListener('click', () => {
    limparFiltros();
    navegar();
  });
}

// ---------- Leads ----------

function tabelaLeads(leads, { compacta = false } = {}) {
  if (!leads.length) return `<div class="empty">Nenhum lead encontrado.</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Lead</th><th>Cidade</th><th>Categoria</th><th>Etapa</th>${compacta ? '' : '<th class="hide-sm">Origem</th><th class="hide-sm">Responsável</th>'}<th class="hide-sm">Entrada</th></tr></thead>
    <tbody>${leads
      .map(
        (l) => `<tr data-lead="${l.id}">
        <td><strong>${esc(l.nome)}</strong><div class="sub">${esc(l.telefone || '')}</div></td>
        <td>${esc(l.cidade || '—')}${l.uf ? `<span class="muted">/${esc(l.uf)}</span>` : ''}</td>
        <td>${badgeCat(l.categoria, l.score)}</td>
        <td><select class="input" data-etapa-lead="${l.id}" aria-label="Etapa de ${esc(l.nome)}">${opcoesEtapa(l.etapa)}</select></td>
        ${compacta ? '' : `<td class="hide-sm"><span class="tag">${esc(l.origem)}</span></td><td class="hide-sm">${esc(l.responsavel_nome || '—')}</td>`}
        <td class="hide-sm nowrap">${fmtDataHora(l.created_at)}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
}

function ligarTabela(root) {
  $$('tr[data-lead]', root).forEach((tr) =>
    tr.addEventListener('click', (e) => {
      if (e.target.closest('select')) return;
      abrirLead(Number(tr.dataset.lead));
    }),
  );
  $$('select[data-etapa-lead]', root).forEach((sel) =>
    sel.addEventListener('change', async () => {
      try {
        await mudarEtapa(Number(sel.dataset.etapaLead), sel.value);
      } catch (err) {
        erroToast(err);
      }
    }),
  );
}

async function mudarEtapa(id, etapa) {
  const body = { etapa };
  if (etapa === 'perdido') {
    const motivo = await pedirTexto('Motivo da perda', 'Ex.: preço, prazo, comprou de concorrente, sem retorno…');
    if (motivo === null) {
      state.refresh?.();
      return;
    }
    if (motivo) body.motivo_perda = motivo;
  }
  await api(`/api/leads/${id}`, { method: 'PATCH', body });
  toast(`Lead movido para "${nomeEtapa(etapa)}".`);
  state.refresh?.();
}

function pedirTexto(titulo, placeholder) {
  return new Promise((resolve) => {
    const m = abrirModal(`<form id="f-texto" style="display:flex;flex-direction:column;gap:12px"><h2>${esc(titulo)}</h2>
      <textarea class="input" name="t" placeholder="${esc(placeholder)}"></textarea>
      <div class="actions"><button class="btn primary" type="submit">Confirmar</button><button class="btn ghost" type="button" id="cancelar-texto">Cancelar</button></div></form>`);
    let resolvido = false;
    const fim = (v) => {
      if (resolvido) return;
      resolvido = true;
      m.remove();
      resolve(v);
    };
    $('#f-texto', m).addEventListener('submit', (e) => {
      e.preventDefault();
      fim(new FormData(e.target).get('t').trim());
    });
    $('#cancelar-texto', m).addEventListener('click', () => fim(null));
    new MutationObserver((_, obs) => {
      if (!document.body.contains(m)) {
        obs.disconnect();
        fim(null);
      }
    }).observe(document.body, { childList: true });
  });
}

async function viewLeads(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Leads</h1><p id="leads-total">&nbsp;</p></div>
    <div class="actions">
      <select class="input" id="ordem" aria-label="Ordenar" style="width:auto">
        <option value="recentes">Mais recentes</option><option value="score">Maior score</option><option value="atualizados">Atualizados recentemente</option><option value="antigos">Mais antigos</option><option value="nome">Nome (A–Z)</option>
      </select>
      <button class="btn" type="button" id="btn-csv">Exportar CSV</button>
      <button class="btn primary" type="button" id="btn-novo">+ Novo lead</button></div></div>
    ${barraFiltros()}
    <div id="lista"><p class="muted">Carregando…</p></div>`;
  $('#ordem').value = state.filtros.ordem;
  $('#ordem').addEventListener('change', (e) => {
    state.filtros.ordem = e.target.value;
    carregar();
  });
  $('#btn-novo').addEventListener('click', modalNovoLead);
  $('#btn-csv').addEventListener('click', () => {
    window.location.href = `/api/leads/export.csv?${queryFiltros()}`;
  });
  const carregar = async () => {
    const f = state.filtros;
    const data = await api(`/api/leads?${queryFiltros({ pagina: f.pagina, limite: 50, ordem: f.ordem })}`);
    const paginas = Math.max(1, Math.ceil(data.total / data.limite));
    $('#leads-total').textContent = `${fmtNum(data.total)} lead(s) encontrados`;
    $('#lista').innerHTML =
      tabelaLeads(data.leads) +
      (data.total > data.limite
        ? `<div class="pager"><span>Página ${data.pagina} de ${paginas}</span><span class="actions">
            <button class="btn sm" id="pg-ant" ${data.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
            <button class="btn sm" id="pg-prox" ${data.pagina >= paginas ? 'disabled' : ''}>Próxima</button></span></div>`
        : '');
    ligarTabela($('#lista'));
    $('#pg-ant')?.addEventListener('click', () => {
      state.filtros.pagina--;
      carregar();
    });
    $('#pg-prox')?.addEventListener('click', () => {
      state.filtros.pagina++;
      carregar();
    });
  };
  ligarFiltros($('#filtros'), () => carregar().catch(erroToast));
  state.refresh = () => carregar().catch(erroToast);
  await carregar();
}

// ---------- Pipeline ----------

async function viewPipeline(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Pipeline</h1><p>Arraste os cards entre as etapas para atualizar o andamento.</p></div>
    <div class="actions"><button class="btn primary" type="button" id="btn-novo">+ Novo lead</button></div></div>
    ${barraFiltros({ semEtapa: true })}
    <div id="board"><p class="muted">Carregando…</p></div>`;
  $('#btn-novo').addEventListener('click', modalNovoLead);
  const carregar = async () => {
    const etapaAntes = state.filtros.etapa;
    state.filtros.etapa = '';
    const data = await api(`/api/leads?${queryFiltros({ limite: 500, ordem: 'score' })}`);
    state.filtros.etapa = etapaAntes;
    const grupos = Object.fromEntries(etapas().map((e) => [e.id, []]));
    for (const l of data.leads) (grupos[l.etapa] ||= []).push(l);
    $('#board').innerHTML = `${data.total > data.leads.length ? `<div class="alert warn" style="margin-bottom:10px">Mostrando ${data.leads.length} de ${data.total} leads. Use os filtros para refinar.</div>` : ''}
      <div class="board">${etapas()
        .map(
          (e) => `<section class="column" data-col="${e.id}" aria-label="${esc(e.nome)}">
          <div class="column-head"><span>${esc(e.nome)}</span><span class="count">${grupos[e.id].length}${
            grupos[e.id].some((l) => l.valor_estimado) ? ` · ${fmtMoeda(grupos[e.id].reduce((s, l) => s + (l.valor_estimado || 0), 0))}` : ''
          }</span></div>
          <div class="column-body">${grupos[e.id]
            .map(
              (l) => `<article class="lead-card" draggable="true" data-card="${l.id}" tabindex="0">
              <div class="top"><span class="name">${esc(l.nome)}</span>${badgeCat(l.categoria)}</div>
              <div class="meta">${esc(l.cidade || '—')}</div>
              ${l.valor_estimado ? `<div class="meta">${fmtMoeda(l.valor_estimado)}</div>` : ''}
              <div class="meta">${esc(l.responsavel_nome ? `👤 ${l.responsavel_nome}` : 'Sem responsável')} · ${fmtData(l.created_at)}</div>
            </article>`,
            )
            .join('')}</div></section>`,
        )
        .join('')}</div>`;
    ligarBoard();
  };
  ligarFiltros($('#filtros'), () => carregar().catch(erroToast));
  state.refresh = () => carregar().catch(erroToast);
  await carregar();
}

function ligarBoard() {
  let arrastando = null;
  $$('.lead-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      arrastando = card;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.card);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      $$('.column').forEach((c) => c.classList.remove('drop'));
    });
    card.addEventListener('click', () => abrirLead(Number(card.dataset.card)));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') abrirLead(Number(card.dataset.card));
    });
  });
  $$('.column').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drop');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('drop');
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (!id || !arrastando || arrastando.closest('.column') === col) return;
      $('.column-body', col).prepend(arrastando);
      try {
        await mudarEtapa(id, col.dataset.col);
      } catch (err) {
        erroToast(err);
        state.refresh?.();
      }
    });
  });
}

// ---------- Novo lead ----------

const SUGESTOES = {};

function datalists() {
  return Object.entries(SUGESTOES)
    .map(([k, vs]) => `<datalist id="dl-${k}">${vs.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`)
    .join('');
}

function camposLeadHtml(l = {}) {
  const campo = (nome, rot, attrs = '') =>
    `<label class="field">${rot}<input class="input" name="${nome}" value="${esc(l[nome] ?? '')}" ${SUGESTOES[nome] ? `list="dl-${nome}"` : ''} ${attrs}/></label>`;
  return `<div class="form-grid">
    ${campo('nome', 'Nome *', 'required')}
    ${campo('telefone', 'Telefone / WhatsApp *', 'type="tel" required')}
    <label class="field full">Cidade *<input class="input" name="cidade" value="${esc([l.cidade, l.uf].filter(Boolean).join(' - '))}" placeholder="Ex.: Paracatu - MG" required /></label>
  </div>`;
}

function modalNovoLead() {
  const m = abrirModal(`<form id="f-novo" style="display:flex;flex-direction:column;gap:14px"><h2>Novo lead</h2>
    <p class="muted small" style="margin:0">O lead será classificado automaticamente (A, B ou C) pela cidade.</p>
    ${camposLeadHtml()}
    <input type="hidden" name="origem" value="manual" />
    <div class="alert error hidden" id="novo-erro"></div>
    <div class="actions"><button class="btn primary" type="submit">Salvar lead</button><button class="btn ghost" type="button" data-fechar>Cancelar</button></div></form>`);
  $('#f-novo', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const { lead } = await api('/api/leads', { method: 'POST', body });
      m.remove();
      toast(`Lead criado — Lead ${lead.categoria}.`);
      state.refresh?.();
      abrirLead(lead.id);
    } catch (err) {
      const box = $('#novo-erro', m);
      box.textContent = err.message;
      box.classList.remove('hidden');
    }
  });
}

// ---------- Detalhe do lead ----------

function fecharDrawer() {
  $('#drawer-root')?.remove();
}

async function abrirLead(id) {
  fecharDrawer();
  const root = document.createElement('div');
  root.id = 'drawer-root';
  root.innerHTML = `<div class="overlay"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Detalhes do lead"><div class="drawer-body"><p class="muted">Carregando…</p></div></aside>`;
  document.body.appendChild(root);
  $('.overlay', root).addEventListener('click', fecharDrawer);
  try {
    const data = await api(`/api/leads/${id}`);
    renderLead(root, data);
  } catch (err) {
    fecharDrawer();
    erroToast(err);
  }
}

const ROTULOS_RESPOSTA = { _origem: 'Origem' };

function renderLead(root, { lead: l, eventos }) {
  const respostas = JSON.parse(l.respostas || '{}');
  const whats = linkWhats(l.telefone);
  const porQuem = { regras: 'regras automáticas', ia: 'IA (Claude)', manual: 'definição manual' }[l.classificado_por] || l.classificado_por;
  $('.drawer', root).innerHTML = `
    <div class="drawer-head">
      <div class="row"><div><h1 style="font-size:20px">${esc(l.nome)}</h1>
        <div class="muted small">Lead #${l.id} · entrou em ${fmtDataHora(l.created_at)} via <span class="tag">${esc(l.origem)}</span></div></div>
        <button class="btn ghost sm" type="button" id="fechar" aria-label="Fechar">✕</button></div>
      <div class="actions">
        ${whats ? `<a class="btn sm" href="${whats}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${l.telefone ? `<a class="btn sm" href="tel:${esc(l.telefone)}">Ligar</a>` : ''}
        ${l.email ? `<a class="btn sm" href="mailto:${esc(l.email)}">E-mail</a>` : ''}
        <label class="field" style="flex-direction:row;align-items:center;gap:6px;margin-left:auto">Etapa <select class="input" id="d-etapa" style="width:auto">${opcoesEtapa(l.etapa)}</select></label>
      </div>
    </div>
    <div class="drawer-body">
      <section class="section">
        <h3>Qualificação</h3>
        <div class="qualif"><div class="big ${esc(l.categoria)}" aria-label="Lead ${esc(l.categoria)}">${esc(l.categoria)}</div>
          <div style="flex:1"><strong>Lead ${esc(l.categoria)} · ${esc(l.score)} pts</strong><div class="small muted">Classificado por ${esc(porQuem)}</div>
          <div class="small" style="margin-top:4px">${esc(l.classificacao_motivo || '')}</div></div></div>
        <div class="actions">
          <label class="field" style="flex-direction:row;align-items:center;gap:6px">Alterar categoria <select class="input" id="d-cat" style="width:auto">${['A', 'B', 'C']
            .map((c) => `<option ${c === l.categoria ? 'selected' : ''}>${c}</option>`)
            .join('')}</select></label>
          <button class="btn sm" type="button" id="d-reclass">Reclassificar automaticamente</button>
        </div>
      </section>

      <section class="section">
        <h3>Comercial</h3>
        <div class="form-grid">
          <label class="field">Responsável<select class="input" id="d-resp"><option value="">Sem responsável</option>${state.usuarios
            .map((u) => `<option value="${u.id}" ${u.id === l.responsavel_id ? 'selected' : ''}>${esc(u.nome)}</option>`)
            .join('')}</select></label>
          <label class="field">Valor estimado (R$)<input class="input" id="d-valor" inputmode="decimal" value="${l.valor_estimado ?? ''}" placeholder="0,00" /></label>
          ${l.etapa === 'perdido' ? `<label class="field full">Motivo da perda<input class="input" id="d-motivo" value="${esc(l.motivo_perda || '')}" /></label>` : ''}
        </div>
      </section>

      <section class="section">
        <div class="page-head" style="margin:0"><h3>Dados do lead</h3><button class="btn sm" type="button" id="d-editar">Editar</button></div>
        <div id="d-dados">
          <dl class="kv">
            ${[
              ['Telefone', l.telefone],
              ['Cidade', [l.cidade, l.uf].filter(Boolean).join(' - ')],
            ]
              .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`)
              .join('')}
          </dl>
        </div>
      </section>

      ${
        Object.keys(respostas).length
          ? `<section class="section"><h3>Respostas recebidas</h3><details><summary class="small">Ver todas as ${Object.keys(respostas).length} respostas originais</summary>
          <dl class="kv" style="margin-top:8px">${Object.entries(respostas)
            .map(([k, v]) => `<dt>${esc(ROTULOS_RESPOSTA[k] || k)}</dt><dd>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</dd>`)
            .join('')}</dl></details></section>`
          : ''
      }

      <section class="section">
        <h3>Histórico e anotações</h3>
        <form id="d-nota" class="copy-row"><input class="input" name="texto" placeholder="Registrar ligação, combinado, próxima ação…" required /><button class="btn primary" type="submit">Anotar</button></form>
        <div class="timeline">${eventos
          .map(
            (e) => `<div class="item ${e.tipo === 'nota' ? 'nota' : ''}"><div class="when">${fmtDataHora(e.created_at)}${e.usuario ? ` · ${esc(e.usuario)}` : ''}${
              e.tipo === 'nota' ? ' · anotação' : ''
            }</div><div class="desc">${esc(e.descricao)}</div></div>`,
          )
          .join('')}</div>
      </section>

      ${isAdmin() ? `<section class="section"><button class="btn danger sm" type="button" id="d-excluir" style="align-self:flex-start">Excluir lead</button></section>` : ''}
    </div>`;

  const atualizar = async (body, msg) => {
    try {
      const data = await api(`/api/leads/${l.id}`, { method: 'PATCH', body });
      renderLead(root, data);
      if (msg) toast(msg);
      state.refresh?.();
    } catch (err) {
      erroToast(err);
    }
  };
  $('#fechar', root).addEventListener('click', fecharDrawer);
  $('#d-etapa', root).addEventListener('change', async (e) => {
    const body = { etapa: e.target.value };
    if (e.target.value === 'perdido') {
      const motivo = await pedirTexto('Motivo da perda', 'Ex.: preço, prazo, comprou de concorrente, sem retorno…');
      if (motivo === null) return renderLead(root, { lead: l, eventos });
      if (motivo) body.motivo_perda = motivo;
    }
    atualizar(body, `Etapa: ${nomeEtapa(e.target.value)}`);
  });
  $('#d-cat', root).addEventListener('change', (e) => atualizar({ categoria: e.target.value }, 'Categoria atualizada.'));
  $('#d-resp', root).addEventListener('change', (e) => atualizar({ responsavel_id: e.target.value || null }, 'Responsável atualizado.'));
  $('#d-valor', root).addEventListener('change', (e) => atualizar({ valor_estimado: e.target.value }, 'Valor atualizado.'));
  $('#d-motivo', root)?.addEventListener('change', (e) => atualizar({ motivo_perda: e.target.value }, 'Motivo registrado.'));
  $('#d-reclass', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Classificando…';
    try {
      renderLead(root, await api(`/api/leads/${l.id}/reclassificar`, { method: 'POST' }));
      toast('Lead reclassificado.');
      state.refresh?.();
    } catch (err) {
      erroToast(err);
      e.target.disabled = false;
    }
  });
  $('#d-nota', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = new FormData(e.target).get('texto');
    try {
      renderLead(root, await api(`/api/leads/${l.id}/notas`, { method: 'POST', body: { texto } }));
    } catch (err) {
      erroToast(err);
    }
  });
  $('#d-editar', root).addEventListener('click', () => {
    $('#d-dados', root).innerHTML = `<form id="f-edit" style="display:flex;flex-direction:column;gap:12px">${camposLeadHtml(l)}
      <div class="actions"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" id="cancelar-edit">Cancelar</button></div></form>`;
    $('#cancelar-edit', root).addEventListener('click', () => renderLead(root, { lead: l, eventos }));
    $('#f-edit', root).addEventListener('submit', (e) => {
      e.preventDefault();
      atualizar(Object.fromEntries(new FormData(e.target)), 'Dados salvos.');
    });
  });
  $('#d-excluir', root)?.addEventListener('click', async () => {
    if (!confirm(`Excluir definitivamente o lead "${l.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/api/leads/${l.id}`, { method: 'DELETE' });
      fecharDrawer();
      toast('Lead excluído.');
      state.refresh?.();
    } catch (err) {
      erroToast(err);
    }
  });
}

// ---------- Usuários ----------

async function viewUsuarios(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Usuários</h1><p>Convide a equipe e defina o nível de acesso.</p></div>
    <div class="actions"><button class="btn primary" type="button" id="btn-convidar">+ Convidar usuário</button></div></div>
    <div class="card" style="margin-bottom:16px"><strong>Papéis de acesso</strong>
      <div class="small muted" style="margin-top:4px"><b>Administrador</b>: tudo, inclusive usuários, integrações e exclusão de leads. <b>Vendedor</b>: vê e trabalha os leads (etapas, notas, exportação), sem acesso às áreas administrativas.</div></div>
    <div id="lista-usuarios"><p class="muted">Carregando…</p></div>`;
  const mostrarSenha = (titulo, email, senha) =>
    abrirModal(`<h2>${esc(titulo)}</h2>
      <p style="margin:0">Envie estes dados para a pessoa por um canal seguro. A senha provisória <b>só aparece agora</b> e precisa ser trocada no primeiro acesso.</p>
      <dl class="kv"><dt>Endereço</dt><dd class="mono">${esc(location.origin)}</dd><dt>E-mail</dt><dd class="mono">${esc(email)}</dd><dt>Senha provisória</dt><dd class="mono"><strong>${esc(senha)}</strong></dd></dl>
      <div class="actions"><button class="btn primary" type="button" id="copiar-convite">Copiar convite</button><button class="btn ghost" type="button" data-fechar>Fechar</button></div>`).querySelector('#copiar-convite').addEventListener('click', () =>
      copiar(`Acesso ao CRM Smart Mold\nEndereço: ${location.origin}\nE-mail: ${email}\nSenha provisória: ${senha}\n(troque a senha no primeiro acesso)`),
    );
  const carregar = async () => {
    const { usuarios } = await api('/api/usuarios');
    $('#lista-usuarios').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Papel</th><th>Status</th><th class="hide-sm">Último acesso</th><th></th></tr></thead><tbody>
      ${usuarios
        .map((u) => {
          const bloqueado = u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date();
          const status = !u.ativo ? 'Desativado' : bloqueado ? 'Bloqueado (tentativas)' : u.trocar_senha ? 'Aguardando 1º acesso' : 'Ativo';
          const eu = u.id === state.user.id;
          return `<tr style="cursor:default"><td><strong>${esc(u.nome)}</strong>${eu ? ' <span class="tag">você</span>' : ''}<div class="sub">${esc(u.email)}</div></td>
            <td><select class="input" data-papel="${u.id}" ${eu ? 'disabled' : ''}><option value="vendedor">Vendedor</option><option value="admin" ${u.papel === 'admin' ? 'selected' : ''}>Administrador</option></select></td>
            <td>${esc(status)}</td><td class="hide-sm">${u.ultimo_login ? fmtDataHora(u.ultimo_login) : '—'}</td>
            <td class="nowrap">${
              eu
                ? ''
                : `${bloqueado ? `<button class="btn sm" data-desbloquear="${u.id}">Desbloquear</button> ` : ''}<button class="btn sm" data-reset="${u.id}" data-email="${esc(u.email)}">Redefinir senha</button>
                   <button class="btn sm" data-ativo="${u.id}" data-valor="${u.ativo ? 0 : 1}">${u.ativo ? 'Desativar' : 'Reativar'}</button>
                   <button class="btn sm danger" data-excluir="${u.id}" data-nome="${esc(u.nome)}">Remover</button>`
            }</td></tr>`;
        })
        .join('')}</tbody></table></div>`;
    const acao = async (fn) => {
      try {
        await fn();
        await carregar();
      } catch (err) {
        erroToast(err);
        carregar();
      }
    };
    $$('[data-papel]').forEach((s) => s.addEventListener('change', () => acao(() => api(`/api/usuarios/${s.dataset.papel}`, { method: 'PATCH', body: { papel: s.value } }))));
    $$('[data-desbloquear]').forEach((b) => b.addEventListener('click', () => acao(() => api(`/api/usuarios/${b.dataset.desbloquear}`, { method: 'PATCH', body: { desbloquear: true } }))));
    $$('[data-ativo]').forEach((b) => b.addEventListener('click', () => acao(() => api(`/api/usuarios/${b.dataset.ativo}`, { method: 'PATCH', body: { ativo: b.dataset.valor === '1' } }))));
    $$('[data-reset]').forEach((b) =>
      b.addEventListener('click', () =>
        acao(async () => {
          if (!confirm('Gerar uma nova senha provisória? As sessões abertas desse usuário serão encerradas.')) return;
          const r = await api(`/api/usuarios/${b.dataset.reset}`, { method: 'PATCH', body: { redefinir_senha: true } });
          mostrarSenha('Senha redefinida', b.dataset.email, r.senha_provisoria);
        }),
      ),
    );
    $$('[data-excluir]').forEach((b) =>
      b.addEventListener('click', () =>
        acao(async () => {
          if (!confirm(`Remover o acesso de ${b.dataset.nome}? Os leads dele ficarão sem responsável.`)) return;
          await api(`/api/usuarios/${b.dataset.excluir}`, { method: 'DELETE' });
          toast('Usuário removido.');
        }),
      ),
    );
  };
  $('#btn-convidar').addEventListener('click', () => {
    const m = abrirModal(`<form id="f-user" style="display:flex;flex-direction:column;gap:12px"><h2>Convidar usuário</h2>
      <label class="field">Nome<input class="input" name="nome" required /></label>
      <label class="field">E-mail<input class="input" type="email" name="email" required /></label>
      <label class="field">Papel<select class="input" name="papel"><option value="vendedor">Vendedor</option><option value="admin">Administrador</option></select></label>
      <div class="alert error hidden" id="user-erro"></div>
      <div class="actions"><button class="btn primary" type="submit">Criar acesso</button><button class="btn ghost" type="button" data-fechar>Cancelar</button></div></form>`);
    $('#f-user', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await api('/api/usuarios', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        m.remove();
        mostrarSenha('Usuário criado', r.email, r.senha_provisoria);
        carregar();
        api('/api/stats').then(aplicarStats).catch(() => {});
      } catch (err) {
        const box = $('#user-erro', m);
        box.textContent = err.message;
        box.classList.remove('hidden');
      }
    });
  });
  await carregar();
}

// ---------- Integrações (webhooks) ----------

// Campos usados pelo CRM (o formulário pede só nome, telefone e cidade)
const CAMPOS_VISIVEIS = ['nome', 'telefone', 'cidade'];

const ROTULOS_CAMPO = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  cidade: 'Cidade',
  uf: 'UF',
  perfil: 'Perfil do cliente',
  produto: 'Produto',
  tipo_obra: 'Tipo de obra',
  volume: 'Quantidade de blocos',
  prazo: 'Prazo',
  mensagem: 'Mensagem',
  valor_estimado: 'Valor estimado',
  utm_source: 'UTM source',
  utm_medium: 'UTM medium',
  utm_campaign: 'UTM campaign',
};

async function viewIntegracoes(main, params) {
  if (params[0]) return viewIntegracao(main, Number(params[0]));
  main.innerHTML = `<div class="page-head"><div><h1>Integrações</h1><p>Receba leads de outras plataformas por webhook (Hotmart, RD Station, Typeform, Elementor, Zapier…).</p></div>
    <div class="actions"><button class="btn primary" type="button" id="btn-nova">+ Nova integração</button></div></div>
    <div class="card" style="margin-bottom:16px"><strong>Como funciona</strong>
      <ol class="steps small" style="margin-top:6px"><li>Crie uma integração e copie a URL do webhook gerada.</li><li>Na plataforma emissora, cadastre essa URL e selecione os eventos a enviar.</li>
      <li>Envie um evento de teste.</li><li>Volte aqui, mapeie os campos recebidos para os campos do CRM e escolha a etapa de entrada.</li><li>Salve e teste novamente (botão "Reprocessar").</li></ol></div>
    <div id="meta-card"></div>
    <h2 style="margin:20px 0 10px">Outras plataformas (webhook genérico)</h2>
    <div id="lista-integ"><p class="muted">Carregando…</p></div>`;
  cartaoMeta($('#meta-card')).catch(erroToast);
  $('#btn-nova').addEventListener('click', () => {
    const m = abrirModal(`<form id="f-integ" style="display:flex;flex-direction:column;gap:12px"><h2>Nova integração</h2>
      <label class="field">Nome da plataforma<input class="input" name="nome" placeholder="Ex.: Hotmart" required /></label>
      <label class="field">Origem registrada nos leads<input class="input" name="origem" placeholder="Ex.: hotmart" /></label>
      <div class="actions"><button class="btn primary" type="submit">Gerar URL do webhook</button><button class="btn ghost" type="button" data-fechar>Cancelar</button></div></form>`);
    $('#f-integ', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { integracao } = await api('/api/integracoes', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        m.remove();
        location.hash = `#/integracoes/${integracao.id}`;
      } catch (err) {
        erroToast(err);
      }
    });
  });
  const { integracoes } = await api('/api/integracoes');
  $('#lista-integ').innerHTML = integracoes.length
    ? `<div class="table-wrap"><table><thead><tr><th>Integração</th><th>Status</th><th>Eventos</th><th class="hide-sm">Último evento</th></tr></thead><tbody>
      ${integracoes
        .map(
          (i) => `<tr data-integ="${i.id}"><td><strong>${esc(i.nome)}</strong><div class="sub">origem: ${esc(i.origem)}</div></td>
          <td>${i.ativo ? 'Ativa' : 'Pausada'}${Object.keys(i.mapeamento).length ? '' : ' · <span class="muted">sem mapeamento</span>'}</td>
          <td>${fmtNum(i.total_eventos)}</td><td class="hide-sm">${i.ultimo_evento ? fmtDataHora(i.ultimo_evento) : '—'}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<div class="card empty">Nenhuma integração ainda.</div>`;
  $$('tr[data-integ]').forEach((tr) => tr.addEventListener('click', () => (location.hash = `#/integracoes/${tr.dataset.integ}`)));
}

async function cartaoMeta(el) {
  const m = await api('/api/meta-ads');
  const item = (ok, nome, desc) =>
    `<li><span class="tag" style="background:${ok ? 'var(--ok-bg)' : 'var(--warn-bg)'};color:${ok ? 'var(--ok)' : 'var(--warn)'}">${ok ? '✓ configurado' : 'pendente'}</span> <span class="mono">${nome}</span> <span class="muted">— ${desc}</span></li>`;
  el.innerHTML = `<div class="card">
    <div class="page-head" style="margin-bottom:6px"><div><h2>Meta Ads (Facebook e Instagram)</h2>
      <p class="small">Leads dos formulários instantâneos entram sozinhos no CRM, e o resultado de cada lead volta para o Pixel.</p></div></div>
    <div class="grid grid-2">
      <div><strong>Receber leads (Lead Ads)</strong>
        <ul class="small" style="padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px;margin:8px 0">
          ${item(m.leads.app_secret, 'META_APP_SECRET', 'chave secreta do app')}
          ${item(m.leads.verify_token, 'META_VERIFY_TOKEN', 'texto de verificação escolhido por você')}
          ${item(m.leads.page_token, 'META_PAGE_TOKEN', 'token permanente da página')}
        </ul>
        <label class="field">URL do webhook (cadastre no app da Meta, objeto "Page", campo "leadgen")
          <div class="copy-row"><input class="input" readonly value="${esc(m.webhook_url)}" /><button class="btn" type="button" id="m-copiar">Copiar</button></div></label>
      </div>
      <div><strong>Devolver resultados ao Pixel (API de Conversões)</strong>
        <ul class="small" style="padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px;margin:8px 0">
          ${item(m.capi.pixel_id, 'META_PIXEL_ID', 'ID do pixel / conjunto de dados')}
          ${item(m.capi.capi_token, 'META_CAPI_TOKEN', 'token da API de Conversões')}
        </ul>
        <p class="small muted" style="margin:0">Eventos enviados: <b>Lead A/B/C</b> após a classificação, o <b>nome da etapa</b> a cada avanço no funil e <b>Purchase</b> (com o valor estimado) quando o lead vira Ganho.</p>
      </div>
    </div>
    <form id="m-teste" class="actions" style="margin-top:14px">
      <input class="input" name="codigo_teste" placeholder="Código de teste (Gerenciador de Eventos → Eventos de teste)" style="max-width:360px" />
      <button class="btn" type="submit">Testar conexão</button>
    </form>
    <div id="m-resultado" class="alert hidden" style="margin-top:10px"></div>
    ${
      m.eventos.length
        ? `<details style="margin-top:12px"><summary class="small">Histórico recente (${m.eventos.length})</summary><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Quando</th><th>Tipo</th><th>Status</th><th>Detalhe</th></tr></thead><tbody>${m.eventos
            .map(
              (e) => `<tr style="cursor:default"><td class="nowrap">${fmtDataHora(e.created_at)}</td><td>${e.tipo === 'webhook' ? 'Lead recebido' : 'Evento ao Pixel'}</td><td>${esc(e.status)}</td><td class="small">${esc(e.detalhe || '')}${
                e.lead_id ? ` <a href="#" data-ver-lead="${e.lead_id}">ver lead</a>` : ''
              }</td></tr>`,
            )
            .join('')}</tbody></table></div></details>`
        : ''
    }
  </div>`;
  $('#m-copiar', el).addEventListener('click', () => copiar(m.webhook_url));
  $$('[data-ver-lead]', el).forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      abrirLead(Number(a.dataset.verLead));
    }),
  );
  $('#m-teste', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('#m-resultado', el);
    try {
      const r = await api('/api/meta-ads/teste', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      box.className = 'alert ok';
      box.innerHTML = `<div><b>Página:</b> ${esc(r.pagina)}</div><div><b>Pixel:</b> ${esc(r.pixel)}</div>`;
    } catch (err) {
      box.className = 'alert error';
      box.textContent = err.message;
    }
  });
}

const EXEMPLO_HOTMART = {
  id: 'teste-crm',
  event: 'PURCHASE_APPROVED',
  data: {
    product: { id: 0, name: 'Produto de teste' },
    buyer: { name: 'Cliente Teste', email: 'teste@example.com', checkout_phone: '38999990000', address: { city: 'João Pinheiro', state: 'MG' } },
    purchase: { status: 'APPROVED', price: { value: 1500 } },
  },
};

async function viewIntegracao(main, id) {
  const render = async () => {
    const d = await api(`/api/integracoes/${id}`);
    const i = d.integracao;
    const opcoesCaminho = (sel) =>
      `<option value="">— não usar —</option>${d.caminhos
        .map((c) => `<option value="${esc(c.caminho)}" ${c.caminho === sel ? 'selected' : ''}>${esc(c.caminho)}${c.exemplo ? ` (ex.: ${esc(c.exemplo.slice(0, 40))})` : ''}</option>`)
        .join('')}${sel && !d.caminhos.some((c) => c.caminho === sel) ? `<option value="${esc(sel)}" selected>${esc(sel)}</option>` : ''}`;
    main.innerHTML = `<div class="page-head"><div><a href="#/integracoes" class="small muted">← Integrações</a><h1>${esc(i.nome)}</h1><p>Origem registrada nos leads: <span class="tag">${esc(i.origem)}</span></p></div>
      <div class="actions"><button class="btn" id="i-ativo">${i.ativo ? 'Pausar' : 'Ativar'}</button><button class="btn danger" id="i-excluir">Excluir</button></div></div>

      <div class="card"><h2>1. URL do webhook</h2><p class="muted small">Cadastre esta URL na plataforma que vai enviar os dados (método POST, JSON ou formulário). Trate-a como senha: quem tiver a URL consegue enviar leads.</p>
        <div class="copy-row"><input class="input" readonly value="${esc(i.url)}" id="i-url" /><button class="btn" id="i-copiar">Copiar</button></div>
        <div class="actions" style="margin-top:10px"><button class="btn sm" id="i-teste">Enviar evento de teste</button><button class="btn sm ghost" id="i-token">Gerar nova URL</button></div></div>

      <div class="card"><h2>2. Eventos recebidos</h2>
        ${
          d.eventos.length
            ? `<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Recebido em</th><th>Status</th><th>Detalhe</th><th></th></tr></thead><tbody>${d.eventos
                .map(
                  (e) => `<tr style="cursor:default"><td class="nowrap">${fmtDataHora(e.created_at)}</td><td>${esc(
                    { processado: 'Processado', aguardando_mapeamento: 'Aguardando mapeamento', erro: 'Erro', recebido: 'Recebido' }[e.status] || e.status,
                  )}</td><td class="small">${esc(e.detalhe || '')}${e.lead_id ? ` <a href="#" data-ver-lead="${e.lead_id}">ver lead</a>` : ''}</td>
                  <td><button class="btn sm" data-reproc="${e.id}">Reprocessar</button></td></tr>`,
                )
                .join('')}</tbody></table></div>
              <details style="margin-top:10px"><summary class="small">Ver conteúdo do último evento</summary><pre class="code" style="margin-top:8px">${esc(JSON.stringify(d.ultimo_payload, null, 2))}</pre></details>`
            : `<p class="muted">Nenhum evento recebido ainda. Envie um evento de teste pela plataforma (ou use o botão acima) para liberar o mapeamento.</p>`
        }</div>

      <form class="card" id="f-map"><h2>3. Mapeamento de campos</h2><p class="muted small">Escolha qual informação do evento corresponde a cada campo do CRM. É necessário mapear pelo menos o nome ou o telefone.</p>
        ${
          d.caminhos.length
            ? `<div class="table-wrap"><table class="map-table"><thead><tr><th>Campo do CRM</th><th>Informação recebida</th></tr></thead><tbody>${CAMPOS_VISIVEIS
                .map((c) => `<tr style="cursor:default"><td>${esc(ROTULOS_CAMPO[c] || c)}</td><td><select class="input" name="map_${c}">${opcoesCaminho(i.mapeamento[c])}</select></td></tr>`)
                .join('')}</tbody></table></div>`
            : '<div class="alert warn">Aguardando o primeiro evento para listar as informações recebidas.</div>'
        }
        <h2 style="margin-top:18px">4. Etapa de entrada</h2>
        <label class="field" style="max-width:320px;margin-top:8px">Etapa padrão dos leads desta integração<select class="input" name="etapa_padrao">${opcoesEtapa(i.etapa_padrao)}</select></label>
        <p class="muted small">Condições (opcional): a primeira condição verdadeira define a etapa. Ex.: <span class="mono">data.purchase.status</span> igual a <span class="mono">APPROVED</span> → Ganho.</p>
        <div id="regras" style="display:flex;flex-direction:column;gap:8px"></div>
        <datalist id="dl-caminhos">${d.caminhos.map((c) => `<option value="${esc(c.caminho)}"></option>`).join('')}</datalist>
        <div class="actions" style="margin-top:10px"><button class="btn sm" type="button" id="add-regra">+ Adicionar condição</button></div>
        <div class="actions" style="margin-top:18px"><button class="btn primary" type="submit">Salvar mapeamento</button></div>
      </form>`;

    const regraHtml = (r = {}) => `<div class="rule-row">
      <input class="input" list="dl-caminhos" data-r="campo" placeholder="campo do evento" value="${esc(r.campo || '')}" />
      <select class="input" data-r="operador">${[
        ['igual', 'é igual a'],
        ['diferente', 'é diferente de'],
        ['contem', 'contém'],
        ['existe', 'está preenchido'],
      ]
        .map(([v, t]) => `<option value="${v}" ${r.operador === v ? 'selected' : ''}>${t}</option>`)
        .join('')}</select>
      <input class="input" data-r="valor" placeholder="valor" value="${esc(r.valor || '')}" />
      <select class="input" data-r="etapa">${opcoesEtapa(r.etapa || 'novo')}</select>
      <button class="btn ghost sm" type="button" data-remover aria-label="Remover condição">✕</button></div>`;
    const regras = $('#regras');
    regras.innerHTML = i.regras.map(regraHtml).join('');
    regras.addEventListener('click', (e) => e.target.closest('[data-remover]')?.parentElement.remove());
    $('#add-regra').addEventListener('click', () => regras.insertAdjacentHTML('beforeend', regraHtml()));

    $('#i-copiar').addEventListener('click', () => copiar(i.url));
    $('#i-teste').addEventListener('click', async () => {
      try {
        const res = await fetch(i.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EXEMPLO_HOTMART) });
        if (!res.ok) throw new Error('A integração está pausada ou a URL mudou.');
        toast('Evento de teste recebido.');
        render();
      } catch (err) {
        erroToast(err);
      }
    });
    $('#i-token').addEventListener('click', async () => {
      if (!confirm('Gerar uma nova URL? A URL atual deixará de funcionar e precisará ser atualizada na plataforma emissora.')) return;
      await api(`/api/integracoes/${id}`, { method: 'PATCH', body: { novo_token: true } }).catch(erroToast);
      render();
    });
    $('#i-ativo').addEventListener('click', async () => {
      await api(`/api/integracoes/${id}`, { method: 'PATCH', body: { ativo: !i.ativo } }).catch(erroToast);
      render();
    });
    $('#i-excluir').addEventListener('click', async () => {
      if (!confirm('Excluir esta integração? Os leads já criados são mantidos.')) return;
      await api(`/api/integracoes/${id}`, { method: 'DELETE' }).catch(erroToast);
      location.hash = '#/integracoes';
    });
    $$('[data-ver-lead]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        abrirLead(Number(a.dataset.verLead));
      }),
    );
    $$('[data-reproc]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          const r = await api(`/api/integracoes/${id}/eventos/${b.dataset.reproc}/reprocessar`, { method: 'POST' });
          toast(r.status === 'processado' ? 'Evento processado — lead criado/atualizado.' : r.status === 'erro' ? `Erro: ${r.detalhe}` : 'Mapeie nome, e-mail ou telefone para criar leads.');
          render();
        } catch (err) {
          erroToast(err);
        }
      }),
    );
    $('#f-map').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const mapeamento = {};
      for (const c of CAMPOS_VISIVEIS) if (f.get(`map_${c}`)) mapeamento[c] = f.get(`map_${c}`);
      const lista = $$('.rule-row', regras)
        .map((row) => Object.fromEntries($$('[data-r]', row).map((el) => [el.dataset.r, el.value])))
        .filter((r) => r.campo);
      try {
        await api(`/api/integracoes/${id}`, {
          method: 'PATCH',
          body: { ...(d.caminhos.length ? { mapeamento } : {}), etapa_padrao: f.get('etapa_padrao'), regras: lista },
        });
        toast('Mapeamento salvo. Use "Reprocessar" para testar com o último evento.');
        render();
      } catch (err) {
        erroToast(err);
      }
    });
  };
  await render();
}

// ---------- Formulário do site ----------

async function viewSite(main) {
  const endpoint = `${location.origin}/api/public/leads`;
  const m = state.meta;
  const snippet = `<form id="form-orcamento" action="${endpoint}" method="POST">
  <input name="nome" placeholder="Seu nome" required>
  <input name="telefone" placeholder="WhatsApp" required>
  <input name="cidade" placeholder="Cidade (ex.: Paracatu - MG)" required>
  <!-- campo invisível anti-robô: deixe vazio -->
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <!-- opcional: página de obrigado no seu site -->
  <input type="hidden" name="_redirect" value="https://smartmoldbrasil.com.br/obrigado">
  <button type="submit">Solicitar orçamento</button>
</form>`;
  const snippetJs = `fetch('${endpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome, telefone, cidade })
});`;
  main.innerHTML = `<div class="page-head"><div><h1>Formulário do site</h1><p>Como os leads da landing page chegam ao CRM e como são classificados.</p></div>
    <div class="actions"><a class="btn" href="/formulario-exemplo.html" target="_blank" rel="noopener">Abrir formulário de teste</a></div></div>
    <div class="grid grid-2">
      <div class="card"><h2>Critérios de qualificação</h2>
        <pre class="code" style="white-space:pre-wrap;margin-top:10px;background:transparent;border:0;padding:0;font-family:inherit;font-size:13px">${esc(m.criterios)}</pre>
        <p class="small muted">Cidades da região atendida: ${esc(m.cidades_atendidas.join(', '))}.</p>
        <div class="alert ${m.ia_ativa ? 'ok' : 'warn'}">${
          m.ia_ativa
            ? 'Classificação por IA ativa: depois das regras, o Claude lê todas as respostas (inclusive a mensagem livre) e refina a categoria com uma justificativa.'
            : 'Classificação por IA desativada: os leads são classificados só pelas regras acima. Para ativar, configure o secret ANTHROPIC_API_KEY no Worker.'
        }</div>
      </div>
      <div class="card"><h2>Endereço de envio</h2><p class="muted small">O formulário do site deve enviar (POST) para:</p>
        <div class="copy-row"><input class="input" readonly value="${esc(endpoint)}" /><button class="btn" type="button" id="c-end">Copiar</button></div>
        <p class="small muted">Aceita JSON ou formulário HTML comum. Campos: <span class="mono">nome</span>, <span class="mono">telefone</span> (ou whatsapp) e <span class="mono">cidade</span>. A cidade pode vir com o estado, ex.: "Paracatu - MG".
        Envios via JavaScript só são aceitos a partir de: <span class="mono">${esc('smartmoldbrasil.com.br')}</span>.</p>
        <p class="small muted">Formulários Elementor/WordPress também funcionam via "Webhook" nas ações do formulário — use a área de Integrações ou este endereço diretamente.</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="page-head" style="margin-bottom:8px"><h2>Formulário HTML pronto</h2><button class="btn sm" type="button" id="c-html">Copiar código</button></div><pre class="code">${esc(snippet)}</pre></div>
    <div class="card"><div class="page-head" style="margin-bottom:8px"><h2>Envio via JavaScript</h2><button class="btn sm" type="button" id="c-js">Copiar código</button></div><pre class="code">${esc(snippetJs)}</pre></div>`;
  $('#c-end').addEventListener('click', () => copiar(endpoint));
  $('#c-html').addEventListener('click', () => copiar(snippet));
  $('#c-js').addEventListener('click', () => copiar(snippetJs));
}

// ---------- Início ----------

(async function boot() {
  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
    if (user.trocar_senha) renderTrocarSenha();
    else iniciarApp();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) renderLogin();
  }
})();
