// API do app. Roda na Cloudflare, atrás do Access: só chega aqui quem fez
// login. Mesmo assim, confere o e-mail contra a lista do casal, para que um
// erro de configuração no Access não abra os dados para ninguém.
//
// Os dois podem lançar e editar para os dois ("almoçamos juntos"): quem
// lançou fica gravado em `criado_por`, mas não aparece na tela.

import { diaValido, horaValida, hoje, somarDias, diasEntre } from '../shared/datas';
import { TIPOS_REFEICAO, RECIPIENTES, CORES, type TipoRefeicao, type Pessoa, type Horario } from '../shared/tipos';
import { calendarioDeLembretes, lembretesDe, INTERVALOS_AGUA } from '../shared/lembretes';

interface Env {
  DB: D1Database;
  EMAILS_PERMITIDOS: string;
}

interface AccessCtx {
  access?: { aud: string; getIdentity(): Promise<{ email?: string } | undefined> };
}

const CAMPOS_PESSOA = 'id, email, nome, meta_agua_ml, copo_ml, garrafa_ml, meta_kcal, peso_g, recipiente, cor';
const CAMPOS_REFEICAO = 'id, pessoa_id, dia, hora, tipo, descricao, kcal, obs, criado_em';
const CAMPOS_AGUA = 'id, pessoa_id, dia, hora, ml, criado_em';

/** Maior período que uma leitura devolve de uma vez. */
const MAX_DIAS_LEITURA = 120;

class Erro extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function quemEsta(env: Env, ctx: AccessCtx): Promise<string> {
  if (!ctx.access) throw new Erro(401, 'Login necessário.');
  const identidade = await ctx.access.getIdentity();
  const email = identidade?.email?.trim().toLowerCase();
  const permitidos = env.EMAILS_PERMITIDOS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!email || !permitidos.includes(email)) throw new Erro(403, 'Este e-mail não tem acesso ao app.');
  return email;
}

// ---------- validação ----------

function texto(v: unknown, campo: string, max: number): string {
  if (typeof v !== 'string' || v.trim().length === 0) throw new Erro(400, `Preencha ${campo}.`);
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length > max) throw new Erro(400, `${campo[0].toUpperCase()}${campo.slice(1)} pode ter até ${max} caracteres.`);
  return t;
}

function textoOpcional(v: unknown, campo: string, max: number): string | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  if (typeof v !== 'string') throw new Erro(400, `${campo} inválido.`);
  const t = v.trim();
  if (t.length > max) throw new Erro(400, `${campo} pode ter até ${max} caracteres.`);
  return t;
}

function inteiro(v: unknown, min: number, max: number, mensagem: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Erro(400, mensagem);
  return v;
}

function inteiroOpcional(v: unknown, min: number, max: number, mensagem: string): number | null {
  if (v === null || v === undefined) return null;
  return inteiro(v, min, max, mensagem);
}

function chave(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 64) throw new Erro(400, 'Chave inválida.');
  return v;
}

/**
 * Dia do registro. Aceita até amanhã (folga para relógio do aparelho
 * adiantado) e até dois anos para trás: fora disso é engano de digitação.
 */
function dia(v: unknown): string {
  if (!diaValido(v)) throw new Erro(400, 'Dia inválido.');
  const h = hoje();
  if (v > somarDias(h, 1)) throw new Erro(400, 'Ainda não chegou esse dia.');
  if (diasEntre(v, h) > 730) throw new Erro(400, 'Esse dia é antigo demais.');
  return v;
}

function hora(v: unknown): string {
  if (!horaValida(v)) throw new Erro(400, 'Horário inválido.');
  return v;
}

function tipo(v: unknown): TipoRefeicao {
  if (!TIPOS_REFEICAO.includes(v as TipoRefeicao)) throw new Erro(400, 'Escolha a refeição.');
  return v as TipoRefeicao;
}

