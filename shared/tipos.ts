// Formato dos dados que a API devolve. Usado pela tela e pela API.

export type TipoRefeicao = 'cafe' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia' | 'outro';

/** Ordem do dia. "Outro" (beliscou, docinho fora de hora) vale em qualquer horário. */
// `hora` é a sugerida ao ligar a refeição no plano (Ajustes). O plano inicial
// (migração 0001) tem café, almoço, lanche da tarde e jantar.
export const REFEICOES: { tipo: TipoRefeicao; nome: string; icone: string; hora: string }[] = [
  { tipo: 'cafe', nome: 'Café da manhã', icone: 'cafe', hora: '07:30' },
  { tipo: 'lanche_manha', nome: 'Lanche da manhã', icone: 'maca', hora: '10:00' },
  { tipo: 'almoco', nome: 'Almoço', icone: 'prato', hora: '12:00' },
  { tipo: 'lanche_tarde', nome: 'Lanche da tarde', icone: 'sanduiche', hora: '16:00' },
  { tipo: 'jantar', nome: 'Jantar', icone: 'sopa', hora: '20:00' },
  { tipo: 'ceia', nome: 'Ceia', icone: 'lua', hora: '22:00' },
  { tipo: 'outro', nome: 'Outro', icone: 'biscoito', hora: '15:00' },
];

export const TIPOS_REFEICAO = REFEICOES.map((r) => r.tipo);

export const nomeDaRefeicao = (t: TipoRefeicao) => REFEICOES.find((r) => r.tipo === t)?.nome ?? 'Refeição';

export interface Pessoa {
  id: number;
  email: string;
  nome: string;
  /** Meta de água do dia, em ml. */
  meta_agua_ml: number;
  /** Tamanho dos dois botões rápidos de água, em ml. */
  copo_ml: number;
  garrafa_ml: number;
  /** Meta de calorias. null = não controla calorias. */
  meta_kcal: number | null;
  /** Peso em gramas, só para sugerir a meta de água. null = não informou. */
  peso_g: number | null;
}

/** Horário planejado de uma refeição. Refeição sem horário = não faz parte do plano. */
export interface Horario {
  pessoa_id: number;
  tipo: TipoRefeicao;
  hora: string; // HH:MM
}

export interface Refeicao {
  id: number;
  pessoa_id: number;
  dia: string; // AAAA-MM-DD, no horário de Brasília
  hora: string; // HH:MM
  tipo: TipoRefeicao;
  descricao: string;
  kcal: number | null;
  obs: string | null;
  criado_em: string;
}

export interface Agua {
  id: number;
  pessoa_id: number;
  dia: string;
  hora: string;
  ml: number;
  criado_em: string;
}
