// Normalização de formulários e mapeamento de webhooks para os campos do CRM.

import { semAcento } from './criteria.ts';

export const CAMPOS_LEAD = [
  'nome',
  'email',
  'telefone',
  'cidade',
  'uf',
  'perfil',
  'produto',
  'tipo_obra',
  'volume',
  'prazo',
  'mensagem',
  'valor_estimado',
  'utm_source',
  'utm_medium',
  'utm_campaign',
] as const;

export type CampoLead = (typeof CAMPOS_LEAD)[number];
export type DadosLead = Partial<Record<CampoLead, string>>;

/** Nomes alternativos aceitos no formulário do site para cada campo do CRM. */
const ALIASES: Record<CampoLead, string[]> = {
  nome: ['nome', 'name', 'nome_completo', 'your_name', 'full_name', 'seu_nome', 'first_name'],
  email: ['email', 'e_mail', 'your_email', 'seu_email', 'mail'],
  telefone: ['telefone', 'whatsapp', 'celular', 'phone', 'phone_number', 'fone', 'tel', 'your_phone', 'telefone_whatsapp'],
  cidade: ['cidade', 'city', 'municipio', 'cidade_uf', 'localidade', 'cidade_da_obra'],
  uf: ['uf', 'estado', 'state'],
  perfil: ['perfil', 'voce_e', 'tipo_cliente', 'tipo_de_cliente', 'segmento', 'profile', 'quem_e_voce', 'atuacao'],
  produto: ['produto', 'produtos', 'interesse', 'product', 'produto_de_interesse', 'produtos_de_interesse', 'tipo_de_bloco', 'tipo_do_bloco', 'bloco'],
  tipo_obra: ['tipo_obra', 'tipo_de_obra', 'obra', 'aplicacao', 'finalidade', 'tipo_de_instalacao'],
  volume: ['volume', 'quantidade', 'quantidade_de_blocos', 'quantos_blocos', 'qtd_blocos', 'metragem', 'consumo', 'tamanho_obra', 'tamanho_da_obra', 'area', 'm2', 'qtd'],
  prazo: ['prazo', 'quando', 'urgencia', 'previsao', 'previsao_de_compra', 'quando_pretende_comprar'],
  mensagem: ['mensagem', 'message', 'observacoes', 'observacao', 'comentario', 'your_message', 'duvida', 'detalhes'],
  valor_estimado: ['valor_estimado', 'valor', 'orcamento', 'value', 'price'],
  utm_source: ['utm_source'],
  utm_medium: ['utm_medium'],
  utm_campaign: ['utm_campaign'],
};

const PALAVRAS_CHAVE: [CampoLead, string[]][] = [
  ['perfil', ['voce_e', 'perfil', 'segmento', 'tipo_de_cliente', 'quem_e']],
  ['volume', ['quantos_blocos', 'quantidade', 'tamanho', 'metragem', 'volume', 'm2', 'm_2']],
  ['prazo', ['prazo', 'quando', 'previsao', 'pretende_comprar']],
  ['produto', ['tipo_de_bloco', 'tipo_do_bloco', 'qual_bloco', 'modelo', 'produto', 'interesse']],
  ['tipo_obra', ['tipo_de_obra', 'tipo_da_obra', 'finalidade']],
  ['cidade', ['cidade', 'municipio']],
];

/** "form_fields[Seu Nome]" -> "seu_nome" */
export function chaveNormalizada(chave: string): string {
  const interna = chave.match(/\[([^\]]+)\]\s*$/);
  const base = interna ? interna[1] : chave;
  return semAcento(base)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function valorTexto(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ').trim() || undefined;
  if (typeof v === 'object') return undefined;
  const s = String(v).trim();
  return s ? s.slice(0, 2000) : undefined;
}

