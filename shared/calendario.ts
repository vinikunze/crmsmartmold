// Calendário de gotinhas do Histórico: o mês em semanas (domingo primeiro,
// como no calendário brasileiro), quanto cada gota enche e o recorde de
// dias seguidos batendo a água.

import type { ResumoDia } from './resumo';
import { somarDias } from './datas';

/** "2026-11-09" → "2026-11". */
export const mesDe = (dia: string) => dia.slice(0, 7);

/** "2026-11" + 1 = "2026-12"; "2026-01" − 1 = "2025-12". */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** "novembro de 2026". */
export const nomeDoMes = (mes: string) =>
  new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Semanas do mês, de domingo a sábado. Dias de fora do mês são null. */
export function semanasDoMes(mes: string): (string | null)[][] {
  const primeiro = `${mes}-01`;
  const diaDaSemana = new Date(`${primeiro}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const semanas: (string | null)[][] = [];
  let semana: (string | null)[] = Array(diaDaSemana).fill(null);
  for (let d = primeiro; mesDe(d) === mes; d = somarDias(d, 1)) {
    semana.push(d);
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length) semanas.push([...semana, ...Array(7 - semana.length).fill(null)]);
  return semanas;
}

export type NivelGota = 'cheia' | 'metade' | 'pouca' | 'vazia';

/** Cheia = bateu a meta; metade = 50% ou mais; pouca = alguma água; vazia = nada. */
export function nivelGota(ml: number, meta: number): NivelGota {
  if (ml >= meta) return 'cheia';
  if (ml >= meta / 2) return 'metade';
  if (ml > 0) return 'pouca';
  return 'vazia';
}

/** Maior sequência de dias seguidos batendo a meta de água. */
export function recordeAgua(dias: ResumoDia[]): number {
  const bateu = new Set(dias.filter((d) => d.bateu_agua).map((d) => d.dia));
  let recorde = 0;
  for (const d of bateu) {
    if (bateu.has(somarDias(d, -1))) continue; // não é o começo de uma sequência
    let n = 0;
    for (let x = d; bateu.has(x); x = somarDias(x, 1)) n++;
    recorde = Math.max(recorde, n);
  }
  return recorde;
}
