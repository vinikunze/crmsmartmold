// Saudação e a frase do topo da tela Hoje: a coisa mais útil de dizer agora.

import type { ItemLinha } from './resumo';
import { formatarMl } from './resumo';
import { minutos } from './datas';
import { nomeDaRefeicao } from './tipos';

export function saudacao(hora: string): string {
  const m = minutos(hora);
  if (m >= minutos('05:00') && m < minutos('12:00')) return 'Bom dia';
  if (m >= minutos('12:00') && m < minutos('18:00')) return 'Boa tarde';
  return 'Boa noite';
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Uma frase sobre o dia de hoje, nesta ordem de importância:
 * refeição atrasada, água atrás do ritmo, próxima refeição, meta batida,
 * quanto falta de água.
 */
export function fraseDoMomento(o: {
  linha: ItemLinha[];
  agora: string;
  tomado: number;
  meta: number;
  /** Diferença para o ritmo (negativo = atrás), ou null se não for hoje. */
  ritmo: number | null;
  copo: number;
}): string {
  const atrasadas = o.linha.filter((l) => l.estado === 'atrasada');
  if (atrasadas.length) {
    const l = atrasadas[atrasadas.length - 1];
    const nome = nomeDaRefeicao(l.tipo);
    return `${l.tipo === 'ceia' ? 'A' : 'O'} ${minuscula(nome)} passou do horário. Já ${l.tipo === 'cafe' ? 'tomou' : 'comeu'}?`;
  }
  if (o.ritmo !== null && o.tomado < o.meta && -o.ritmo >= o.copo) {
    const copos = Math.ceil(-o.ritmo / o.copo);
    return `${copos} ${copos === 1 ? 'copo' : 'copos'} de água para entrar no ritmo.`;
  }
  const proxima = o.linha.find((l) => l.estado === 'proxima');
  if (proxima?.previsto) {
    const falta = minutos(proxima.previsto) - minutos(o.agora);
    const nome = nomeDaRefeicao(proxima.tipo);
    if (falta <= 0) return `Hora ${proxima.tipo === 'ceia' ? 'da' : 'do'} ${minuscula(nome)}.`;
    if (falta <= 60) return `${nome} daqui a ${falta} min.`;
  }
  if (o.tomado >= o.meta) return 'Meta de água batida hoje. 💧';
  if (proxima?.previsto) return `Próxima refeição: ${minuscula(nomeDaRefeicao(proxima.tipo))} às ${proxima.previsto}.`;
  if (o.tomado < o.meta) return `Faltam ${formatarMl(o.meta - o.tomado)} para a meta de água.`;
  return 'Tudo em dia por hoje. ✨';
}
