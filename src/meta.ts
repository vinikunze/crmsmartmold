// Integração com a Meta:
//  • Lead Ads: recebe o aviso de novo lead (webhook "leadgen"), busca os dados na Graph API e cria o lead no CRM.
//  • API de Conversões: devolve ao Pixel a evolução de cada lead (categoria A/B/C e etapas do funil),
//    para a Meta otimizar as campanhas por leads que viram venda.

import type { Env, LeadRow, SessionUser } from './types.ts';
import { HttpError, json, readBody, str } from './http.ts';
import { exigirAdmin } from './auth.ts';
import { semAcento } from './criteria.ts';
import { apenasDigitos, normalizarFormulario } from './mapping.ts';
import { criarOuAtualizarLead } from './leads.ts';

const enc = new TextEncoder();
const versao = (env: Env) => env.META_GRAPH_VERSION || 'v23.0';
const graph = (env: Env, caminho: string) => `https://graph.facebook.com/${versao(env)}/${caminho}`;

export const metaLeadsAtivo = (env: Env) => Boolean(env.META_APP_SECRET && env.META_VERIFY_TOKEN && env.META_PAGE_TOKEN);
export const metaCapiAtivo = (env: Env) => Boolean(env.META_PIXEL_ID && env.META_CAPI_TOKEN);

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
}

