// Contas das telas: água do dia, ritmo, linha do tempo das refeições e
// histórico. Tudo calculado no aparelho a partir dos registros: para duas
// pessoas é instantâneo e não gasta cota do banco.

import type { Agua, Horario, Pessoa, Refeicao, TipoRefeicao } from './tipos';
import { REFEICOES } from './tipos';
import { minutos, somarDias, diasEntre } from './datas';

// ---------- água ----------

/** 750 → "750 ml"; 1250 → "1,25 L"; 2000 → "2 L". Espaço que não quebra: o número nunca fica longe da unidade. */
export function formatarMl(ml: number): string {
  if (ml < 1000) return `${ml}\u00a0ml`;
  const litros = (ml / 1000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  return `${litros}\u00a0L`;
}

export function aguaDoDia(agua: Agua[], pessoaId: number, dia: string): number {
  let t = 0;
  for (const a of agua) if (a.pessoa_id === pessoaId && a.dia === dia) t += a.ml;
  return t;
}

/** Porcentagem inteira da meta (pode passar de 100). Arredonda para baixo: 100% só quando bateu. */
export const porcentagem = (feito: number, meta: number) => (meta <= 0 ? 0 : Math.floor((feito / meta) * 100));

/** Janela em que a água "deveria" ir sendo tomada: das 7h às 22h. */
export const ACORDA = '07:00';
export const DORME = '22:00';

/**
 * Quanto já deveria ter tomado até agora, se fosse tomando aos pouquinhos
 * das 7h às 22h, e a diferença para o que tomou (positivo = adiantado).
 */
export function ritmoAgua(tomado: number, meta: number, hora: string): { esperado: number; diferenca: number } {
  const ini = minutos(ACORDA), fim = minutos(DORME), m = minutos(hora);
  const fracao = Math.min(1, Math.max(0, (m - ini) / (fim - ini)));
  // Arredonda em 50 ml: ninguém precisa saber que "faltam 37 ml".
  const esperado = Math.round((meta * fracao) / 50) * 50;
  return { esperado, diferenca: tomado - esperado };
}

/** Sugestão de meta: 35 ml por quilo, de 50 em 50 ml, entre 1,5 L e 4 L. */
export function sugerirMeta(peso_g: number): number {
  const ml = Math.round(((peso_g / 1000) * 35) / 50) * 50;
  return Math.min(4000, Math.max(1500, ml));
}

// ---------- refeições ----------

export type EstadoRefeicao = 'feita' | 'atrasada' | 'proxima' | 'mais_tarde' | 'nao_registrada';

export interface ItemLinha {
  tipo: TipoRefeicao;
  /** Horário do plano. null = refeição fora do plano. */
  previsto: string | null;
  refeicoes: Refeicao[];
  estado: EstadoRefeicao;
  /** Hora usada para ordenar: a da primeira refeição registrada, ou a prevista. */
  hora: string;
}

/** Depois de quantos minutos do horário a refeição conta como atrasada. */
export const TOLERANCIA_MIN = 60;

const ORDEM_TIPO = Object.fromEntries(REFEICOES.map((r, i) => [r.tipo, i])) as Record<TipoRefeicao, number>;

const porHora = (a: { hora: string }, b: { hora: string }) => a.hora.localeCompare(b.hora);

/**
 * O dia de uma pessoa: as refeições do plano (feitas ou não) e as que comeu
 * fora do plano, em ordem de horário.
 * `hojeDia`/`agora` decidem se uma refeição planejada que não foi registrada
 * está atrasada, é a próxima, é mais tarde ou ficou sem registro.
 */
export function linhaDoTempo(
  horarios: Horario[], refeicoes: Refeicao[], pessoaId: number, dia: string, hojeDia: string, agora: string,
): ItemLinha[] {
  const plano = horarios.filter((h) => h.pessoa_id === pessoaId);
  const doDia = refeicoes.filter((r) => r.pessoa_id === pessoaId && r.dia === dia).sort(porHora);
  const linhas: ItemLinha[] = [];

  for (const h of plano) {
    const feitas = doDia.filter((r) => r.tipo === h.tipo && r.tipo !== 'outro');
    linhas.push({
      tipo: h.tipo,
      previsto: h.hora,
      refeicoes: feitas,
      estado: feitas.length ? 'feita' : 'nao_registrada',
      hora: feitas[0]?.hora ?? h.hora,
    });
  }
  const planejados = new Set(plano.map((h) => h.tipo));
  for (const r of doDia) {
    if (planejados.has(r.tipo) && r.tipo !== 'outro') continue;
    linhas.push({ tipo: r.tipo, previsto: null, refeicoes: [r], estado: 'feita', hora: r.hora });
  }

  linhas.sort((a, b) => porHora(a, b) || ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]);

  // Refeições do plano ainda sem registro: o que dizer de cada uma.
  const dif = diasEntre(hojeDia, dia);
  let achouProxima = false;
  for (const l of linhas) {
    if (l.estado === 'feita' || l.previsto === null) continue;
    if (dif < 0) l.estado = 'nao_registrada';
    else if (dif > 0) l.estado = 'mais_tarde';
    else if (minutos(agora) > minutos(l.previsto) + TOLERANCIA_MIN) l.estado = 'atrasada';
    else if (!achouProxima) {
      l.estado = 'proxima';
      achouProxima = true;
    } else l.estado = 'mais_tarde';
  }
  return linhas;
}

