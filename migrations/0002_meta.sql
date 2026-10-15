-- Integração com a Meta (Lead Ads + API de Conversões)
ALTER TABLE leads ADD COLUMN meta_lead_id TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_meta ON leads(meta_lead_id);

-- Registro de webhooks recebidos e eventos enviados ao Pixel
CREATE TABLE IF NOT EXISTS meta_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('webhook', 'capi')),
  referencia TEXT,
  lead_id INTEGER,
  status TEXT NOT NULL,
  detalhe TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_meta_eventos_ref ON meta_eventos(tipo, referencia);
CREATE INDEX IF NOT EXISTS idx_meta_eventos_data ON meta_eventos(created_at);