async function hmacSha256(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function registrar(env: Env, tipo: 'webhook' | 'capi', referencia: string | null, leadId: number | null, status: string, detalhe: string) {
  await env.DB.prepare('INSERT INTO meta_eventos (tipo, referencia, lead_id, status, detalhe) VALUES (?, ?, ?, ?, ?)')
    .bind(tipo, referencia, leadId, status, detalhe.slice(0, 1000))
    .run();
}

// ---------- Lead Ads (webhook) ----------

/** GET de verificação exigido pela Meta ao cadastrar a URL do webhook. */
export function verificarWebhookMeta(url: URL, env: Env): Response {
  const modo = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token') || '';
  const desafio = url.searchParams.get('hub.challenge') || '';
  if (modo === 'subscribe' && env.META_VERIFY_TOKEN && iguais(token, env.META_VERIFY_TOKEN)) {
    return new Response(desafio, { headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Token de verificação inválido', { status: 403 });
}

interface MetaLeadApi {
  id: string;
  created_time?: string;
  field_data?: { name: string; values: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
  error?: { message: string };
}

async function buscarLead(env: Env, leadgenId: string): Promise<MetaLeadApi> {
  const tentativas = [
    'created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform,is_organic',
    'created_time,field_data,ad_id,form_id', // sem permissão de anúncios, os nomes de campanha não vêm
  ];
  let ultimoErro = '';
  for (const campos of tentativas) {
    const res = await fetch(`${graph(env, leadgenId)}?fields=${campos}`, {
      headers: { Authorization: `Bearer ${env.META_PAGE_TOKEN}` },
    });
    const data = (await res.json()) as MetaLeadApi;
    if (res.ok && !data.error) return data;
    ultimoErro = data.error?.message || `HTTP ${res.status}`;
  }
  throw new Error(`Não foi possível buscar o lead na Meta: ${ultimoErro}`);
}

async function processarLeadMeta(env: Env, ctx: ExecutionContext, leadgenId: string, valor: Record<string, unknown>) {
  const ja = await env.DB.prepare("SELECT lead_id FROM meta_eventos WHERE tipo = 'webhook' AND referencia = ? AND status = 'processado' LIMIT 1")
    .bind(leadgenId)
    .first();
  if (ja) return; // a Meta reenviou o mesmo aviso
  try {
    const lead = await buscarLead(env, leadgenId);
    const respostasBrutas: Record<string, string> = {};
    for (const f of lead.field_data || []) respostasBrutas[f.name] = (f.values || []).join(', ');
    const { dados, respostas } = normalizarFormulario(respostasBrutas);
    if (!dados.nome) {
      const nome = [respostasBrutas.first_name, respostasBrutas.last_name].filter(Boolean).join(' ');
      if (nome) dados.nome = nome;
    }
    dados.utm_source = 'meta';
    dados.utm_medium = lead.is_organic ? 'organico' : 'pago';
    if (lead.campaign_name) dados.utm_campaign = lead.campaign_name;
    const anuncio = {
      'Meta · campanha': lead.campaign_name,
      'Meta · conjunto': lead.adset_name,
      'Meta · anúncio': lead.ad_name,
      'Meta · plataforma': lead.platform,
      'Meta · formulário': lead.form_id || (valor.form_id as string),
      'Meta · ID do lead': leadgenId,
    };
    for (const [k, v] of Object.entries(anuncio)) if (v) respostas[k] = String(v);
    const { id, novo } = await criarOuAtualizarLead(env, ctx, { dados, respostas, origem: 'meta-ads', metaLeadId: leadgenId });
    await registrar(env, 'webhook', leadgenId, id, 'processado', novo ? 'Lead criado.' : 'Lead existente atualizado.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Meta Lead Ads:', msg);
    await registrar(env, 'webhook', leadgenId, null, 'erro', msg);
  }
}

/** POST da Meta com os avisos de novos leads. */
export async function receberWebhookMeta(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!metaLeadsAtivo(env)) throw new HttpError(503, 'Integração com a Meta não configurada');
  const corpo = await request.text();
  if (corpo.length > 256 * 1024) throw new HttpError(413, 'Conteúdo muito grande');
  const assinatura = request.headers.get('X-Hub-Signature-256') || '';
  const esperado = `sha256=${await hmacSha256(env.META_APP_SECRET!, corpo)}`;
  if (!iguais(assinatura, esperado)) {
    await registrar(env, 'webhook', null, null, 'rejeitado', 'Assinatura inválida (confira o META_APP_SECRET).');
    throw new HttpError(401, 'Assinatura inválida');
  }
  let payload: { object?: string; entry?: { changes?: { field: string; value: Record<string, unknown> }[] }[] };
  try {
    payload = JSON.parse(corpo);
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
  const tarefas: Promise<void>[] = [];
  for (const entrada of payload.entry || []) {
    for (const mudanca of entrada.changes || []) {
      if (mudanca.field !== 'leadgen') continue;
      const leadgenId = String(mudanca.value?.leadgen_id || '');
      if (leadgenId) tarefas.push(processarLeadMeta(env, ctx, leadgenId, mudanca.value));
    }
  }
  // Responde rápido para a Meta e processa em segundo plano
  ctx.waitUntil(Promise.all(tarefas));
  return new Response('EVENT_RECEIVED');
}

// ---------- API de Conversões ----------

function partesNome(nome: string): [string, string] {
  const p = semAcento(nome).split(/\s+/).filter(Boolean);
  return [p[0] || '', p.length > 1 ? p[p.length - 1] : ''];
}

async function dadosUsuario(lead: LeadRow) {
  const u: Record<string, unknown> = { country: [await sha256('br')], external_id: [await sha256(`smartmold-crm-${lead.id}`)] };
  if (lead.email) u.em = [await sha256(lead.email.trim().toLowerCase())];
  let tel = apenasDigitos(lead.telefone);
  if (tel.length === 10 || tel.length === 11) tel = `55${tel}`;
  if (tel.length >= 12) u.ph = [await sha256(tel)];
  const [fn, ln] = partesNome(lead.nome || '');
  if (fn) u.fn = [await sha256(fn)];
  if (ln) u.ln = [await sha256(ln)];
  if (lead.cidade) u.ct = [await sha256(semAcento(lead.cidade).replace(/[^a-z]/g, ''))];
  if (lead.uf && lead.uf.length === 2) u.st = [await sha256(lead.uf.toLowerCase())];
  if (lead.meta_lead_id && /^\d+$/.test(lead.meta_lead_id)) u.lead_id = Number(lead.meta_lead_id);
  return u;
}

interface OpcoesEvento {
  valor?: number | null;
  idEvento?: string;
  codigoTeste?: string;
}

/** Envia um evento do CRM ao Pixel (API de Conversões). Silencioso se não configurado. */
export async function enviarEventoMeta(env: Env, leadId: number, nomeEvento: string, opcoes: OpcoesEvento = {}): Promise<{ ok: boolean; detalhe: string }> {
  if (!metaCapiAtivo(env)) return { ok: false, detalhe: 'API de Conversões não configurada' };
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first<LeadRow>();
  if (!lead) return { ok: false, detalhe: 'Lead não encontrado' };
  nomeEvento = nomeEvento.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 40);
  const evento: Record<string, unknown> = {
    event_name: nomeEvento,
    event_time: Math.floor(Date.now() / 1000),
    event_id: opcoes.idEvento || `crm-${lead.id}-${semAcento(nomeEvento).replace(/[^a-z0-9]+/g, '-')}`,
    action_source: 'system_generated',
    user_data: await dadosUsuario(lead),
    custom_data: {
      event_source: 'crm',
      lead_event_source: 'Smart Mold CRM',
      categoria_lead: lead.categoria,
      ...(opcoes.valor ? { value: opcoes.valor, currency: 'BRL' } : {}),
    },
  };
  const corpo: Record<string, unknown> = { data: [evento] };
  if (opcoes.codigoTeste) corpo.test_event_code = opcoes.codigoTeste;
  let detalhe: string;
  let ok = false;
  try {
    const res = await fetch(graph(env, `${env.META_PIXEL_ID}/events`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.META_CAPI_TOKEN}` },
      body: JSON.stringify(corpo),
    });
    const data = (await res.json()) as { events_received?: number; error?: { message: string } };
    ok = res.ok && !data.error;
    detalhe = ok ? `"${nomeEvento}" enviado${opcoes.codigoTeste ? ' (teste)' : ''}.` : `Falha ao enviar "${nomeEvento}": ${data.error?.message || res.status}`;
  } catch (err) {
    detalhe = `Falha ao enviar "${nomeEvento}": ${err instanceof Error ? err.message : err}`;
  }
  await registrar(env, 'capi', nomeEvento, lead.id, ok ? 'enviado' : 'erro', detalhe);
  return { ok, detalhe };
}

// ---------- Painel ----------

export async function statusMeta(request: Request, env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const { results } = await env.DB.prepare(
    'SELECT id, tipo, referencia, lead_id, status, detalhe, created_at FROM meta_eventos ORDER BY id DESC LIMIT 30',
  ).all();
  return json({
    webhook_url: `${new URL(request.url).origin}/api/meta/webhook`,
    leads: {
      ativo: metaLeadsAtivo(env),
      app_secret: Boolean(env.META_APP_SECRET),
      verify_token: Boolean(env.META_VERIFY_TOKEN),
      page_token: Boolean(env.META_PAGE_TOKEN),
    },
    capi: { ativo: metaCapiAtivo(env), pixel_id: Boolean(env.META_PIXEL_ID), capi_token: Boolean(env.META_CAPI_TOKEN) },
    versao: versao(env),
    eventos: results,
  });
}

/** Testa o token da página e envia um evento de teste ao Pixel (aparece em "Eventos de teste"). */
export async function testarMeta(request: Request, env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const body = await readBody(request);
  const resultado: Record<string, string> = {};
  if (env.META_PAGE_TOKEN) {
    const res = await fetch(`${graph(env, 'me')}?fields=id,name`, { headers: { Authorization: `Bearer ${env.META_PAGE_TOKEN}` } });
    const data = (await res.json()) as { name?: string; error?: { message: string } };
    resultado.pagina = data.name ? `Token válido — página "${data.name}".` : `Token da página com problema: ${data.error?.message || res.status}`;
  } else resultado.pagina = 'META_PAGE_TOKEN não configurado.';
  if (metaCapiAtivo(env)) {
    const lead = await env.DB.prepare('SELECT id FROM leads ORDER BY id DESC LIMIT 1').first<{ id: number }>();
    if (!lead) resultado.pixel = 'Cadastre pelo menos um lead para enviar o evento de teste.';
    else {
      const r = await enviarEventoMeta(env, lead.id, 'Teste CRM', { codigoTeste: str(body.codigo_teste, 40) || undefined, idEvento: `crm-teste-${Date.now()}` });
      resultado.pixel = r.detalhe;
    }
  } else resultado.pixel = 'META_PIXEL_ID e/ou META_CAPI_TOKEN não configurados.';
  return json(resultado);
}
