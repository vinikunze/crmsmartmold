// Lembretes no calendário do celular: um arquivo .ics com eventos que se
// repetem todo dia, cada um com o aviso já posto (VALARM). É o jeito de ter
// "hora do almoço" e "hora da água" sem notificação própria (que precisaria
// de service worker, e ele briga com o login do Access).
// Mesmo molde do app de finanças (assessor-do-casal/app/shared/agenda.ts).

import type { Horario, Pessoa } from './tipos';
import { nomeDaRefeicao } from './tipos';
import { formatarMl } from './resumo';
import { hoje, minutos } from './datas';

/** Intervalos oferecidos para a água, em minutos. 0 = sem lembrete de água. */
export const INTERVALOS_AGUA = [0, 60, 120, 180] as const;
/** Os lembretes de água vão das 8h às 20h. */
export const AGUA_DE = '08:00';
export const AGUA_ATE = '20:00';

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Horários dos lembretes de água: de 8h às 20h, de `intervalo` em `intervalo` minutos. */
export function horariosDeAgua(intervalo: number): string[] {
  if (!intervalo || intervalo < 30) return [];
  const lista: string[] = [];
  for (let m = minutos(AGUA_DE); m <= minutos(AGUA_ATE); m += intervalo) lista.push(hhmm(m));
  return lista;
}

/** Escapa texto para o .ics (vírgula, ponto e vírgula, barra, quebra de linha). */
export function escaparIcs(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Quebra linhas em 75 bytes, como manda a norma (acento e emoji contam mais de um byte). */
export function dobrarLinha(linha: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let atual = '';
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74; // continuação começa com espaço
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual);
      atual = ch;
    } else {
      atual += ch;
    }
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

const carimbo = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Brasília não tem horário de verão desde 2019: é sempre UTC−3. O .ics vai em UTC. */
function utc(dia: string, hora: string, maisMinutos = 0): string {
  const d = new Date(`${dia}T${hora}:00-03:00`);
  d.setUTCMinutes(d.getUTCMinutes() + maisMinutos);
  return carimbo(d);
}

interface Lembrete {
  /** Sempre o mesmo para o mesmo lembrete: adicionar de novo atualiza em vez de duplicar. */
  uid: string;
  hora: string;
  titulo: string;
  descricao: string;
  duracaoMin: number;
}

export function lembretesDe(pessoa: Pessoa, plano: Pick<Horario, 'tipo' | 'hora'>[], opcoes: { refeicoes: boolean; agua: number }): Lembrete[] {
  const lista: Lembrete[] = [];
  if (opcoes.refeicoes) {
    for (const h of [...plano].sort((a, b) => a.hora.localeCompare(b.hora))) {
      const nome = nomeDaRefeicao(h.tipo);
      lista.push({
        uid: `refeicao-${pessoa.id}-${h.tipo}@emdia`,
        hora: h.hora,
        titulo: `🍽️ ${nome}`,
        descricao: `Hora ${h.tipo === 'ceia' ? 'da' : 'do'} ${nome.toLowerCase()}. Depois é só registrar no em dia.`,
        duracaoMin: 30,
      });
    }
  }
  for (const hora of horariosDeAgua(opcoes.agua)) {
    lista.push({
      uid: `agua-${pessoa.id}-${hora.replace(':', '')}@emdia`,
      hora,
      titulo: '💧 Hora da água',
      descricao: `Meta de hoje: ${formatarMl(pessoa.meta_agua_ml).replace('\u00a0', ' ')}. Um copo agora mantém o ritmo.`,
      duracaoMin: 10,
    });
  }
  return lista;
}

/** O arquivo .ics com os lembretes da pessoa, repetindo todo dia a partir de hoje. */
export function calendarioDeLembretes(
  pessoa: Pessoa, plano: Pick<Horario, 'tipo' | 'hora'>[], opcoes: { refeicoes: boolean; agua: number; link?: string }, agora = new Date(),
): string {
  const dia = hoje(agora);
  const l: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//em dia//Lembretes//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:em dia.'];
  for (const e of lembretesDe(pessoa, plano, opcoes)) {
    l.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${carimbo(agora)}`,
      // Número que só cresce: o calendário aceita a versão nova por cima da antiga.
      `SEQUENCE:${Math.floor(agora.getTime() / 60000)}`,
      `DTSTART:${utc(dia, e.hora)}`,
      `DTEND:${utc(dia, e.hora, e.duracaoMin)}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escaparIcs(e.titulo)}`,
      `DESCRIPTION:${escaparIcs(e.descricao)}`,
      ...(opcoes.link ? [`URL:${opcoes.link}`] : []),
      // Não marca a pessoa como "ocupada" na agenda.
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparIcs(e.titulo)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  l.push('END:VCALENDAR');
  return l.map(dobrarLinha).join('\r\n') + '\r\n';
}
