import type { Env, SessionUser } from './types.ts';
import { HttpError, json, nowIso, readBody, str } from './http.ts';
import { exigirAdmin, hashSenha, senhaProvisoria } from './auth.ts';

export async function listarUsuarios(env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const { results } = await env.DB.prepare(
    'SELECT id, nome, email, papel, ativo, trocar_senha, bloqueado_ate, ultimo_login, created_at FROM users ORDER BY nome',
  ).all();
  return json({ usuarios: results });
}

/** Convite: cria o usuário com senha provisória, exibida uma única vez ao administrador. */
export async function criarUsuario(request: Request, env: Env, user: SessionUser): Promise<Response> {
  exigirAdmin(user);
  const body = await readBody(request);
  const nome = str(body.nome, 120);
  const email = (str(body.email, 200) || '').toLowerCase();
  const papel = body.papel === 'admin' ? 'admin' : 'vendedor';
  if (!nome) throw new HttpError(400, 'Informe o nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');
  const existe = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existe) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
  const senha = senhaProvisoria();
  const { hash, salt } = await hashSenha(senha);
  const row = await env.DB.prepare(
    'INSERT INTO users (nome, email, senha_hash, senha_salt, papel, trocar_senha) VALUES (?, ?, ?, ?, ?, 1) RETURNING id',
  )
    .bind(nome, email, hash, salt, papel)
    .first<{ id: number }>();
  return json({ id: row!.id, email, senha_provisoria: senha }, 201);
}

async function contarAdminsAtivos(env: Env, excetoId: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE papel = 'admin' AND ativo = 1 AND id != ?")
    .bind(excetoId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function atualizarUsuario(request: Request, env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  const body = await readBody(request);
  const alvo = await env.DB.prepare('SELECT id, papel, ativo FROM users WHERE id = ?').bind(id).first<{ id: number; papel: string; ativo: number }>();
  if (!alvo) throw new HttpError(404, 'Usuário não encontrado');

  const sets: string[] = [];
  const params: unknown[] = [];
  let senha: string | null = null;

  if ('nome' in body) {
    const nome = str(body.nome, 120);
    if (!nome) throw new HttpError(400, 'Informe o nome.');
    sets.push('nome = ?');
    params.push(nome);
  }
  const perdeAdmin =
    (('papel' in body && body.papel !== 'admin') || ('ativo' in body && !body.ativo)) && alvo.papel === 'admin' && alvo.ativo === 1;
  if (perdeAdmin && (await contarAdminsAtivos(env, id)) === 0) {
    throw new HttpError(400, 'O sistema precisa de pelo menos um administrador ativo.');
  }
  if ('papel' in body) {
    sets.push('papel = ?');
    params.push(body.papel === 'admin' ? 'admin' : 'vendedor');
  }
  if ('ativo' in body) {
    sets.push('ativo = ?');
    params.push(body.ativo ? 1 : 0);
  }
  if (body.redefinir_senha) {
    senha = senhaProvisoria();
    const { hash, salt } = await hashSenha(senha);
    sets.push('senha_hash = ?', 'senha_salt = ?', 'trocar_senha = 1', 'tentativas_falhas = 0', 'bloqueado_ate = NULL');
    params.push(hash, salt);
  }
  if (body.desbloquear) sets.push('tentativas_falhas = 0', 'bloqueado_ate = NULL');
  if (!sets.length) return json({ ok: true });
  sets.push('updated_at = ?');
  params.push(nowIso());

  const stmts = [env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id)];
  // Desativar, rebaixar ou redefinir senha encerra as sessões abertas do usuário
  if (senha || ('ativo' in body && !body.ativo) || 'papel' in body) {
    stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true, senha_provisoria: senha });
}

export async function excluirUsuario(env: Env, user: SessionUser, id: number): Promise<Response> {
  exigirAdmin(user);
  if (id === user.id) throw new HttpError(400, 'Você não pode excluir o próprio usuário.');
  const alvo = await env.DB.prepare('SELECT papel, ativo FROM users WHERE id = ?').bind(id).first<{ papel: string; ativo: number }>();
  if (!alvo) throw new HttpError(404, 'Usuário não encontrado');
  if (alvo.papel === 'admin' && alvo.ativo === 1 && (await contarAdminsAtivos(env, id)) === 0) {
    throw new HttpError(400, 'O sistema precisa de pelo menos um administrador ativo.');
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('UPDATE leads SET responsavel_id = NULL WHERE responsavel_id = ?').bind(id),
    env.DB.prepare('UPDATE lead_events SET user_id = NULL WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}
