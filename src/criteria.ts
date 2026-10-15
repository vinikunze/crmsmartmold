// Regras de negócio do CRM: etapas do pipeline e critérios de qualificação A/B/C.
// Para ajustar a classificação, edite as listas e pontuações abaixo.

export const ETAPAS = [
  { id: 'novo', nome: 'Novo lead' },
  { id: 'em_contato', nome: 'Em contato' },
  { id: 'call_agendada', nome: 'Call agendada' },
  { id: 'call_realizada', nome: 'Call realizada' },
  { id: 'visita_tecnica', nome: 'Visita técnica' },
  { id: 'follow_up', nome: 'Follow-up' },
  { id: 'proposta_enviada', nome: 'Proposta enviada' },
  { id: 'negociacao', nome: 'Negociação' },
  { id: 'ganho', nome: 'Ganho' },
  { id: 'perdido', nome: 'Perdido' },
] as const;

export type EtapaId = (typeof ETAPAS)[number]['id'];
export const ETAPA_IDS: readonly string[] = ETAPAS.map((e) => e.id);
export const ETAPAS_FECHADAS = ['ganho', 'perdido'];

export function nomeEtapa(id: string): string {
  return ETAPAS.find((e) => e.id === id)?.nome ?? id;
}

/** Cidades da região de entrega/atendimento (comparação sem acento e sem maiúsculas). */
export const CIDADES_ATENDIDAS = [
  'João Pinheiro',
  'Paracatu',
  'Patos de Minas',
  'Três Marias',
  'Brasilândia de Minas',
  'Lagoa Grande',
  'Presidente Olegário',
  'São Gonçalo do Abaeté',
  'Varjão de Minas',
  'Buritizeiro',
  'Pirapora',
  'Vazante',
  'Lagamar',
  'Unaí',
  'Guarda-Mor',
  'Canabrava',
];

export const LIMIARES = { A: 70, B: 40 };

export const CRITERIOS_TEXTO = `O formulário pede apenas nome, telefone e cidade, então a classificação é pela localização:
• Lead A: cidade da região atendida pela fábrica.
• Lead B: outra cidade de Minas Gerais (ou cidade sem estado informado).
• Lead C: cidade de outro estado ou cidade não informada.
A categoria pode ser ajustada manualmente na ficha do lead.`;

export interface DadosQualificacao {
  cidade?: string | null;
  uf?: string | null;
}

export interface Classificacao {
  categoria: 'A' | 'B' | 'C';
  score: number;
  motivo: string;
}

export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function categoriaPorScore(score: number): 'A' | 'B' | 'C' {
  if (score >= LIMIARES.A) return 'A';
  if (score >= LIMIARES.B) return 'B';
  return 'C';
}

/** Classificação pela cidade: região atendida = A, resto de MG = B, demais = C. */
export function classificarPorRegras(d: DadosQualificacao): Classificacao {
  if (!d.cidade) return { categoria: 'C', score: 0, motivo: 'Cidade não informada.' };
  const [nome, ufNaCidade] = d.cidade.split(/\s*[-/,]\s*/);
  if (CIDADES_ATENDIDAS.some((x) => semAcento(x) === semAcento(nome))) {
    return { categoria: 'A', score: 100, motivo: `${d.cidade} está na região atendida pela fábrica.` };
  }
  const uf = semAcento(d.uf || ufNaCidade || '');
  if (uf === 'mg' || uf === 'minas gerais') {
    return { categoria: 'B', score: 60, motivo: `${d.cidade} fica em MG, fora da região principal.` };
  }
  if (!uf) return { categoria: 'B', score: 50, motivo: `${d.cidade} fora da região principal (estado não informado).` };
  return { categoria: 'C', score: 20, motivo: `${d.cidade} fica fora de MG.` };
}
