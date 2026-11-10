// Roteiro de verificações da API contra o servidor local.
// Uso: com `npm run dev` rodando e o banco local recém-criado:
//   node scripts/testar-api.mjs
// Cria dados de teste no banco LOCAL (.wrangler/). Nunca rode contra o remoto.

const BASE = process.env.BASE ?? 'http://localhost:5173';
let ok = 0, falhou = 0;

async function pedir(metodo, caminho, corpo, cabecalhos = {}) {
  const r = await fetch(`${BASE}/api/${caminho}`, {
    method: metodo,
    headers: { ...(corpo === undefined ? {} : { 'content-type': 'application/json' }), ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return { status: r.status, dados: await r.json().catch(() => null) };
}

function conferir(nome, condicao, detalhe) {
  if (condicao) { ok++; console.log(`  ok  ${nome}`); }
  else { falhou++; console.log(`FALHOU ${nome}`, detalhe ?? ''); }
}

const chave = () => crypto.randomUUID();
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somar = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Login (simulado pelo wrangler.jsonc como o Vini)
const eu = await pedir('GET', 'eu');
conferir('eu: e-mail do login e pessoa', eu.dados?.email === 'vinihkunze@gmail.com' && eu.dados?.pessoa_id > 0, eu);

const { dados: inicial } = await pedir('GET', 'dados');
const [vini, sophia] = inicial.pessoas;
conferir('duas pessoas, Vini e Sophia', inicial.pessoas.length === 2 && vini.nome === 'Vini' && sophia.nome === 'Sophia', inicial.pessoas);
conferir('plano inicial com 4 refeições para cada', inicial.horarios.filter((h) => h.pessoa_id === vini.id).length === 4, inicial.horarios);

// Água
const k = chave();
const copo = await pedir('POST', 'agua', { chave: k, pessoa_id: vini.id, dia: hoje, hora: '09:15', ml: 250 });
conferir('registra água (201)', copo.status === 201 && copo.dados?.ml === 250, copo);
const repetido = await pedir('POST', 'agua', { chave: k, pessoa_id: vini.id, dia: hoje, hora: '09:15', ml: 250 });
conferir('mesma chave não duplica a água', repetido.status === 200 && repetido.dados?.id === copo.dados.id, repetido);
const daSophia = await pedir('POST', 'agua', { chave: chave(), pessoa_id: sophia.id, dia: hoje, hora: '10:00', ml: 500 });
conferir('lança água para a outra pessoa', daSophia.status === 201 && daSophia.dados.pessoa_id === sophia.id, daSophia);

for (const [nome, corpo] of [
  ['água zero', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '10:00', ml: 0 }],
  ['água 5 L de uma vez', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '10:00', ml: 5000 }],
  ['água quebrada', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '10:00', ml: 250.5 }],
  ['hora 25:00', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '25:00', ml: 250 }],
  ['dia 30/02', { chave: chave(), pessoa_id: vini.id, dia: '2026-02-30', hora: '10:00', ml: 250 }],
  ['dia daqui a uma semana', { chave: chave(), pessoa_id: vini.id, dia: somar(hoje, 7), hora: '10:00', ml: 250 }],
  ['pessoa inexistente', { chave: chave(), pessoa_id: 999, dia: hoje, hora: '10:00', ml: 250 }],
]) {
  const r = await pedir('POST', 'agua', corpo);
  conferir(`recusa ${nome} (400)`, r.status === 400 && typeof r.dados?.erro === 'string', r);
}

const apagar = await pedir('DELETE', `agua/${daSophia.dados.id}`);
conferir('apaga água', apagar.status === 200, apagar);

// Refeições
const kr = chave();
const almoco = await pedir('POST', 'refeicoes', {
  chave: kr, pessoa_id: vini.id, dia: hoje, hora: '12:30', tipo: 'almoco', descricao: '  Arroz,   feijão e frango ', kcal: 650, obs: '',
});
conferir('registra refeição (201)', almoco.status === 201, almoco);
conferir('limpa espaços da descrição', almoco.dados?.descricao === 'Arroz, feijão e frango', almoco.dados?.descricao);
conferir('observação vazia vira null', almoco.dados?.obs === null, almoco.dados);
const almoco2 = await pedir('POST', 'refeicoes', { chave: kr, pessoa_id: vini.id, dia: hoje, hora: '12:30', tipo: 'almoco', descricao: 'Outra coisa' });
conferir('mesma chave não duplica a refeição', almoco2.dados?.id === almoco.dados.id && almoco2.dados.descricao === 'Arroz, feijão e frango', almoco2);

for (const [nome, corpo] of [
  ['sem descrição', { tipo: 'almoco', descricao: '   ' }],
  ['tipo inventado', { tipo: 'brunch', descricao: 'x' }],
  ['kcal negativa', { tipo: 'almoco', descricao: 'x', kcal: -5 }],
  ['descrição gigante', { tipo: 'almoco', descricao: 'x'.repeat(301) }],
]) {
  const r = await pedir('POST', 'refeicoes', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '12:00', ...corpo });
  conferir(`recusa refeição ${nome} (400)`, r.status === 400, r);
}

