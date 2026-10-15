-- Esquema inicial do CRM Smart Mold (idempotente: pode ser reaplicado com segurança)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  senha_salt TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'vendedor' CHECK (papel IN ('admin', 'vendedor')),
  trocar_senha INTEGER NOT NULL DEFAULT 1,
  tentativas_falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  ultimo_login TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Contador de tentativas por IP (login e formulário público)
CREATE TABLE IF NOT EXISTS rate_limits (
  chave TEXT PRIMARY KEY,
  contador INTEGER NOT NULL DEFAULT 0,
  janela_inicio TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  telefone_digitos TEXT,
  cidade TEXT,
  uf TEXT,
  origem TEXT NOT NULL DEFAULT 'site',
  perfil TEXT,
  produto TEXT,
  tipo_obra TEXT,
  volume TEXT,
  prazo TEXT,
  mensagem TEXT,
  respostas TEXT NOT NULL DEFAULT '{}',
  categoria TEXT NOT NULL DEFAULT 'C' CHECK (categoria IN ('A', 'B', 'C')),
  score INTEGER NOT NULL DEFAULT 0,
  classificacao_motivo TEXT,
  classificado_por TEXT NOT NULL DEFAULT 'regras',
  etapa TEXT NOT NULL DEFAULT 'novo',
  responsavel_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  valor_estimado REAL,
  motivo_perda TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  integracao_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);
CREATE INDEX IF NOT EXISTS idx_leads_categoria ON leads(categoria);
CREATE INDEX IF NOT EXISTS idx_leads_cidade ON leads(cidade COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_tel ON leads(telefone_digitos);

-- Histórico do lead: criação, mudança de etapa, notas, reclassificação
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);

-- Integrações via webhook (Hotmart, RD Station, Typeform, Elementor, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  origem TEXT NOT NULL DEFAULT 'webhook',
  mapeamento TEXT NOT NULL DEFAULT '{}',
  etapa_padrao TEXT NOT NULL DEFAULT 'novo',
  regras TEXT NOT NULL DEFAULT '[]',
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integracao_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  detalhe TEXT,
  lead_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_integracao ON webhook_events(integracao_id, created_at);