/** Converte as respostas do formulário (com nomes de campo variados) nos campos do CRM. */
export function normalizarFormulario(bruto: Record<string, unknown>): { dados: DadosLead; respostas: Record<string, string> } {
  const respostas: Record<string, string> = {};
  const porChave = new Map<string, string>();
  for (const [k, v] of Object.entries(bruto)) {
    if (k.startsWith('_') || k === 'website' || k === 'cf-turnstile-response') continue;
    const t = valorTexto(v);
    if (t === undefined) continue;
    respostas[k] = t;
    porChave.set(chaveNormalizada(k), t);
  }
  const dados: DadosLead = {};
  for (const campo of CAMPOS_LEAD) {
    for (const alias of ALIASES[campo]) {
      const v = porChave.get(alias);
      if (v) {
        dados[campo] = v;
        break;
      }
    }
  }
  // Perguntas personalizadas (ex.: formulários da Meta) com nomes livres: busca por palavra-chave
  for (const [campo, termos] of PALAVRAS_CHAVE) {
    if (dados[campo]) continue;
    for (const [chave, valor] of porChave) {
      if (termos.some((t) => chave.includes(t))) {
        dados[campo] = valor;
        break;
      }
    }
  }
  if (!dados.uf && dados.cidade) {
    const m = dados.cidade.match(/^(.*?)\s*[-/,]\s*([A-Za-z]{2})$/);
    if (m) {
      dados.cidade = m[1].trim();
      dados.uf = m[2].toUpperCase();
    }
  }
  if (dados.email) dados.email = dados.email.toLowerCase();
  return { dados, respostas };
}

/** Lê um valor por caminho "data.buyer.name" ou "items[0].name". */
export function lerCaminho(obj: unknown, caminho: string): unknown {
  if (!caminho) return undefined;
  const partes = caminho.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let atual: unknown = obj;
  for (const p of partes) {
    if (atual === null || typeof atual !== 'object') return undefined;
    atual = (atual as Record<string, unknown>)[p];
  }
  return atual;
}

/** Lista todos os caminhos com valor simples do payload, para montar o mapeamento na tela. */
export function listarCaminhos(obj: unknown, prefixo = '', saida: { caminho: string; exemplo: string }[] = []) {
  if (saida.length >= 300) return saida;
  if (Array.isArray(obj)) {
    obj.slice(0, 5).forEach((v, i) => listarCaminhos(v, `${prefixo}[${i}]`, saida));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      listarCaminhos(v, prefixo ? `${prefixo}.${k}` : k, saida);
    }
  } else if (prefixo) {
    saida.push({ caminho: prefixo, exemplo: String(obj ?? '').slice(0, 120) });
  }
  return saida;
}

export type Mapeamento = Partial<Record<CampoLead, string>>;

export function aplicarMapeamento(payload: unknown, mapeamento: Mapeamento): DadosLead {
  const dados: DadosLead = {};
  for (const campo of CAMPOS_LEAD) {
    const caminho = mapeamento[campo];
    if (!caminho) continue;
    const v = valorTexto(lerCaminho(payload, caminho));
    if (v) dados[campo] = v;
  }
  if (dados.email) dados.email = dados.email.toLowerCase();
  return dados;
}

export interface RegraEtapa {
  campo: string;
  operador: 'igual' | 'diferente' | 'contem' | 'existe';
  valor?: string;
  etapa: string;
}

/** Primeira regra que casar define a etapa; senão, usa a etapa padrão da integração. */
export function etapaPorRegras(payload: unknown, regras: RegraEtapa[], padrao: string): string {
  for (const r of regras) {
    const v = lerCaminho(payload, r.campo);
    const texto = v === undefined || v === null ? '' : semAcento(String(v));
    const alvo = semAcento(r.valor ?? '');
    const ok =
      (r.operador === 'existe' && texto !== '') ||
      (r.operador === 'igual' && texto === alvo) ||
      (r.operador === 'diferente' && texto !== alvo) ||
      (r.operador === 'contem' && alvo !== '' && texto.includes(alvo));
    if (ok) return r.etapa;
  }
  return padrao;
}

export function apenasDigitos(tel: string | null | undefined): string {
  return (tel || '').replace(/\D/g, '');
}
