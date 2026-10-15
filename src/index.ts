import type { Env, SessionUser } from './types.ts';
import { HttpError, clientIp, json, readBody } from './http.ts';
import { excedeuLimite, login, logout, trocarSenha, usuarioDaSessao } from './auth.ts';
import { CIDADES_ATENDIDAS, CRITERIOS_TEXTO, ETAPAS, LIMIARES } from './criteria.ts';
import { normalizarFormulario } from './mapping.ts';
import {
  adicionarNota,
  atualizarLead,
  criarLeadManual,
  criarOuAtualizarLead,
  estatisticas,
  excluirLead,
  exportarCsv,
  listarLeads,
  obterLead,
  reclassificar,
} from './leads.ts';
import { atualizarUsuario, criarUsuario, excluirUsuario, listarUsuarios } from './users.ts';
import {
  atualizarIntegracao,
  criarIntegracao,
  excluirIntegracao,
  listarIntegracoes,
  obterIntegracao,
  receberWebhook,
  reprocessarEvento,
} from './integrations.ts';
import { iaAtiva } from './ai.ts';

function origensPermitidas(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!origin || !origensPermitidas(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Recebe o formulário da landing page (JSON, urlencoded ou multipart). */
async function receberFormulario(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const headers = cors(request, env);
  if (await excedeuLimite(env, `form:${clientIp(request)}`, 15, 60)) {
    return json({ ok: false, erro: 'Muitos envios. Tente novamente mais tarde.' }, 429, headers);
  }
  const bruto = await readBody(request);
  const redirect = typeof bruto._redirect === 'string' ? bruto._redirect : null;
  // Campo "isca" invisível: robôs costumam preenchê-lo
  const honeypot = bruto.website || bruto._gotcha;
  if (!honeypot) {
    const { dados, respostas } = normalizarFormulario(bruto);
    const origem = typeof bruto._origem === 'string' && bruto._origem.trim() ? bruto._origem.trim().slice(0, 80) : 'site';
    await criarOuAtualizarLead(env, ctx, { dados, respostas, origem });
  }
  if (redirect) {
    try {
      const destino = new URL(redirect);
      if (origensPermitidas(env).includes(destino.origin)) return Response.redirect(destino.toString(), 303);
    } catch {
      /* ignora redirect inválido */
    }
  }
  return json({ ok: true, mensagem: 'Recebemos seu contato! Em breve nossa equipe falará com você.' }, 200, headers);
}

type Handler = (ctx: { request: Request; env: Env; ctx: ExecutionContext; user: SessionUser; params: string[]; url: URL }) => Promise<Response>;

const rotas: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/meta$/, async ({ env }) =>
    json({ etapas: ETAPAS, criterios: CRITERIOS_TEXTO, limiares: LIMIARES, cidades_atendidas: CIDADES_ATENDIDAS, ia_ativa: iaAtiva(env) })],
  ['GET', /^\/api\/stats$/, async ({ env }) => estatisticas(env)],
  ['GET', /^\/api\/leads$/, async ({ env, url }) => listarLeads(env, url)],
  ['GET', /^\/api\/leads\/export\.csv$/, async ({ env, url }) => exportarCsv(env, url)],
  ['POST', /^\/api\/leads$/, async ({ request, env, ctx, user }) => criarLeadManual(request, env, ctx, user)],
  ['GET', /^\/api\/leads\/(\d+)$/, async ({ env, params }) => obterLead(env, Number(params[0]))],
  ['PATCH', /^\/api\/leads\/(\d+)$/, async ({ request, env, user, params }) => atualizarLead(request, env, user, Number(params[0]))],
  ['DELETE', /^\/api\/leads\/(\d+)$/, async ({ env, user, params }) => excluirLead(env, user, Number(params[0]))],
  ['POST', /^\/api\/leads\/(\d+)\/notas$/, async ({ request, env, user, params }) => adicionarNota(request, env, user, Number(params[0]))],
  ['POST', /^\/api\/leads\/(\d+)\/reclassificar$/, async ({ env, user, params }) => reclassificar(env, user, Number(params[0]))],
  ['GET', /^\/api\/usuarios$/, async ({ env, user }) => listarUsuarios(env, user)],
  ['POST', /^\/api\/usuarios$/, async ({ request, env, user }) => criarUsuario(request, env, user)],
  ['PATCH', /^\/api\/usuarios\/(\d+)$/, async ({ request, env, user, params }) => atualizarUsuario(request, env, user, Number(params[0]))],
  ['DELETE', /^\/api\/usuarios\/(\d+)$/, async ({ env, user, params }) => excluirUsuario(env, user, Number(params[0]))],
  ['GET', /^\/api\/integracoes$/, async ({ request, env, user }) => listarIntegracoes(request, env, user)],
  ['POST', /^\/api\/integracoes$/, async ({ request, env, user }) => criarIntegracao(request, env, user)],
  ['GET', /^\/api\/integracoes\/(\d+)$/, async ({ request, env, user, params }) => obterIntegracao(request, env, user, Number(params[0]))],
  ['PATCH', /^\/api\/integracoes\/(\d+)$/, async ({ request, env, user, params }) => atualizarIntegracao(request, env, user, Number(params[0]))],
  ['DELETE', /^\/api\/integracoes\/(\d+)$/, async ({ env, user, params }) => excluirIntegracao(env, user, Number(params[0]))],
  ['POST', /^\/api\/integracoes\/(\d+)\/eventos\/(\d+)\/reprocessar$/, async ({ env, ctx, user, params }) =>
    reprocessarEvento(env, ctx, user, Number(params[0]), Number(params[1]))],
];

