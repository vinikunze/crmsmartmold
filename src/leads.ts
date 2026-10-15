import type { Env, LeadRow, SessionUser } from './types.ts';
import { HttpError, json, nowIso, readBody, str } from './http.ts';
import { ETAPAS, ETAPAS_FECHADAS, ETAPA_IDS, classificarPorRegras, nomeEtapa } from './criteria.ts';
import { apenasDigitos, CAMPOS_LEAD, separarCidadeUf, type DadosLead } from './mapping.ts';
import { classificarComIA } from './ai.ts';
import { exigirAdmin } from './auth.ts';
import { enviarEventoMeta } from './meta.ts';

export interface NovaEntrada {
  dados: DadosLead;
  respostas: Record<string, unknown>;
  origem: string;
  etapa?: string;
  integracaoId?: number | null;
  userId?: number | null;
  metaLeadId?: string | null;
}

function numero(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function registrarEvento(env: Env, leadId: number, tipo: string, descricao: string, userId: number | null = null) {
  await env.DB.prepare('INSERT INTO lead_events (lead_id, tipo, descricao, user_id) VALUES (?, ?, ?, ?)')
    .bind(leadId, tipo, descricao.slice(0, 2000), userId)
    .run();
}

/** Informa ao Pixel da Meta a categoria atual do lead (evento "Lead A", "Lead B" ou "Lead C"). */
async function enviarCategoriaMeta(env: Env, leadId: number) {
  const lead = await env.DB.prepare('SELECT categoria FROM leads WHERE id = ?').bind(leadId).first<{ categoria: string }>();
  if (lead) await enviarEventoMeta(env, leadId, `Lead ${lead.categoria}`);
}

/** Informa ao Pixel da Meta o avanço no funil (nome da etapa; "Ganho" também envia Purchase com o valor). */
async function enviarEtapaMeta(env: Env, leadId: number, etapa: string) {
  const lead = await env.DB.prepare('SELECT valor_estimado FROM leads WHERE id = ?').bind(leadId).first<{ valor_estimado: number | null }>();
  await enviarEventoMeta(env, leadId, nomeEtapa(etapa), { valor: lead?.valor_estimado });
  if (etapa === 'ganho') await enviarEventoMeta(env, leadId, 'Purchase', { valor: lead?.valor_estimado });
}

/** Reclassifica com a IA em segundo plano, se ela estiver configurada. */
async function refinarComIA(env: Env, leadId: number) {
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first<LeadRow>();
  if (!lead || lead.classificado_por === 'manual') return;
  const entrada = {
    nome: lead.nome,
    cidade: lead.cidade,
    uf: lead.uf,
    perfil: lead.perfil,
    produto: lead.produto,
    tipo_obra: lead.tipo_obra,
    volume: lead.volume,
    prazo: lead.prazo,
    mensagem: lead.mensagem,
    origem: lead.origem,
    respostas_formulario: JSON.parse(lead.respostas || '{}'),
    classificacao_por_regras: { categoria: lead.categoria, score: lead.score, motivo: lead.classificacao_motivo },
  };
  const ia = await classificarComIA(env, entrada);
  if (!ia) return;
  await env.DB.prepare(
    "UPDATE leads SET categoria = ?, score = ?, classificacao_motivo = ?, classificado_por = 'ia', updated_at = ? WHERE id = ? AND classificado_por != 'manual'",
  )
    .bind(ia.categoria, ia.score, ia.motivo, nowIso(), leadId)
    .run();
  await registrarEvento(env, leadId, 'classificacao', `Classificado pela IA como Lead ${ia.categoria} (${ia.score} pts).`);
}

/**
 * Cria um lead (ou atualiza um lead em aberto com o mesmo e-mail/telefone) e classifica.
 * Usado pelo formulário do site, webhooks e cadastro manual.
 */
export async function criarOuAtualizarLead(env: Env, ctx: ExecutionContext, entrada: NovaEntrada): Promise<{ id: number; novo: boolean }> {
  const d = entrada.dados;
  const digitos = apenasDigitos(d.telefone) || null;
  if (!d.nome && !d.email && !digitos) throw new HttpError(400, 'Informe pelo menos nome, e-mail ou telefone.');
  const nome = d.nome || d.email || d.telefone || 'Sem nome';

  const existente = await env.DB.prepare(
    `SELECT * FROM leads
      WHERE etapa NOT IN ('ganho', 'perdido')
        AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND length(?) >= 8 AND telefone_digitos = ?))
      ORDER BY id DESC LIMIT 1`,
  )
    .bind(d.email ?? null, d.email ?? null, digitos, digitos, digitos)
    .first<LeadRow>();

  if (existente) {
    const mesclado: Record<string, unknown> = {};
    for (const campo of CAMPOS_LEAD) {
      if (campo === 'valor_estimado') continue;
      mesclado[campo] = d[campo] ?? (existente as unknown as Record<string, unknown>)[campo] ?? null;
    }
    const respostas = { ...JSON.parse(existente.respostas || '{}'), ...entrada.respostas };
    const regras = classificarPorRegras(mesclado as DadosLead);
    const manual = existente.classificado_por === 'manual';
    await env.DB.prepare(
      `UPDATE leads SET nome = ?, email = ?, telefone = ?, telefone_digitos = ?, cidade = ?, uf = ?, perfil = ?, produto = ?,
         tipo_obra = ?, volume = ?, prazo = ?, mensagem = ?, respostas = ?, categoria = ?, score = ?, classificacao_motivo = ?,
         classificado_por = ?, meta_lead_id = COALESCE(meta_lead_id, ?), updated_at = ? WHERE id = ?`,
    )
      .bind(
        existente.nome && existente.nome !== 'Sem nome' ? existente.nome : nome,
        mesclado.email ?? null,
        mesclado.telefone ?? null,
        apenasDigitos(mesclado.telefone as string) || null,
        mesclado.cidade ?? null,
        mesclado.uf ?? null,
        mesclado.perfil ?? null,
        mesclado.produto ?? null,
        mesclado.tipo_obra ?? null,
        mesclado.volume ?? null,
        mesclado.prazo ?? null,
        mesclado.mensagem ?? null,
        JSON.stringify(respostas),
        manual ? existente.categoria : regras.categoria,
        manual ? existente.score : regras.score,
        manual ? existente.classificacao_motivo : regras.motivo,
        manual ? 'manual' : 'regras',
        entrada.metaLeadId ?? null,
        nowIso(),
        existente.id,
      )
      .run();
    await registrarEvento(env, existente.id, 'reenvio', `Novo contato recebido (${entrada.origem}). Dados do lead atualizados.`, entrada.userId ?? null);
    if (!manual) ctx.waitUntil(refinarComIA(env, existente.id));
    return { id: existente.id, novo: false };
  }

  const regras = classificarPorRegras(d);
  const etapa = entrada.etapa && ETAPA_IDS.includes(entrada.etapa) ? entrada.etapa : 'novo';
  const res = await env.DB.prepare(
    `INSERT INTO leads (nome, email, telefone, telefone_digitos, cidade, uf, origem, perfil, produto, tipo_obra, volume, prazo,
       mensagem, respostas, categoria, score, classificacao_motivo, classificado_por, etapa, valor_estimado,
       utm_source, utm_medium, utm_campaign, integracao_id, responsavel_id, meta_lead_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'regras', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      nome.slice(0, 200),
      d.email ?? null,
      d.telefone ?? null,
      digitos,
      d.cidade ?? null,
      d.uf ? d.uf.slice(0, 30) : null,
      entrada.origem.slice(0, 80),
      d.perfil ?? null,
      d.produto ?? null,
      d.tipo_obra ?? null,
      d.volume ?? null,
      d.prazo ?? null,
      d.mensagem ?? null,
      JSON.stringify(entrada.respostas),
      regras.categoria,
      regras.score,
      regras.motivo,
      etapa,
      numero(d.valor_estimado),
      d.utm_source ?? null,
      d.utm_medium ?? null,
      d.utm_campaign ?? null,
      entrada.integracaoId ?? null,
      entrada.userId ?? null,
      entrada.metaLeadId ?? null,
    )
    .first<{ id: number }>();
  const id = res!.id;
  await registrarEvento(env, id, 'criado', `Lead recebido via ${entrada.origem} — classificado como Lead ${regras.categoria} (${regras.score} pts) pelas regras. Etapa: ${nomeEtapa(etapa)}.`, entrada.userId ?? null);
  ctx.waitUntil(refinarComIA(env, id).finally(() => enviarCategoriaMeta(env, id)));
  return { id, novo: true };
}

// ---------- Listagem, filtros e exportação ----------

function inicioDoDia(data: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  return new Date(`${data}T00:00:00-03:00`).toISOString(); // horário de Brasília
}

function filtros(url: URL): { where: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];
  const q = url.searchParams.get('q')?.trim();
  if (q) {
    const like = `%${q}%`;
    const dig = apenasDigitos(q);
    cond.push(`(l.nome LIKE ? OR l.cidade LIKE ? OR l.email LIKE ?${dig.length >= 4 ? ' OR l.telefone_digitos LIKE ?' : ''})`);
    params.push(like, like, like);
    if (dig.length >= 4) params.push(`%${dig}%`);
  }
  const categorias = (url.searchParams.get('categoria') || '').split(',').filter((c) => ['A', 'B', 'C'].includes(c));
  if (categorias.length) {
    cond.push(`l.categoria IN (${categorias.map(() => '?').join(',')})`);
    params.push(...categorias);
  }
  const etapa = url.searchParams.get('etapa');
  if (etapa && ETAPA_IDS.includes(etapa)) {
    cond.push('l.etapa = ?');
    params.push(etapa);
  }
  const cidade = url.searchParams.get('cidade');
  if (cidade) {
    cond.push('l.cidade = ? COLLATE NOCASE');
    params.push(cidade);
  }
  const origem = url.searchParams.get('origem');
  if (origem) {
    cond.push('l.origem = ?');
    params.push(origem);
  }
  const responsavel = url.searchParams.get('responsavel');
  if (responsavel === 'nenhum') cond.push('l.responsavel_id IS NULL');
  else if (responsavel && /^\d+$/.test(responsavel)) {
    cond.push('l.responsavel_id = ?');
    params.push(Number(responsavel));
  }
  const de = inicioDoDia(url.searchParams.get('de') || '');
  if (de) {
    cond.push('l.created_at >= ?');
    params.push(de);
  }
  const ateParam = url.searchParams.get('ate') || '';
  const ate = inicioDoDia(ateParam);
  if (ate) {
    cond.push('l.created_at < ?');
    params.push(new Date(Date.parse(ate) + 86_400_000).toISOString());
  }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

const ORDENS: Record<string, string> = {
  recentes: 'l.created_at DESC',
  antigos: 'l.created_at ASC',
  score: 'l.score DESC, l.created_at DESC',
  nome: 'l.nome COLLATE NOCASE ASC',
  atualizados: 'l.updated_at DESC',
};

export async function listarLeads(env: Env, url: URL): Promise<Response> {
  const { where, params } = filtros(url);
  const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 50, 1), 500);
  const pagina = Math.max(Number(url.searchParams.get('pagina')) || 1, 1);
  const ordem = ORDENS[url.searchParams.get('ordem') || 'recentes'] || ORDENS.recentes;
  const [lista, total] = await env.DB.batch([
    env.DB.prepare(
      `SELECT l.id, l.nome, l.email, l.telefone, l.cidade, l.uf, l.origem, l.perfil, l.produto, l.volume, l.prazo,
              l.categoria, l.score, l.classificado_por, l.etapa, l.valor_estimado, l.responsavel_id, u.nome AS responsavel_nome,
              l.created_at, l.updated_at
         FROM leads l LEFT JOIN users u ON u.id = l.responsavel_id
         ${where} ORDER BY ${ordem} LIMIT ? OFFSET ?`,
    ).bind(...params, limite, (pagina - 1) * limite),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM leads l ${where}`).bind(...params),
  ]);
  return json({ leads: lista.results, total: (total.results[0] as { total: number }).total, pagina, limite });
}

