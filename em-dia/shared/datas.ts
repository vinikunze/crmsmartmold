// Dias e horas. O "dia" é sempre o do horário de Brasília, em texto
// AAAA-MM-DD: quem toma água às 23h50 não pode ver o copo cair no dia
// seguinte por causa do fuso UTC do servidor.

export const FUSO = 'America/Sao_Paulo';

const partes = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour')}:${v('minute')}` };
};

/** Dia de hoje em Brasília (AAAA-MM-DD). */
export const hoje = (agora = new Date()) => partes(agora).dia;

/** Hora agora em Brasília (HH:MM). */
export const horaAgora = (agora = new Date()) => partes(agora).hora;

export function diaValido(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function horaValida(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** "2026-11-30" + 1 = "2026-12-01". Conta em UTC ao meio-dia: sem surpresa de horário de verão. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias entre a e b (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** "07:30" → 450. */
export const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/** "Hoje", "Ontem", "Amanhã" ou "sáb., 7 de nov.". */
export function nomeDoDia(dia: string, referencia: string): string {
  const dif = diasEntre(referencia, dia);
  if (dif === 0) return 'Hoje';
  if (dif === -1) return 'Ontem';
  if (dif === 1) return 'Amanhã';
  const t = new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "seg." / "ter."… para o eixo do gráfico. */
export const diaDaSemana = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

/** "7/11". */
export const diaCurto = (dia: string) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`;

/** "segunda-feira, 9 de novembro". */
export const dataLonga = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