export function kcalDoDia(refeicoes: Refeicao[], pessoaId: number, dia: string): { total: number; registradas: number } {
  let total = 0, registradas = 0;
  for (const r of refeicoes) {
    if (r.pessoa_id !== pessoaId || r.dia !== dia || r.kcal === null) continue;
    total += r.kcal;
    registradas++;
  }
  return { total, registradas };
}

// ---------- histórico ----------

export interface ResumoDia {
  dia: string;
  agua_ml: number;
  bateu_agua: boolean;
  refeicoes: number;
  /** Refeições do plano que foram registradas / total do plano. */
  do_plano: number;
  plano: number;
  kcal: number | null;
}

/** Um resumo por dia, de `de` até `ate` (inclusive), do mais antigo ao mais novo. */
export function historico(
  pessoa: Pessoa, horarios: Horario[], refeicoes: Refeicao[], agua: Agua[], de: string, ate: string,
): ResumoDia[] {
  const plano = new Set(horarios.filter((h) => h.pessoa_id === pessoa.id).map((h) => h.tipo));
  plano.delete('outro');
  const dias = new Map<string, ResumoDia>();
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    dias.set(d, { dia: d, agua_ml: 0, bateu_agua: false, refeicoes: 0, do_plano: 0, plano: plano.size, kcal: null });
  }
  for (const a of agua) {
    const r = a.pessoa_id === pessoa.id ? dias.get(a.dia) : undefined;
    if (r) r.agua_ml += a.ml;
  }
  const tiposFeitos = new Map<string, Set<TipoRefeicao>>();
  for (const f of refeicoes) {
    const r = f.pessoa_id === pessoa.id ? dias.get(f.dia) : undefined;
    if (!r) continue;
    r.refeicoes++;
    if (f.kcal !== null) r.kcal = (r.kcal ?? 0) + f.kcal;
    if (plano.has(f.tipo)) {
      const s = tiposFeitos.get(f.dia) ?? new Set();
      s.add(f.tipo);
      tiposFeitos.set(f.dia, s);
    }
  }
  for (const r of dias.values()) {
    r.bateu_agua = r.agua_ml >= pessoa.meta_agua_ml;
    r.do_plano = tiposFeitos.get(r.dia)?.size ?? 0;
  }
  return [...dias.values()];
}

/**
 * Dias seguidos batendo a meta de água, contando até hoje. Hoje ainda está
 * em andamento: se ainda não bateu, a sequência conta até ontem e não zera.
 */
export function sequenciaAgua(dias: ResumoDia[], hojeDia: string): number {
  const bateu = new Set(dias.filter((d) => d.bateu_agua).map((d) => d.dia));
  let d = bateu.has(hojeDia) ? hojeDia : somarDias(hojeDia, -1);
  let n = 0;
  while (bateu.has(d)) {
    n++;
    d = somarDias(d, -1);
  }
  return n;
}

// ---------- sequência do casal ----------

export interface SequenciaCasal {
  /** Dias seguidos em que TODOS bateram a própria meta de água (mesma regra de hoje em andamento). */
  dias: number;
  /** Quem ainda não bateu a meta hoje (ids). Vazio = hoje já conta. */
  faltam_hoje: number[];
}

export function sequenciaCasal(pessoas: Pessoa[], agua: Agua[], hojeDia: string): SequenciaCasal {
  if (pessoas.length === 0) return { dias: 0, faltam_hoje: [] };
  // ml por pessoa e dia
  const total = new Map<string, number>();
  for (const a of agua) {
    const k = `${a.pessoa_id}|${a.dia}`;
    total.set(k, (total.get(k) ?? 0) + a.ml);
  }
  const bateu = (p: Pessoa, dia: string) => (total.get(`${p.id}|${dia}`) ?? 0) >= p.meta_agua_ml;
  const todos = (dia: string) => pessoas.every((p) => bateu(p, dia));

  const faltam_hoje = pessoas.filter((p) => !bateu(p, hojeDia)).map((p) => p.id);
  let d = faltam_hoje.length === 0 ? hojeDia : somarDias(hojeDia, -1);
  let dias = 0;
  // Para no primeiro dia sem os dois; 400 é só uma trava de segurança.
  while (dias < 400 && todos(d)) {
    dias++;
    d = somarDias(d, -1);
  }
  return { dias, faltam_hoje };
}
