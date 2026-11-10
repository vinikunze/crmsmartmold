import { describe, expect, it } from 'vitest';
import { hoje, horaAgora, diaValido, horaValida, somarDias, diasEntre, nomeDoDia, minutos } from '../shared/datas';
import {
  formatarMl as formatarMlReal, aguaDoDia, porcentagem, ritmoAgua, sugerirMeta, linhaDoTempo, kcalDoDia, historico, sequenciaAgua,
} from '../shared/resumo';
import { tipoPelaHora, maisComidos } from '../shared/sugestoes';
import { normalizar } from '../shared/texto';
import { saudacao, fraseDoMomento } from '../shared/momento';
import type { Agua, Horario, Pessoa, Refeicao } from '../shared/tipos';

let n = 0;
const refeicao = (p: Partial<Refeicao> = {}): Refeicao => ({
  id: ++n, pessoa_id: 1, dia: '2026-11-09', hora: '12:00', tipo: 'almoco', descricao: 'Arroz e feijão',
  kcal: null, obs: null, criado_em: '2026-11-09T15:00:00Z', ...p,
});
const agua = (p: Partial<Agua> = {}): Agua => ({
  id: ++n, pessoa_id: 1, dia: '2026-11-09', hora: '10:00', ml: 250, criado_em: '2026-11-09T13:00:00Z', ...p,
});
const vini: Pessoa = { id: 1, email: 'v@x.com', nome: 'Vini', meta_agua_ml: 2000, copo_ml: 250, garrafa_ml: 500, meta_kcal: null, peso_g: null };
const plano: Horario[] = [
  { pessoa_id: 1, tipo: 'cafe', hora: '07:30' },
  { pessoa_id: 1, tipo: 'almoco', hora: '12:00' },
  { pessoa_id: 1, tipo: 'lanche_tarde', hora: '16:00' },
  { pessoa_id: 1, tipo: 'jantar', hora: '20:00' },
  { pessoa_id: 2, tipo: 'almoco', hora: '13:00' },
];

describe('datas', () => {
  it('dia e hora são os de Brasília, não os de UTC', () => {
    // 02:30 UTC do dia 10 = 23:30 do dia 9 em Brasília
    const d = new Date('2026-11-10T02:30:00Z');
    expect(hoje(d)).toBe('2026-11-09');
    expect(horaAgora(d)).toBe('23:30');
    expect(horaAgora(new Date('2026-11-09T03:05:00Z'))).toBe('00:05');
  });

  it('valida dia e hora', () => {
    expect(diaValido('2026-11-09')).toBe(true);
    expect(diaValido('2026-02-30')).toBe(false);
    expect(diaValido('9/11/2026')).toBe(false);
    expect(horaValida('07:05')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('7:05')).toBe(false);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31');
    expect(diasEntre('2026-11-01', '2026-11-09')).toBe(8);
  });

  it('nome do dia', () => {
    expect(nomeDoDia('2026-11-09', '2026-11-09')).toBe('Hoje');
    expect(nomeDoDia('2026-11-08', '2026-11-09')).toBe('Ontem');
    expect(nomeDoDia('2026-11-07', '2026-11-09')).toMatch(/7/);
  });
});

describe('água', () => {
  it('formata ml e litros', () => {
    const formatarMl = (ml: number) => formatarMlReal(ml).replace('\u00a0', ' ');
    expect(formatarMl(0)).toBe('0 ml');
    expect(formatarMl(750)).toBe('750 ml');
    expect(formatarMl(1000)).toBe('1 L');
    expect(formatarMl(1250)).toBe('1,25 L');
    expect(formatarMl(2500)).toBe('2,5 L');
  });

  it('soma só a pessoa e o dia certos', () => {
    const lista = [agua({ ml: 300 }), agua({ ml: 500 }), agua({ pessoa_id: 2, ml: 999 }), agua({ dia: '2026-11-08', ml: 999 })];
    expect(aguaDoDia(lista, 1, '2026-11-09')).toBe(800);
  });

  it('porcentagem arredonda para baixo e passa de 100', () => {
    expect(porcentagem(1999, 2000)).toBe(99);
    expect(porcentagem(2500, 2000)).toBe(125);
    expect(porcentagem(100, 0)).toBe(0);
  });

  it('ritmo: das 7h às 22h, em passos de 50 ml', () => {
    expect(ritmoAgua(0, 2000, '06:00')).toEqual({ esperado: 0, diferenca: 0 });
    expect(ritmoAgua(500, 2000, '14:30')).toEqual({ esperado: 1000, diferenca: -500 }); // metade da janela
    expect(ritmoAgua(2100, 2000, '23:00')).toEqual({ esperado: 2000, diferenca: 100 });
  });

  it('sugestão de meta: 35 ml/kg com limites', () => {
    expect(sugerirMeta(70000)).toBe(2450);
    expect(sugerirMeta(30000)).toBe(1500);
    expect(sugerirMeta(200000)).toBe(4000);
  });
});