async function rotear(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const metodo = request.method.toUpperCase();

  // --- Rotas públicas ---
  if (pathname === '/api/public/leads') {
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (metodo === 'POST') return receberFormulario(request, env, ctx);
    throw new HttpError(405, 'Método não permitido');
  }
  const webhook = pathname.match(/^\/api\/webhooks\/([A-Za-z0-9_-]{16,})$/);
  if (webhook) {
    if (metodo === 'GET') return json({ ok: true, mensagem: 'Webhook ativo. Envie eventos via POST.' });
    if (metodo === 'POST') return receberWebhook(request, env, ctx, webhook[1]);
    throw new HttpError(405, 'Método não permitido');
  }

  // Requisições que alteram dados exigem cabeçalho próprio do painel (proteção contra CSRF)
  if (metodo !== 'GET' && request.headers.get('X-CRM') !== '1') throw new HttpError(403, 'Requisição não autorizada');

  if (pathname === '/api/auth/login' && metodo === 'POST') return login(request, env);
  if (pathname === '/api/auth/logout' && metodo === 'POST') return logout(request, env);

  const user = await usuarioDaSessao(request, env);
  if (!user) throw new HttpError(401, 'Sessão expirada. Faça login novamente.');
  if (pathname === '/api/auth/me' && metodo === 'GET') return json({ user });
  if (pathname === '/api/auth/senha' && metodo === 'POST') return trocarSenha(request, env, user);
  if (user.trocar_senha) throw new HttpError(403, 'Troque a senha provisória para continuar.');

  for (const [m, re, handler] of rotas) {
    if (m !== metodo) continue;
    const match = pathname.match(re);
    if (match) return handler({ request, env, ctx, user, params: match.slice(1), url });
  }
  throw new HttpError(404, 'Rota não encontrada');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await rotear(request, env, ctx);
    } catch (err) {
      const extra = url.pathname === '/api/public/leads' ? cors(request, env) : {};
      if (err instanceof HttpError) return json({ ok: false, erro: err.message }, err.status, extra);
      console.error(err);
      return json({ ok: false, erro: 'Erro interno. Tente novamente.' }, 500, extra);
    }
  },
} satisfies ExportedHandler<Env>;

