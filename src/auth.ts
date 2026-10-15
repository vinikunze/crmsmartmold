import type { Env, SessionUser } from './types.ts';
import { HttpError, clientIp, json, nowIso, readBody, str } from './http.ts';

const ITERACOES = 100_000; // limite máximo do PBKDF2 no Workers
const SESSAO_HORAS = 12;
const MAX_FALHAS = 5;
const BLOQUEIO_MIN = 15;
export const COOKIE = 'crm_session';

const enc = new TextEncoder();

function hex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function tokenAleatorio(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Senha provisória legível (sem caracteres ambíguos). */
export function senhaProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digitos = '23456789';
  const todos = letras + digitos;
  const r = crypto.getRandomValues(new Uint32Array(14));
  let s = '';
  for (let i = 0; i < 12; i++) s += todos[r[i] % todos.length];
  return s + letras[r[12] % letras.length] + digitos[r[13] % digitos.length];
}

export async function hashSenha(senha: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERACOES }, chave, 256);
  return { hash: hex(bits), salt: hex(salt) };
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
}

export function validarNovaSenha(senha: string): string | null {
  if (senha.length < 10) return 'A senha deve ter pelo menos 10 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'A senha deve conter letras e números.';
  return null;
}

function lerCookie(request: Request, nome: string): string | null {
  const header = request.headers.get('Cookie') || '';
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return null;
}

function cookieSessao(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/** Limite simples por chave (ex.: IP) usando janela fixa no D1. Retorna true se ultrapassou. */
export async function excedeuLimite(env: Env, chave: string, maximo: number, janelaMin: number): Promise<boolean> {
  const agora = Date.now();
  const linha = await env.DB.prepare('SELECT contador, janela_inicio FROM rate_limits WHERE chave = ?')
    .bind(chave)
    .first<{ contador: number; janela_inicio: string }>();
  if (!linha || agora - Date.parse(linha.janela_inicio) > janelaMin * 60_000) {
    await env.DB.prepare(
      'INSERT INTO rate_limits (chave, contador, janela_inicio) VALUES (?, 1, ?) ON CONFLICT(chave) DO UPDATE SET contador = 1, janela_inicio = excluded.janela_inicio',
    )
      .bind(chave, new Date(agora).toISOString())
      .run();
    return false;
  }
  if (linha.contador >= maximo) return true;
  await env.DB.prepare('UPDATE rate_limits SET contador = contador + 1 WHERE chave = ?').bind(chave).run();
  return false;
}

export async function usuarioDaSessao(request: Request, env: Env): Promise<SessionUser | null> {
  const token = lerCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.nome, u.email, u.papel, u.trocar_senha
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.ativo = 1`,
  )
    .bind(await sha256(token), nowIso())
    .first<SessionUser>();
  return row ?? null;
}

export async function login(request: Request, env: Env): Promise<Response> {
  if (await excedeuLimite(env, `login:${clientIp(request)}`, 20, 15)) {
    throw new HttpError(429, 'Muitas tentativas a partir deste endereço. Aguarde alguns minutos.');
  }
  const body = await readBody(request);
  const email = (str(body.email, 200) || '').toLowerCase();
  const senha = String(body.senha ?? '');
  const erroGenerico = new HttpError(401, 'E-mail ou senha inválidos.');
  if (!email || !senha) throw erroGenerico;

  const user = await env.DB.prepare(
    'SELECT id, senha_hash, senha_salt, tentativas_falhas, bloqueado_ate, ativo FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: number; senha_hash: string; senha_salt: string; tentativas_falhas: number; bloqueado_ate: string | null; ativo: number }>();

  if (!user || !user.ativo) {
    await hashSenha(senha); // tempo de resposta semelhante para e-mails inexistentes
    throw erroGenerico;
  }
  if (user.bloqueado_ate && Date.parse(user.bloqueado_ate) > Date.now()) {
    throw new HttpError(423, `Conta bloqueada por excesso de tentativas. Tente novamente após ${BLOQUEIO_MIN} minutos ou peça ao administrador para redefinir a senha.`);
  }

  const { hash } = await hashSenha(senha, user.senha_salt);
  if (!iguais(hash, user.senha_hash)) {
    const falhas = user.tentativas_falhas + 1;
    const bloqueio = falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MIN * 60_000).toISOString() : null;
    await env.DB.prepare('UPDATE users SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id = ?')
      .bind(bloqueio ? 0 : falhas, bloqueio, user.id)
      .run();
    if (bloqueio) throw new HttpError(423, `Conta bloqueada por ${BLOQUEIO_MIN} minutos após ${MAX_FALHAS} tentativas incorretas.`);
    throw erroGenerico;
  }

  const token = tokenAleatorio();
  const expira = new Date(Date.now() + SESSAO_HORAS * 3600_000).toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), user.id, expira),
    env.DB.prepare('UPDATE users SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_login = ? WHERE id = ?').bind(nowIso(), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
  ]);
  const sessao = await env.DB.prepare('SELECT id, nome, email, papel, trocar_senha FROM users WHERE id = ?').bind(user.id).first<SessionUser>();
  return json({ user: sessao }, 200, { 'Set-Cookie': cookieSessao(token, SESSAO_HORAS * 3600) });
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const token = lerCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookieSessao('', 0) });
}

export async function trocarSenha(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const body = await readBody(request);
  const atual = String(body.senha_atual ?? '');
  const nova = String(body.nova_senha ?? '');
  const row = await env.DB.prepare('SELECT senha_hash, senha_salt FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ senha_hash: string; senha_salt: string }>();
  if (!row) throw new HttpError(404, 'Usuário não encontrado');
  const { hash } = await hashSenha(atual, row.senha_salt);
  if (!iguais(hash, row.senha_hash)) throw new HttpError(400, 'A senha atual está incorreta.');
  const erro = validarNovaSenha(nova);
  if (erro) throw new HttpError(400, erro);
  if (nova === atual) throw new HttpError(400, 'A nova senha deve ser diferente da atual.');
  const novo = await hashSenha(nova);
  const token = tokenAleatorio();
  const expira = new Date(Date.now() + SESSAO_HORAS * 3600_000).toISOString();
  // Encerra todas as outras sessões e abre uma nova para quem trocou a senha
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET senha_hash = ?, senha_salt = ?, trocar_senha = 0, updated_at = ? WHERE id = ?').bind(novo.hash, novo.salt, nowIso(), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), user.id, expira),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieSessao(token, SESSAO_HORAS * 3600) });
}

export function exigirAdmin(user: SessionUser) {
  if (user.papel !== 'admin') throw new HttpError(403, 'Acesso restrito a administradores.');
}