describe('linha do tempo', () => {
  it('mostra o plano e encaixa o que foi registrado; fora do plano entra pela hora', () => {
    const regs = [
      refeicao({ tipo: 'cafe', hora: '08:10' }),
      refeicao({ tipo: 'outro', hora: '10:00', descricao: 'Bolacha' }),
      refeicao({ tipo: 'almoco', hora: '12:40' }),
      refeicao({ pessoa_id: 2, tipo: 'almoco' }),
    ];
    const l = linhaDoTempo(plano, regs, 1, '2026-11-09', '2026-11-09', '13:00');
    expect(l.map((x) => [x.tipo, x.estado, x.hora])).toEqual([
      ['cafe', 'feita', '08:10'],
      ['outro', 'feita', '10:00'],
      ['almoco', 'feita', '12:40'],
      ['lanche_tarde', 'proxima', '16:00'],
      ['jantar', 'mais_tarde', '20:00'],
    ]);
    expect(l[0].previsto).toBe('07:30');
    expect(l[1].previsto).toBeNull();
  });

  it('passou de 1h do horário sem registrar = atrasada; dia passado = não registrada', () => {
    const hojeL = linhaDoTempo(plano, [], 1, '2026-11-09', '2026-11-09', '13:01');
    expect(hojeL.map((x) => x.estado)).toEqual(['atrasada', 'atrasada', 'proxima', 'mais_tarde']);
    const noLimite = linhaDoTempo(plano, [], 1, '2026-11-09', '2026-11-09', '13:00');
    expect(noLimite[1].estado).toBe('proxima');
    const ontem = linhaDoTempo(plano, [], 1, '2026-11-08', '2026-11-09', '09:00');
    expect(ontem.every((x) => x.estado === 'nao_registrada')).toBe(true);
  });

  it('duas refeições do mesmo tipo ficam juntas no mesmo horário do plano', () => {
    const l = linhaDoTempo(plano, [refeicao({ hora: '12:00' }), refeicao({ hora: '12:30', descricao: 'Sobremesa' })], 1, '2026-11-09', '2026-11-09', '13:00');
    const almoco = l.find((x) => x.tipo === 'almoco')!;
    expect(almoco.refeicoes.map((r) => r.descricao)).toEqual(['Arroz e feijão', 'Sobremesa']);
  });

  it('sem plano, só o que foi registrado', () => {
    const l = linhaDoTempo([], [refeicao({ tipo: 'jantar', hora: '19:00' })], 1, '2026-11-09', '2026-11-09', '20:00');
    expect(l).toHaveLength(1);
    expect(l[0].previsto).toBeNull();
  });

  it('calorias somam só as refeições que têm', () => {
    expect(kcalDoDia([refeicao({ kcal: 500 }), refeicao({ kcal: 250 }), refeicao()], 1, '2026-11-09')).toEqual({ total: 750, registradas: 2 });
  });
});