const editada = await pedir('PUT', `refeicoes/${almoco.dados.id}`, { dia: hoje, hora: '13:00', tipo: 'almoco', descricao: 'Arroz, feijão, frango e salada', kcal: null, obs: 'com pressa' });
conferir('edita refeição', editada.status === 200 && editada.dados.hora === '13:00' && editada.dados.kcal === null && editada.dados.obs === 'com pressa', editada);
const naoExiste = await pedir('PUT', 'refeicoes/99999', { dia: hoje, hora: '13:00', tipo: 'almoco', descricao: 'x' });
conferir('editar refeição que não existe = 404', naoExiste.status === 404, naoExiste);

const ontem = somar(hoje, -1);
await pedir('POST', 'refeicoes', { chave: chave(), pessoa_id: sophia.id, dia: ontem, hora: '20:00', tipo: 'jantar', descricao: 'Sopa' });
const periodo = await pedir('GET', `dados?de=${ontem}&ate=${ontem}`);
conferir('lê só o período pedido', periodo.dados?.refeicoes.length >= 1 && periodo.dados.refeicoes.every((r) => r.dia === ontem), periodo.dados?.refeicoes);
const longo = await pedir('GET', `dados?de=2026-01-01&ate=${hoje}`);
conferir('recusa período longo demais (400)', longo.status === 400, longo);

// Pessoas e plano
const metas = await pedir('PATCH', `pessoas/${sophia.id}`, { meta_agua_ml: 2500, peso_g: 62000, meta_kcal: 1800 });
conferir('edita metas', metas.dados?.meta_agua_ml === 2500 && metas.dados.peso_g === 62000 && metas.dados.meta_kcal === 1800 && metas.dados.nome === 'Sophia', metas);
const semKcal = await pedir('PATCH', `pessoas/${sophia.id}`, { meta_kcal: null });
conferir('tira meta de calorias sem mexer no resto', semKcal.dados?.meta_kcal === null && semKcal.dados.meta_agua_ml === 2500, semKcal);
const metaRuim = await pedir('PATCH', `pessoas/${sophia.id}`, { meta_agua_ml: 100 });
conferir('recusa meta de água absurda (400)', metaRuim.status === 400, metaRuim);

const garrafa = await pedir('PATCH', `pessoas/${sophia.id}`, { recipiente: 'copo', cor: 'roxo' });
conferir('escolhe a garrafa e a cor', garrafa.dados?.recipiente === 'copo' && garrafa.dados.cor === 'roxo' && garrafa.dados.meta_agua_ml === 2500, garrafa);
conferir('padrões: Vini garrafa azul, Sophia começa rosa', vini.recipiente === 'garrafa' && vini.cor === 'azul' && sophia.cor === 'rosa', [vini, sophia]);
const garrafaRuim = await pedir('PATCH', `pessoas/${sophia.id}`, { recipiente: 'balde' });
const corRuim = await pedir('PATCH', `pessoas/${sophia.id}`, { cor: '#ff0000' });
conferir('recusa garrafa e cor inventadas (400)', garrafaRuim.status === 400 && corRuim.status === 400, [garrafaRuim, corRuim]);

const novoPlano = await pedir('PUT', `pessoas/${sophia.id}/horarios`, { horarios: [{ tipo: 'cafe', hora: '08:00' }, { tipo: 'ceia', hora: '22:30' }] });
conferir('troca o plano inteiro', novoPlano.status === 200 && novoPlano.dados.length === 2 && novoPlano.dados[1].tipo === 'ceia', novoPlano);
const repetida = await pedir('PUT', `pessoas/${sophia.id}/horarios`, { horarios: [{ tipo: 'cafe', hora: '08:00' }, { tipo: 'cafe', hora: '09:00' }] });
conferir('recusa refeição repetida no plano', repetida.status === 400, repetida);
const outro = await pedir('PUT', `pessoas/${sophia.id}/horarios`, { horarios: [{ tipo: 'outro', hora: '08:00' }] });
conferir('recusa "outro" no plano', outro.status === 400, outro);
const { dados: depois } = await pedir('GET', 'dados');
conferir('plano do Vini não mudou', depois.horarios.filter((h) => h.pessoa_id === vini.id).length === 4, depois.horarios);

// Segurança
const csrf = await pedir('POST', 'agua', { chave: chave(), pessoa_id: vini.id, dia: hoje, hora: '10:00', ml: 250 }, { origin: 'https://site-malicioso.com' });
conferir('recusa outra origem (CSRF)', csrf.status === 403, csrf);
const rota = await pedir('GET', 'nada');
conferir('rota desconhecida = 404', rota.status === 404, rota);

const ra = await pedir('DELETE', `refeicoes/${almoco.dados.id}`);
conferir('apaga refeição', ra.status === 200, ra);

console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
