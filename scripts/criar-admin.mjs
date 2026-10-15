// Gera um administrador com senha provisória (troca obrigatória no 1º acesso).
// Uso: node scripts/criar-admin.mjs email@empresa.com "Nome" [--remote|--local]
import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [email, nome = 'Administrador', alvo] = process.argv.slice(2);
if (!email) {
  console.error('Uso: node scripts/criar-admin.mjs email@empresa.com "Nome" [--remote|--local]');
  process.exit(1);
}
const todos = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const r = crypto.getRandomValues(new Uint32Array(14));
let senha = '';
for (let i = 0; i < 12; i++) senha += todos[r[i] % todos.length];
senha += 'Kx' [r[12] % 2] + '23456789'[r[13] % 8];

const salt = crypto.getRandomValues(new Uint8Array(16));
const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, chave, 256);
const hex = (b) => Buffer.from(b).toString('hex');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (nome, email, senha_hash, senha_salt, papel, trocar_senha) VALUES (${q(nome)}, ${q(email.toLowerCase())}, '${hex(bits)}', '${hex(salt)}', 'admin', 1)
ON CONFLICT(email) DO UPDATE SET senha_hash = excluded.senha_hash, senha_salt = excluded.senha_salt, papel = 'admin', trocar_senha = 1, ativo = 1, tentativas_falhas = 0, bloqueado_ate = NULL;`;

if (alvo === '--remote' || alvo === '--local') {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'crmsmartmold-db', alvo, '--command', sql], { stdio: 'inherit' });
} else {
  console.log(sql);
}
console.log(`\nAdministrador: ${email}\nSenha provisória: ${senha}\n(será obrigatório trocar no primeiro acesso)`);