/** Um dos valores de uma lista fechada (formato da garrafa, cor). */
function umDe<T extends string>(v: unknown, validos: T[], mensagem: string): T {
  if (!validos.includes(v as T)) throw new Erro(400, mensagem);
  return v as T;
}

function id(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Erro(404, 'Não encontrado.');
  return n;
}

async function pessoa(env: Env, v: unknown): Promise<number> {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new Erro(400, 'Escolha de quem é.');
  const p = await env.DB.prepare('SELECT id FROM pessoas WHERE id = ?').bind(v).first();
  if (!p) throw new Erro(400, 'Essa pessoa não existe.');
  return v;
}

async function corpo(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch { /* cai no erro abaixo */ }
  throw new Erro(400, 'Corpo da requisição inválido.');
}

const agora = () => new Date().toISOString();

// ---------- leitura ----------

async function dados(env: Env, url: URL): Promise<Response> {
  const ate = url.searchParams.get('ate') ?? hoje();
  const de = url.searchParams.get('de') ?? somarDias(ate, -34);
  if (!diaValido(de) || !diaValido(ate) || de > ate) throw new Erro(400, 'Período inválido.');
  if (diasEntre(de, ate) > MAX_DIAS_LEITURA) throw new Erro(400, `Período de até ${MAX_DIAS_LEITURA} dias.`);
  const [pessoas, horarios, refeicoes, agua] = await env.DB.batch([
    env.DB.prepare(`SELECT ${CAMPOS_PESSOA} FROM pessoas ORDER BY ordem, id`),
    env.DB.prepare('SELECT pessoa_id, tipo, hora FROM horarios ORDER BY hora'),
    env.DB.prepare(`SELECT ${CAMPOS_REFEICAO} FROM refeicoes WHERE dia BETWEEN ? AND ? ORDER BY dia, hora, id`).bind(de, ate),
    env.DB.prepare(`SELECT ${CAMPOS_AGUA} FROM agua WHERE dia BETWEEN ? AND ? ORDER BY dia, hora, id`).bind(de, ate),
  ]);
  return json({ de, ate, pessoas: pessoas.results, horarios: horarios.results, refeicoes: refeicoes.results, agua: agua.results });
}

// ---------- água ----------

async function criarAgua(env: Env, req: Request, email: string): Promise<Response> {
  const b = await corpo(req);
  const k = chave(b.chave);
  // Reenvio do mesmo copo (a rede caiu no meio): devolve o que já existe.
  const ja = await env.DB.prepare(`SELECT ${CAMPOS_AGUA} FROM agua WHERE chave = ?`).bind(k).first();
  if (ja) return json(ja);
  const novo = await env.DB.prepare(
    `INSERT INTO agua (chave, pessoa_id, dia, hora, ml, criado_por) VALUES (?, ?, ?, ?, ?, ?) RETURNING ${CAMPOS_AGUA}`,
  ).bind(k, await pessoa(env, b.pessoa_id), dia(b.dia), hora(b.hora), inteiro(b.ml, 10, 3000, 'Quantidade de água vai de 10 ml a 3 L.'), email).first();
  return json(novo, 201);
}

// ---------- refeições ----------

function camposRefeicao(b: Record<string, unknown>) {
  return {
    dia: dia(b.dia),
    hora: hora(b.hora),
    tipo: tipo(b.tipo),
    descricao: texto(b.descricao, 'o que comeu', 300),
    kcal: inteiroOpcional(b.kcal, 1, 5000, 'Calorias vão de 1 a 5000.'),
    obs: textoOpcional(b.obs, 'Observação', 300),
  };
}

async function criarRefeicao(env: Env, req: Request, email: string): Promise<Response> {
  const b = await corpo(req);
  const k = chave(b.chave);
  const ja = await env.DB.prepare(`SELECT ${CAMPOS_REFEICAO} FROM refeicoes WHERE chave = ?`).bind(k).first();
  if (ja) return json(ja);
  const p = await pessoa(env, b.pessoa_id);
  const r = camposRefeicao(b);
  const nova = await env.DB.prepare(
    `INSERT INTO refeicoes (chave, pessoa_id, dia, hora, tipo, descricao, kcal, obs, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${CAMPOS_REFEICAO}`,
  ).bind(k, p, r.dia, r.hora, r.tipo, r.descricao, r.kcal, r.obs, email).first();
  return json(nova, 201);
}

