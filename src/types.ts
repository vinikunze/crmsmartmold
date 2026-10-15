export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS?: string;
  AI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  // Meta Lead Ads (receber leads dos formulários instantâneos)
  META_APP_SECRET?: string;
  META_VERIFY_TOKEN?: string;
  META_PAGE_TOKEN?: string;
  // Meta API de Conversões (devolver o resultado dos leads ao Pixel)
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  META_GRAPH_VERSION?: string;
}

export type Papel = 'admin' | 'vendedor';

export interface SessionUser {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  trocar_senha: number;
}

export interface LeadRow {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  telefone_digitos: string | null;
  cidade: string | null;
  uf: string | null;
  origem: string;
  perfil: string | null;
  produto: string | null;
  tipo_obra: string | null;
  volume: string | null;
  prazo: string | null;
  mensagem: string | null;
  respostas: string;
  categoria: 'A' | 'B' | 'C';
  score: number;
  classificacao_motivo: string | null;
  classificado_por: string;
  etapa: string;
  responsavel_id: number | null;
  valor_estimado: number | null;
  motivo_perda: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  integracao_id: number | null;
  meta_lead_id: string | null;
  created_at: string;
  updated_at: string;
}
