import type { Env, SessionUser } from './types.ts';
import { HttpError, json, nowIso, readBody, str } from './http.ts';
import { exigirAdmin, tokenAleatorio } from './auth.ts';
import { ETAPA_IDS } from './criteria.ts';
import { aplicarMapeamento, CAMPOS_LEAD, etapaPorRegras, listarCaminhos, type Mapeamento, type RegraEtapa } from './mapping.ts';
import { criarOuAtualizarLead } from './leads.ts';

interface IntegracaoRow {
  id: number;
  nome: string;
  token: string;
  origem: string;
  mapeamento: string;
  etapa_padrao: string;
  regras: string;
  ativo: number;
  created_at: string;
  updated_at: string;
}

function urlWebhook(request: Request, token: string): string {
  return `${new URL(request.url).origin}/api/webhooks/${token}`;
}

function formatar(request: Request, i: IntegracaoRow) {
  return {
    ...i,
    mapeamento: JSON.parse(i.mapeamento || '{}'),
    regras: JSON.parse(i.regras || '[]'),
    url: urlWebhook(request, i.token),
  };
}

export async function listarIntegracoes(request: Request, env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const { results } = await env.DB.prepare(
    `SELECT i.*, (SELECT COUNT(*) FROM webhook_events e WHERE e.integracao_id = i.id) AS total_eventos,
            (SELECT MAX(created_at) FROM webhook_events e WHERE e.integracao_id = i.id) AS ultimo_evento
       FROM integrations i ORDER BY i.id DESC`,
  ).all<IntegracaoRow & { total_eventos: number; ultimo_evento: string | null }>();
  return json({ integracoes: results.map((i) => formatar(request, i)), campos: CAMPOS_LEAD });
}

export async function criarIntegracao(request: Request, env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const body = await readBody(request);
  const nome = str(body.nome, 100);
  if (!nome) throw new HttpError(400, 'Dê um nome para a integração (ex.: Hotmart).');
  const origem = str(body.origem, 80) || nome.toLowerCase();
  const row = await env.DB.prepare('INSERT INTO integrations (nome, token, origem) VALUES (?, ?, ?) RETURNING *')
    .bind(nome, tokenAleatorio(24), origem)
    .first<IntegracaoRow>();
  return json({ integracao: formatar(request, row!) }, 201);
}

export async function obterIntegracao(request: Request, env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  const row = await env.DB.prepare('SELECT * FROM integrations WHERE id = ?').bind(id).first<IntegracaoRow>();
  if (!row) throw new HttpError(404, 'Integração não encontrada');
  const { results: eventos } = await env.DB.prepare(
    'SELECT id, status, detalhe, lead_id, created_at, payload FROM webhook_events WHERE integracao_id = ? ORDER BY id DESC LIMIT 20',
  )
    .bind(id)
    .all<{ id: number; status: string; detalhe: string | null; lead_id: number | null; created_at: string; payload: string }>();
  const ultimo = eventos[0] ? JSON.parse(eventos[0].payload) : null;
  return json({
    integracao: formatar(request, row),
    campos: CAMPOS_LEAD,
    eventos: eventos.map(({ payload, ...e }) => ({ ...e, tamanho: payload.length })),
    ultimo_payload: ultimo,
    caminhos: ultimo ? listarCaminhos(ultimo) : [],
  });
}

