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

export const CRITERIOS_TEXTO = `Pontuação de 0 a 100, somando quatro critérios:
• Quantidade de blocos (até 40 pts): acima de 10.000 = 40 · 3.000–10.000 = 30 · 1.000–3.000 = 15 · até 1.000 = 5.
  Metragem de parede é convertida em blocos (≈12,5 blocos por m²).
• Perfil do cliente (até 25 pts): construtora/empreiteira, revenda de materiais ou órgão público = 25 · produtor rural = 20 ·
  arquiteto/engenheiro = 15 · pessoa física/obra própria = 10.
• Prazo de compra (até 25 pts): imediato = 25 · até 30 dias = 20 · até 90 dias = 10 · apenas pesquisando = 0.
• Região (até 10 pts): cidade atendida pela fábrica = 10 · outra cidade de MG = 5.
Lead A: ${LIMIARES.A}+ pontos · Lead B: ${LIMIARES.B}–${LIMIARES.A - 1} · Lead C: abaixo de ${LIMIARES.B}.`;

export interface DadosQualificacao {
  perfil?: string | null;
  produto?: string | null;
  tipo_obra?: string | null;
  volume?: string | null;
  prazo?: string | null;
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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function contem(texto: string, termos: string[]): boolean {
  return termos.some((t) => texto.includes(t));
}

const BLOCOS_POR_M2 = 12.5;

/** Estima a quantidade de blocos a partir da opção do formulário ou de texto livre ("5 mil blocos", "300 m²"). */
export function quantidadeBlocos(volume: string): number | null {
  const v = semAcento(volume).replace(/\./g, '').replace(',', '.');
  const numeros = [...v.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (numeros.length === 0) return null;
  let n = Math.max(...numeros);
  if (/\bmil\b/.test(v) && n < 1000) n *= 1000;
  const emMetros = /m²|m2\b|metro/.test(v);
  const emBlocos = contem(v, ['bloco', 'peca', 'unid', 'pcs']);
  // Sem unidade: números pequenos costumam ser m² de parede; grandes, quantidade de blocos
  if (emMetros || (!emBlocos && n < 1000)) n *= BLOCOS_POR_M2;
  if (contem(v, ['acima', 'mais de', '+'])) n += 1;
  return Math.round(n);
}

function pontosVolume(volume: string | null | undefined): [number, string] {
  if (!volume) return [0, 'quantidade não informada'];
  const n = quantidadeBlocos(volume);
  if (n === null) {
    const v = semAcento(volume);
    if (contem(v, ['grande', 'alto'])) return [30, `quantidade "${volume}" (grande)`];
    if (contem(v, ['medi'])) return [15, `quantidade "${volume}" (média)`];
    if (contem(v, ['pequen', 'baixo'])) return [5, `quantidade "${volume}" (pequena)`];
    return [0, `quantidade "${volume}" não identificada`];
  }
  const qtd = `~${(Math.round(n / 10) * 10).toLocaleString("pt-BR")} blocos`;
  if (n > 10000) return [40, `volume alto (${qtd})`];
  if (n > 3000) return [30, `volume bom (${qtd})`];
  if (n > 1000) return [15, `volume médio (${qtd})`];
  return [5, `volume pequeno (${qtd})`];
}

function pontosPerfil(perfil: string | null | undefined): [number, string] {
  if (!perfil) return [5, 'perfil não informado'];
  const p = semAcento(perfil);
  if (contem(p, ['construtora', 'incorporadora', 'empreiteir', 'empresa de engenharia', 'empresa']))
    return [25, 'perfil construtora/empresa'];
  if (contem(p, ['revenda', 'revendedor', 'loja', 'deposito', 'material de construcao', 'home center']))
    return [25, 'perfil revenda'];
  if (contem(p, ['prefeitura', 'orgao publico', 'governo', 'licitacao', 'publico']))
    return [25, 'perfil órgão público'];
  if (contem(p, ['produtor', 'rural', 'fazenda', 'agro', 'pecuar'])) return [20, 'perfil produtor rural'];
  if (contem(p, ['arquitet', 'engenheir', 'projetista'])) return [15, 'perfil especificador'];
  if (contem(p, ['pessoa fisica', 'particular', 'obra propria', 'residen', 'casa', 'proprietario']))
    return [10, 'perfil pessoa física'];
  return [5, `perfil "${perfil}"`];
}

function pontosPrazo(prazo: string | null | undefined): [number, string] {
  if (!prazo) return [5, 'prazo não informado'];
  const p = semAcento(prazo);
  if (contem(p, ['pesquis', 'sem previsao', 'so orcamento', 'apenas orcamento', 'ainda nao', 'futuro', 'nao sei']))
    return [0, 'apenas pesquisando'];
  if (contem(p, ['imediat', 'urgente', 'agora', 'esta semana', 'essa semana', 'hoje']))
    return [25, 'compra imediata'];
  if (contem(p, ['30', 'um mes', '1 mes', 'este mes', 'esse mes', '15 dias', 'quinze']))
    return [20, 'compra em até 30 dias'];
  if (contem(p, ['60', '90', '2 meses', '3 meses', 'dois meses', 'tres meses', 'proximos meses']))
    return [10, 'compra em até 90 dias'];
  return [5, `prazo "${prazo}"`];
}

function pontosRegiao(cidade: string | null | undefined, uf: string | null | undefined): [number, string] {
  if (!cidade) return [0, 'cidade não informada'];
  const c = semAcento(cidade.split(/[-/,]/)[0]);
  if (CIDADES_ATENDIDAS.some((x) => semAcento(x) === c)) return [10, `${cidade} está na região atendida`];
  const ufNorm = semAcento(uf || cidade.split(/[-/,]/)[1] || '');
  if (ufNorm === 'mg' || ufNorm === 'minas gerais') return [5, `${cidade} (MG, fora da região principal)`];
  return [0, `${cidade} fora da região atendida`];
}

export function categoriaPorScore(score: number): 'A' | 'B' | 'C' {
  if (score >= LIMIARES.A) return 'A';
  if (score >= LIMIARES.B) return 'B';
  return 'C';
}

/** Classificação determinística por regras. Sempre roda; a IA (se ativa) pode refiná-la. */
export function classificarPorRegras(d: DadosQualificacao): Classificacao {
  const partes = [pontosVolume(d.volume), pontosPerfil(d.perfil), pontosPrazo(d.prazo), pontosRegiao(d.cidade, d.uf)];
  const score = Math.min(100, partes.reduce((s, [p]) => s + p, 0));
  const categoria = categoriaPorScore(score);
  const motivo = `${score} pts — ` + partes.map(([p, txt]) => `${txt} (+${p})`).join('; ');
  return { categoria, score, motivo };
}