async function editarRefeicao(env: Env, req: Request, refId: number): Promise<Response> {
  const b = await corpo(req);
  const r = camposRefeicao(b);
  const editada = await env.DB.prepare(
    `UPDATE refeicoes SET dia = ?, hora = ?, tipo = ?, descricao = ?, kcal = ?, obs = ?, atualizado_em = ?
     WHERE id = ? RETURNING ${CAMPOS_REFEICAO}`,
  ).bind(r.dia, r.hora, r.tipo, r.descricao, r.kcal, r.obs, agora(), refId).first();
  if (!editada) throw new Erro(404, 'Refeição não encontrada.');
  return json(editada);
}

// ---------- pessoas e plano ----------

async function editarPessoa(env: Env, req: Request, pessoaId: number): Promise<Response> {
  const b = await corpo(req);
  const atual = await env.DB.prepare(`SELECT ${CAMPOS_PESSOA} FROM pessoas WHERE id = ?`).bind(pessoaId)
    .first<Record<string, unknown>>();
  if (!atual) throw new Erro(404, 'Pessoa não encontrada.');
  // Só muda o que veio; o resto continua como estava.
  const v = <T>(campo: string, ler: (x: unknown) => T): T => (b[campo] === undefined ? (atual[campo] as T) : ler(b[campo]));
  const p = await env.DB.prepare(
    `UPDATE pessoas SET nome = ?, meta_agua_ml = ?, copo_ml = ?, garrafa_ml = ?, meta_kcal = ?, peso_g = ?,
       recipiente = ?, cor = ?
     WHERE id = ? RETURNING ${CAMPOS_PESSOA}`,
  ).bind(
    v('nome', (x) => texto(x, 'o nome', 30)),
    v('meta_agua_ml', (x) => inteiro(x, 500, 8000, 'A meta de água vai de 500 ml a 8 L.')),
    v('copo_ml', (x) => inteiro(x, 50, 2000, 'O copo vai de 50 ml a 2 L.')),
    v('garrafa_ml', (x) => inteiro(x, 50, 2000, 'A garrafa vai de 50 ml a 2 L.')),
    v('meta_kcal', (x) => inteiroOpcional(x, 800, 6000, 'A meta de calorias vai de 800 a 6000.')),
    v('peso_g', (x) => inteiroOpcional(x, 30000, 300000, 'Peso entre 30 e 300 kg.')),
    v('recipiente', (x) => umDe(x, RECIPIENTES.map((r) => r.tipo), 'Formato de garrafa inválido.')),
    v('cor', (x) => umDe(x, CORES.map((c) => c.cor), 'Cor inválida.')),
    pessoaId,
  ).first();
  return json(p);
}

/** Troca o plano de horários inteiro da pessoa de uma vez. */
async function salvarHorarios(env: Env, req: Request, pessoaId: number): Promise<Response> {
  const b = await corpo(req);
  const lista = b.horarios;
  if (!Array.isArray(lista) || lista.length > 6) throw new Erro(400, 'Horários inválidos.');
  const vistos = new Set<string>();
  const limpos = lista.map((h) => {
    const x = (h ?? {}) as Record<string, unknown>;
    const t = tipo(x.tipo);
    if (t === 'outro') throw new Erro(400, '"Outro" não entra no plano.');
    if (vistos.has(t)) throw new Erro(400, 'Refeição repetida no plano.');
    vistos.add(t);
    return { tipo: t, hora: hora(x.hora) };
  });
  await pessoa(env, pessoaId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM horarios WHERE pessoa_id = ?').bind(pessoaId),
    ...limpos.map((h) => env.DB.prepare('INSERT INTO horarios (pessoa_id, tipo, hora) VALUES (?, ?, ?)').bind(pessoaId, h.tipo, h.hora)),
  ]);
  const { results } = await env.DB.prepare('SELECT pessoa_id, tipo, hora FROM horarios WHERE pessoa_id = ? ORDER BY hora').bind(pessoaId).all();
  return json(results);
}