export async function atualizarIntegracao(request: Request, env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  const body = await readBody(request);
  const sets: string[] = [];
  const params: unknown[] = [];
  if ('nome' in body) {
    const nome = str(body.nome, 100);
    if (!nome) throw new HttpError(400, 'Informe o nome.');
    sets.push('nome = ?');
    params.push(nome);
  }
  if ('origem' in body) {
    sets.push('origem = ?');
    params.push(str(body.origem, 80) || 'webhook');
  }
  if ('ativo' in body) {
    sets.push('ativo = ?');
    params.push(body.ativo ? 1 : 0);
  }
  if ('etapa_padrao' in body) {
    if (!ETAPA_IDS.includes(String(body.etapa_padrao))) throw new HttpError(400, 'Etapa inválida');
    sets.push('etapa_padrao = ?');
    params.push(String(body.etapa_padrao));
  }
  if ('mapeamento' in body) {
    const entrada = (body.mapeamento || {}) as Record<string, unknown>;
    const map: Mapeamento = {};
    for (const campo of CAMPOS_LEAD) {
      const c = str(entrada[campo], 300);
      if (c) map[campo] = c;
    }
    sets.push('mapeamento = ?');
    params.push(JSON.stringify(map));
  }
  if ('regras' in body) {
    const lista = Array.isArray(body.regras) ? body.regras : [];
    const regras: RegraEtapa[] = [];
    for (const r of lista.slice(0, 20) as Record<string, unknown>[]) {
      const campo = str(r.campo, 300);
      const operador = String(r.operador);
      const etapa = String(r.etapa);
      if (!campo || !['igual', 'diferente', 'contem', 'existe'].includes(operador) || !ETAPA_IDS.includes(etapa)) continue;
      regras.push({ campo, operador: operador as RegraEtapa['operador'], valor: str(r.valor, 300) ?? '', etapa });
    }
    sets.push('regras = ?');
    params.push(JSON.stringify(regras));
  }
  if (body.novo_token) {
    sets.push('token = ?');
    params.push(tokenAleatorio(24));
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(nowIso());
    await env.DB.prepare(`UPDATE integrations SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run();
  }
  return obterIntegracao(request, env, user, id);
}

export async function excluirIntegracao(env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM webhook_events WHERE integracao_id = ?').bind(id),
    env.DB.prepare('DELETE FROM integrations WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function processarEvento(env: Env, ctx: ExecutionContext, integ: IntegracaoRow, payload: unknown, eventoId: number) {
  const mapeamento = JSON.parse(integ.mapeamento || '{}') as Mapeamento;
  if (!mapeamento.nome && !mapeamento.email && !mapeamento.telefone) {
    await env.DB.prepare("UPDATE webhook_events SET status = 'aguardando_mapeamento', detalhe = ? WHERE id = ?")
      .bind('Evento recebido. Configure o mapeamento de campos para criar leads.', eventoId)
      .run();
    return { status: 'aguardando_mapeamento' as const };
  }
  const dados = aplicarMapeamento(payload, mapeamento);
  const etapa = etapaPorRegras(payload, JSON.parse(integ.regras || '[]'), integ.etapa_padrao);
  try {
    const { id, novo } = await criarOuAtualizarLead(env, ctx, {
      dados,
      respostas: payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : { payload },
      origem: integ.origem,
      etapa,
      integracaoId: integ.id,
    });
    await env.DB.prepare("UPDATE webhook_events SET status = 'processado', detalhe = ?, lead_id = ? WHERE id = ?")
      .bind(novo ? 'Lead criado.' : 'Lead existente atualizado.', id, eventoId)
      .run();
    return { status: 'processado' as const, lead_id: id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro';
    await env.DB.prepare("UPDATE webhook_events SET status = 'erro', detalhe = ? WHERE id = ?").bind(msg, eventoId).run();
    return { status: 'erro' as const, detalhe: msg };
  }
}

/** Endpoint público que recebe os eventos da plataforma externa. */
export async function receberWebhook(request: Request, env: Env, ctx: ExecutionContext, token: string): Promise<Response> {
  const integ = await env.DB.prepare('SELECT * FROM integrations WHERE token = ? AND ativo = 1').bind(token).first<IntegracaoRow>();
  if (!integ) throw new HttpError(404, 'Webhook não encontrado');
  const payload = await readBody(request);
  const ev = await env.DB.prepare("INSERT INTO webhook_events (integracao_id, payload, status) VALUES (?, ?, 'recebido') RETURNING id")
    .bind(integ.id, JSON.stringify(payload))
    .first<{ id: number }>();
  // Mantém só os 200 eventos mais recentes por integração
  ctx.waitUntil(
    env.DB.prepare(
      'DELETE FROM webhook_events WHERE integracao_id = ? AND id NOT IN (SELECT id FROM webhook_events WHERE integracao_id = ? ORDER BY id DESC LIMIT 200)',
    )
      .bind(integ.id, integ.id)
      .run(),
  );
  const resultado = await processarEvento(env, ctx, integ, payload, ev!.id);
  return json({ ok: true, ...resultado });
}

/** Reprocessa um evento já recebido (usado para testar o mapeamento salvo). */
export async function reprocessarEvento(env: Env, ctx: ExecutionContext, user: SessionUser, id: number, eventoId: number): Promise<Response> {
  exigirAdmin(user);
  const integ = await env.DB.prepare('SELECT * FROM integrations WHERE id = ?').bind(id).first<IntegracaoRow>();
  if (!integ) throw new HttpError(404, 'Integração não encontrada');
  const ev = await env.DB.prepare('SELECT payload FROM webhook_events WHERE id = ? AND integracao_id = ?')
    .bind(eventoId, id)
    .first<{ payload: string }>();
  if (!ev) throw new HttpError(404, 'Evento não encontrado');
  const payload = JSON.parse(ev.payload);
  return json({ ...(await processarEvento(env, ctx, integ, payload, eventoId)), previa: aplicarMapeamento(payload, JSON.parse(integ.mapeamento || '{}')) });
}
