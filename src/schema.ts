import type { Env } from './types.ts';

// Atualizações do banco aplicadas automaticamente pelo próprio Worker (idempotentes).
// Mantêm o D1 de produção em dia mesmo sem rodar `wrangler d1 migrations apply`.
let pronto: Promise<void> | null = null;

async function aplicar(env: Env) {
  const coluna = await env.DB.prepare("SELECT 1 FROM pragma_table_info('leads') WHERE name = 'meta_lead_id'").first();
  if (!coluna) {
    try {
      await env.DB.prepare('ALTER TABLE leads ADD COLUMN meta_lead_id TEXT').run();
    } catch (err) {
      if (!String(err).includes('duplicate column')) throw err; // outra instância já aplicou
    }
  }
  await env.DB.batch([
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_leads_meta ON leads(meta_lead_id)'),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS meta_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK (tipo IN ('webhook', 'capi')),
        referencia TEXT,
        lead_id INTEGER,
        status TEXT NOT NULL,
        detalhe TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`,
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_meta_eventos_ref ON meta_eventos(tipo, referencia)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_meta_eventos_data ON meta_eventos(created_at)'),
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)',
    ),
    env.DB.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_meta.sql')"),
  ]);
}

export function garantirEsquema(env: Env): Promise<void> {
  if (!pronto) {
    pronto = aplicar(env).catch((err) => {
      pronto = null; // tenta de novo na próxima requisição
      throw err;
    });
  }
  return pronto;
}
