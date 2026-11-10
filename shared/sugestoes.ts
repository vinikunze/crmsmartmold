// Atalhos para lançar rápido: qual refeição é pela hora, e o que a pessoa
// costuma comer nela (para repetir com um toque).

import type { Horario, Refeicao, TipoRefeicao } from './tipos';
import { SEM_DETALHES } from './tipos';
import { minutos } from './datas';
import { normalizar } from './texto';

/** Até quantos minutos do horário do plano a refeição "é" aquela. */
const PERTO_MIN = 90;

/**
 * Refeição mais provável para a hora: a do plano com horário mais perto
 * (até 1h30 de diferença); fora disso, pela faixa do dia.
 */
export function tipoPelaHora(hora: string, plano: Pick<Horario, 'tipo' | 'hora'>[]): TipoRefeicao {
  const m = minutos(hora);
  let melhor: { tipo: TipoRefeicao; dif: number } | null = null;
  for (const h of plano) {
    const dif = Math.abs(minutos(h.hora) - m);
    if (dif <= PERTO_MIN && (!melhor || dif < melhor.dif)) melhor = { tipo: h.tipo, dif };
  }
  if (melhor) return melhor.tipo;
  if (m < minutos('10:30')) return 'cafe';
  if (m < minutos('11:30')) return 'lanche_manha';
  if (m < minutos('14:30')) return 'almoco';
  if (m < minutos('18:30')) return 'lanche_tarde';
  if (m < minutos('21:30')) return 'jantar';
  return 'ceia';
}

/**
 * O que a pessoa mais comeu naquela refeição (sem repetir, ignorando
 * maiúsculas e acentos), do mais frequente para o menos; empate, o mais recente.
 */
export function maisComidos(refeicoes: Refeicao[], pessoaId: number, tipo: TipoRefeicao, max = 6): string[] {
  const contagem = new Map<string, { texto: string; n: number; ultimo: string }>();
  for (const r of refeicoes) {
    if (r.pessoa_id !== pessoaId || r.tipo !== tipo || r.descricao === SEM_DETALHES) continue;
    const k = normalizar(r.descricao);
    const quando = `${r.dia} ${r.hora}`;
    const c = contagem.get(k);
    if (!c) contagem.set(k, { texto: r.descricao, n: 1, ultimo: quando });
    else {
      c.n++;
      if (quando > c.ultimo) {
        c.ultimo = quando;
        c.texto = r.descricao; // mostra do jeito que foi escrito por último
      }
    }
  }
  return [...contagem.values()]
    .sort((a, b) => b.n - a.n || b.ultimo.localeCompare(a.ultimo))
    .slice(0, max)
    .map((c) => c.texto);
}

/** "O de sempre" daquela refeição, para registrar com um toque. null = nunca registrou com detalhes. */
export const oDeSempre = (refeicoes: Refeicao[], pessoaId: number, tipo: TipoRefeicao): string | null =>
  maisComidos(refeicoes, pessoaId, tipo, 1)[0] ?? null;