function csvCampo(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmulas no Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dataBR(iso: string): string {
  const d = new Date(Date.parse(iso) - 3 * 3600_000);
  return `${d.toISOString().slice(8, 10)}/${d.toISOString().slice(5, 7)}/${d.toISOString().slice(0, 4)} ${d.toISOString().slice(11, 16)}`;
}

export async function exportarCsv(env: Env, url: URL): Promise<Response> {
  const { where, params } = filtros(url);
  const { results } = await env.DB.prepare(
    `SELECT l.*, u.nome AS responsavel_nome FROM leads l LEFT JOIN users u ON u.id = l.responsavel_id ${where} ORDER BY l.created_at DESC LIMIT 20000`,
  )
    .bind(...params)
    .all<LeadRow & { responsavel_nome: string | null }>();
  const colunas: [string, (l: LeadRow & { responsavel_nome: string | null }) => unknown][] = [
    ['ID', (l) => l.id],
    ['Data', (l) => dataBR(l.created_at)],
    ['Nome', (l) => l.nome],
    ['Telefone', (l) => l.telefone],
    ['Cidade', (l) => l.cidade],
    ['UF', (l) => l.uf],
    ['Origem', (l) => l.origem],
    ['Categoria', (l) => l.categoria],
    ['Motivo da classificação', (l) => l.classificacao_motivo],
    ['Etapa', (l) => nomeEtapa(l.etapa)],
    ['Responsável', (l) => l.responsavel_nome],
    ['Valor estimado', (l) => (l.valor_estimado ?? '').toString().replace('.', ',')],
    ['Motivo da perda', (l) => l.motivo_perda],
  ];
  const linhas = [colunas.map(([c]) => c).join(';')];
  for (const l of results) linhas.push(colunas.map(([, f]) => csvCampo(f(l))).join(';'));
  const nome = `leads-smartmold-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response('﻿' + linhas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ---------- Detalhe e edição ----------

export async function obterLead(env: Env, id: number): Promise<Response> {
  const lead = await env.DB.prepare(
    'SELECT l.*, u.nome AS responsavel_nome FROM leads l LEFT JOIN users u ON u.id = l.responsavel_id WHERE l.id = ?',
  )
    .bind(id)
    .first();
  if (!lead) throw new HttpError(404, 'Lead não encontrado');
  const { results: eventos } = await env.DB.prepare(
    'SELECT e.id, e.tipo, e.descricao, e.created_at, u.nome AS usuario FROM lead_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.lead_id = ? ORDER BY e.id DESC LIMIT 200',
  )
    .bind(id)
    .all();
  return json({ lead, eventos });
}

const EDITAVEIS = ['nome', 'email', 'telefone', 'cidade', 'uf', 'origem', 'perfil', 'produto', 'tipo_obra', 'volume', 'prazo', 'mensagem', 'motivo_perda'];

export async function atualizarLead(request: Request, env: Env, ctx: ExecutionContext, user: SessionUser, id: number): Promise<Response> {
  const body = await readBody(request);
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<LeadRow>();
  if (!lead) throw new HttpError(404, 'Lead não encontrado');

  const sets: string[] = [];
  const params: unknown[] = [];
  const eventos: [string, string][] = [];

  if ('cidade' in body) {
    const cidade = str(body.cidade, 300);
    const separado = cidade ? separarCidadeUf(cidade) : { cidade: null, uf: undefined };
    body.cidade = separado.cidade;
    body.uf = separado.uf ?? null;
  }

  for (const campo of EDITAVEIS) {
    if (!(campo in body)) continue;
    const valor = str(body[campo], campo === 'mensagem' ? 5000 : 300);
    if (campo === 'nome' && !valor) throw new HttpError(400, 'O nome não pode ficar vazio.');
    sets.push(`${campo} = ?`);
    params.push(campo === 'email' && valor ? valor.toLowerCase() : valor);
    if (campo === 'telefone') {
      sets.push('telefone_digitos = ?');
      params.push(apenasDigitos(valor) || null);
    }
  }
  if ('valor_estimado' in body) {
    sets.push('valor_estimado = ?');
    params.push(numero(body.valor_estimado));
  }
  if ('responsavel_id' in body) {
    const rid = body.responsavel_id === null || body.responsavel_id === '' ? null : Number(body.responsavel_id);
    if (rid !== null) {
      const existe = await env.DB.prepare('SELECT nome FROM users WHERE id = ? AND ativo = 1').bind(rid).first<{ nome: string }>();
      if (!existe) throw new HttpError(400, 'Responsável inválido');
      eventos.push(['responsavel', `Responsável alterado para ${existe.nome}.`]);
    } else eventos.push(['responsavel', 'Responsável removido.']);
    sets.push('responsavel_id = ?');
    params.push(rid);
  }
  if ('etapa' in body && body.etapa !== lead.etapa) {
    const etapa = String(body.etapa);
    if (!ETAPA_IDS.includes(etapa)) throw new HttpError(400, 'Etapa inválida');
    sets.push('etapa = ?');
    params.push(etapa);
    eventos.push(['etapa', `Etapa alterada: ${nomeEtapa(lead.etapa)} → ${nomeEtapa(etapa)}.`]);
  }
  if ('categoria' in body && body.categoria !== lead.categoria) {
    const cat = String(body.categoria);
    if (!['A', 'B', 'C'].includes(cat)) throw new HttpError(400, 'Categoria inválida');
    sets.push('categoria = ?', "classificado_por = 'manual'", 'classificacao_motivo = ?');
    params.push(cat, `Categoria definida manualmente por ${user.nome}.`);
    eventos.push(['classificacao', `Categoria alterada manualmente: Lead ${lead.categoria} → Lead ${cat}.`]);
  }
  if (!sets.length) return json({ ok: true });
  sets.push('updated_at = ?');
  params.push(nowIso());
  await env.DB.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run();
  if (!eventos.length && sets.length > 1) eventos.push(['edicao', 'Dados do lead editados.']);
  // Cidade alterada: refaz a classificação automática (a não ser que tenha sido definida manualmente)
  if ('cidade' in body && !('categoria' in body) && lead.classificado_por !== 'manual' && body.cidade !== lead.cidade) {
    const atual = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<LeadRow>();
    const regras = classificarPorRegras(atual!);
    await env.DB.prepare("UPDATE leads SET categoria = ?, score = ?, classificacao_motivo = ?, classificado_por = 'regras' WHERE id = ?")
      .bind(regras.categoria, regras.score, regras.motivo, id)
      .run();
    if (regras.categoria !== lead.categoria) eventos.push(['classificacao', `Reclassificado pela cidade: Lead ${lead.categoria} → Lead ${regras.categoria}.`]);
  }
  for (const [tipo, desc] of eventos) await registrarEvento(env, id, tipo, desc, user.id);
  if (eventos.some(([t]) => t === 'etapa')) ctx.waitUntil(enviarEtapaMeta(env, id, String(body.etapa)));
  if (eventos.some(([t]) => t === 'classificacao')) ctx.waitUntil(enviarCategoriaMeta(env, id));
  return obterLead(env, id);
}

export async function adicionarNota(request: Request, env: Env, user: SessionUser, id: number): Promise<Response> {
  const body = await readBody(request);
  const texto = str(body.texto, 4000);
  if (!texto) throw new HttpError(400, 'Escreva a anotação.');
  const existe = await env.DB.prepare('SELECT id FROM leads WHERE id = ?').bind(id).first();
  if (!existe) throw new HttpError(404, 'Lead não encontrado');
  await registrarEvento(env, id, 'nota', texto, user.id);
  await env.DB.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').bind(nowIso(), id).run();
  return obterLead(env, id);
}

export async function reclassificar(env: Env, ctx: ExecutionContext, user: SessionUser, id: number): Promise<Response> {
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<LeadRow>();
  if (!lead) throw new HttpError(404, 'Lead não encontrado');
  const regras = classificarPorRegras(lead);
  await env.DB.prepare("UPDATE leads SET categoria = ?, score = ?, classificacao_motivo = ?, classificado_por = 'regras', updated_at = ? WHERE id = ?")
    .bind(regras.categoria, regras.score, regras.motivo, nowIso(), id)
    .run();
  await registrarEvento(env, id, 'classificacao', `Reclassificado pelas regras como Lead ${regras.categoria} (${regras.score} pts).`, user.id);
  await refinarComIA(env, id);
  const depois = await env.DB.prepare('SELECT categoria FROM leads WHERE id = ?').bind(id).first<{ categoria: string }>();
  if (depois && depois.categoria !== lead.categoria) ctx.waitUntil(enviarCategoriaMeta(env, id));
  return obterLead(env, id);
}

export async function excluirLead(env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

export async function criarLeadManual(request: Request, env: Env, ctx: ExecutionContext, user: SessionUser): Promise<Response> {
  const body = await readBody(request);
  const dados: DadosLead = {};
  for (const campo of CAMPOS_LEAD) {
    const v = str(body[campo], campo === 'mensagem' ? 5000 : 300);
    if (v) dados[campo] = campo === 'email' ? v.toLowerCase() : v;
  }
  if (!dados.nome) throw new HttpError(400, 'Informe o nome do lead.');
  if (dados.cidade) Object.assign(dados, separarCidadeUf(dados.cidade, dados.uf));
  const origem = str(body.origem, 80) || 'manual';
  const etapa = str(body.etapa, 40) || 'novo';
  const { id } = await criarOuAtualizarLead(env, ctx, { dados, respostas: {}, origem, etapa, userId: user.id });
  return obterLead(env, id);
}

// ---------- Painel ----------

export async function estatisticas(env: Env): Promise<Response> {
  const seteDias = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const trintaDias = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [porEtapa, porCategoria, recentes, mes, ganhos, origens, cidades, usuarios, porDia] = await env.DB.batch([
    env.DB.prepare('SELECT etapa, COUNT(*) AS n, COALESCE(SUM(valor_estimado), 0) AS valor FROM leads GROUP BY etapa'),
    env.DB.prepare("SELECT categoria, COUNT(*) AS n FROM leads WHERE etapa NOT IN ('ganho','perdido') GROUP BY categoria"),
    env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?').bind(seteDias),
    env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?').bind(trintaDias),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(valor_estimado),0) AS valor FROM leads WHERE etapa = 'ganho' AND updated_at >= ?").bind(trintaDias),
    env.DB.prepare('SELECT origem, COUNT(*) AS n FROM leads GROUP BY origem ORDER BY n DESC LIMIT 50'),
    env.DB.prepare("SELECT cidade, COUNT(*) AS n FROM leads WHERE cidade IS NOT NULL AND cidade != '' GROUP BY cidade COLLATE NOCASE ORDER BY n DESC LIMIT 200"),
    env.DB.prepare('SELECT id, nome FROM users WHERE ativo = 1 ORDER BY nome'),
    env.DB.prepare(
      "SELECT substr(datetime(created_at, '-3 hours'), 1, 10) AS dia, categoria, COUNT(*) AS n FROM leads WHERE created_at >= ? GROUP BY dia, categoria ORDER BY dia",
    ).bind(trintaDias),
  ]);
  return json({
    etapas: ETAPAS,
    porEtapa: porEtapa.results,
    porCategoria: porCategoria.results,
    ultimos7dias: (recentes.results[0] as { n: number }).n,
    ultimos30dias: (mes.results[0] as { n: number }).n,
    ganhos30dias: ganhos.results[0],
    origens: origens.results,
    cidades: cidades.results,
    usuarios: usuarios.results,
    porDia: porDia.results,
    fechadas: ETAPAS_FECHADAS,
  });
}