// ---------- lembretes no calendário ----------

/**
 * Arquivo .ics com os lembretes da pessoa (refeições do plano salvo e água).
 * `inline`: no iPhone abre direto a tela "Adicionar ao calendário".
 */
async function lembretesIcs(env: Env, url: URL, pessoaId: number): Promise<Response> {
  const p = await env.DB.prepare(`SELECT ${CAMPOS_PESSOA} FROM pessoas WHERE id = ?`).bind(pessoaId).first<Pessoa>();
  if (!p) throw new Erro(404, 'Pessoa não encontrada.');
  const agua = Number(url.searchParams.get('agua') ?? 0);
  if (!(INTERVALOS_AGUA as readonly number[]).includes(agua)) throw new Erro(400, 'Intervalo de água inválido.');
  const opcoes = { refeicoes: url.searchParams.get('refeicoes') !== '0', agua, link: url.origin };
  const { results: plano } = await env.DB.prepare('SELECT pessoa_id, tipo, hora FROM horarios WHERE pessoa_id = ?').bind(pessoaId).all<Horario>();
  if (lembretesDe(p, plano, opcoes).length === 0) throw new Erro(400, 'Escolha ao menos um lembrete.');
  return new Response(calendarioDeLembretes(p, plano, opcoes), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="lembretes-em-dia.ics"',
      'cache-control': 'no-store',
    },
  });
}

// ---------- rotas ----------

async function api(req: Request, env: Env, ctx: AccessCtx): Promise<Response> {
  const url = new URL(req.url);
  const [recurso, param, acao] = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const m = req.method;

  // Proteção contra outro site usando a sessão de vocês (CSRF).
  if (m !== 'GET' && req.headers.get('origin') && req.headers.get('origin') !== url.origin) {
    throw new Erro(403, 'Origem não permitida.');
  }

  const email = await quemEsta(env, ctx);

  if (recurso === 'eu' && m === 'GET') {
    const p = await env.DB.prepare('SELECT id FROM pessoas WHERE email = ?').bind(email).first<{ id: number }>();
    return json({ email, pessoa_id: p?.id ?? null });
  }

  if (recurso === 'dados' && m === 'GET') return dados(env, url);

  if (recurso === 'agua') {
    if (!param && m === 'POST') return criarAgua(env, req, email);
    if (param && m === 'DELETE') {
      await env.DB.prepare('DELETE FROM agua WHERE id = ?').bind(id(param)).run();
      return json({ ok: true });
    }
  }

  if (recurso === 'refeicoes') {
    if (!param && m === 'POST') return criarRefeicao(env, req, email);
    if (param && m === 'PUT') return editarRefeicao(env, req, id(param));
    if (param && m === 'DELETE') {
      await env.DB.prepare('DELETE FROM refeicoes WHERE id = ?').bind(id(param)).run();
      return json({ ok: true });
    }
  }

  if (recurso === 'pessoas' && param) {
    if (!acao && m === 'PATCH') return editarPessoa(env, req, id(param));
    if (acao === 'horarios' && m === 'PUT') return salvarHorarios(env, req, id(param));
    if (acao === 'lembretes.ics' && m === 'GET') return lembretesIcs(env, url, id(param));
  }

  throw new Erro(404, 'Rota não encontrada.');
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & AccessCtx): Promise<Response> {
    try {
      return await api(req, env, ctx);
    } catch (e) {
      if (e instanceof Erro) return json({ erro: e.message }, e.status);
      console.error(e);
      return json({ erro: 'Erro inesperado. Tente de novo.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