describe('histórico', () => {
  it('um resumo por dia, inclusive dias vazios', () => {
    const h = historico(vini, plano, [refeicao({ dia: '2026-11-08', tipo: 'cafe' }), refeicao({ dia: '2026-11-08', tipo: 'outro' })],
      [agua({ dia: '2026-11-08', ml: 2000 }), agua({ dia: '2026-11-09', ml: 500 })], '2026-11-07', '2026-11-09');
    expect(h.map((d) => d.dia)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09']);
    expect(h[1]).toMatchObject({ agua_ml: 2000, bateu_agua: true, refeicoes: 2, do_plano: 1, plano: 4 });
    expect(h[0]).toMatchObject({ agua_ml: 0, bateu_agua: false, refeicoes: 0 });
  });

  it('sequência não zera enquanto hoje está em andamento', () => {
    const dias = (bateu: boolean[]) =>
      bateu.map((b, i) => ({ dia: somarDias('2026-11-05', i), agua_ml: 0, bateu_agua: b, refeicoes: 0, do_plano: 0, plano: 0, kcal: null }));
    // 05 06 07 08 09(hoje)
    expect(sequenciaAgua(dias([true, false, true, true, false]), '2026-11-09')).toBe(2);
    expect(sequenciaAgua(dias([true, false, true, true, true]), '2026-11-09')).toBe(3);
    expect(sequenciaAgua(dias([true, true, true, false, false]), '2026-11-09')).toBe(0);
  });
});

describe('sugestões', () => {
  it('refeição pela hora: plano mais perto (até 1h30), senão faixa do dia', () => {
    expect(tipoPelaHora('12:50', plano.filter((h) => h.pessoa_id === 1))).toBe('almoco');
    expect(tipoPelaHora('17:20', plano.filter((h) => h.pessoa_id === 1))).toBe('lanche_tarde');
    expect(tipoPelaHora('10:00', [])).toBe('cafe');
    expect(tipoPelaHora('11:00', [])).toBe('lanche_manha');
    expect(tipoPelaHora('23:30', [])).toBe('ceia');
    expect(minutos('23:30')).toBe(1410);
  });

  it('mais comidos: sem repetir, mais frequente primeiro, escrita mais recente', () => {
    const regs = [
      refeicao({ tipo: 'cafe', descricao: 'pao com ovo', dia: '2026-11-01' }),
      refeicao({ tipo: 'cafe', descricao: 'Pão com ovo', dia: '2026-11-05' }),
      refeicao({ tipo: 'cafe', descricao: 'Tapioca', dia: '2026-11-08' }),
      refeicao({ tipo: 'almoco', descricao: 'Lasanha' }),
      refeicao({ pessoa_id: 2, tipo: 'cafe', descricao: 'Iogurte' }),
    ];
    expect(maisComidos(regs, 1, 'cafe')).toEqual(['Pão com ovo', 'Tapioca']);
    expect(normalizar('  Pão   COM ovo ')).toBe('pao com ovo');
  });
});

describe('saudação e frase do momento', () => {
  it('bom dia, boa tarde, boa noite', () => {
    expect(saudacao('05:00')).toBe('Bom dia');
    expect(saudacao('11:59')).toBe('Bom dia');
    expect(saudacao('12:00')).toBe('Boa tarde');
    expect(saudacao('18:00')).toBe('Boa noite');
    expect(saudacao('02:00')).toBe('Boa noite');
  });

  const base = { tomado: 1000, meta: 2000, ritmo: 0, copo: 250 };
  const linhaAs = (agora: string, regs: Refeicao[] = []) =>
    linhaDoTempo(plano, regs, 1, '2026-11-09', '2026-11-09', agora);

  it('refeição atrasada vem primeiro', () => {
    expect(fraseDoMomento({ ...base, linha: linhaAs('09:00'), agora: '09:00', ritmo: -800 }))
      .toBe('O café da manhã passou do horário. Já tomou?');
  });

  it('depois, água atrás do ritmo em copos', () => {
    const regs = [refeicao({ tipo: 'cafe', hora: '07:40' })];
    expect(fraseDoMomento({ ...base, linha: linhaAs('10:00', regs), agora: '10:00', ritmo: -600 }))
      .toBe('3 copos de água para entrar no ritmo.');
  });

  it('próxima refeição em até 1 hora', () => {
    const regs = [refeicao({ tipo: 'cafe', hora: '07:40' })];
    expect(fraseDoMomento({ ...base, linha: linhaAs('11:20', regs), agora: '11:20' })).toBe('Almoço daqui a 40 min.');
    expect(fraseDoMomento({ ...base, linha: linhaAs('12:10', regs), agora: '12:10' })).toBe('Hora do almoço.');
  });

  it('meta batida, depois próxima refeição distante, depois quanto falta', () => {
    const regs = [refeicao({ tipo: 'cafe', hora: '07:40' })];
    expect(fraseDoMomento({ ...base, tomado: 2000, linha: linhaAs('09:00', regs), agora: '09:00' })).toBe('Meta de água batida hoje. 💧');
    expect(fraseDoMomento({ ...base, linha: linhaAs('09:00', regs), agora: '09:00' })).toBe('Próxima refeição: almoço às 12:00.');
    expect(fraseDoMomento({ ...base, linha: [], agora: '09:00' })).toBe('Faltam 1 L para a meta de água.');
  });
});
