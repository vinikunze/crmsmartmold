import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarPorRegras, quantidadeBlocos } from '../src/criteria.ts';
import { aplicarMapeamento, etapaPorRegras, listarCaminhos, normalizarFormulario } from '../src/mapping.ts';

test('construtora com obra grande, compra imediata e na região é Lead A', () => {
  const r = classificarPorRegras({ perfil: 'Construtora / empreiteira', volume: 'Acima de 1.000 m²', prazo: 'Imediato', cidade: 'Paracatu' });
  assert.equal(r.categoria, 'A');
  assert.equal(r.score, 100);
});

test('pessoa física com obra média em 30 dias na região é Lead B', () => {
  const r = classificarPorRegras({ perfil: 'Pessoa física (obra própria)', volume: '50 a 200 m²', prazo: 'Em até 30 dias', cidade: 'João Pinheiro' });
  assert.equal(r.categoria, 'B');
  assert.equal(r.score, 55);
});

test('curioso com obra pequena fora da região é Lead C', () => {
  const r = classificarPorRegras({ perfil: 'Pessoa física', volume: 'Até 50 m²', prazo: 'Apenas pesquisando', cidade: 'Curitiba', uf: 'PR' });
  assert.equal(r.categoria, 'C');
});

test('cidade sem acento e com UF é reconhecida como região atendida', () => {
  const r = classificarPorRegras({ cidade: 'joao pinheiro - MG' });
  assert.match(r.motivo, /região atendida \(\+10\)/);
});

test('quantidade de blocos aceita as opções do formulário, texto livre e m² de parede', () => {
  assert.equal(quantidadeBlocos('Até 1.000 blocos'), 1000);
  assert.equal(quantidadeBlocos('3.000 a 10.000 blocos'), 10000);
  assert.ok(quantidadeBlocos('Acima de 10.000 blocos')! > 10000);
  assert.equal(quantidadeBlocos('uns 5 mil blocos'), 5000);
  assert.equal(quantidadeBlocos('300 m²'), 3750);
  assert.equal(quantidadeBlocos('80'), 1000);
  assert.equal(quantidadeBlocos('não sei'), null);
});

test('faixas de blocos pontuam de 5 a 40', () => {
  const pts = (v: string) => Number(classificarPorRegras({ volume: v }).motivo.match(/\(\+(\d+)\)/)![1]);
  assert.equal(pts('Até 1.000 blocos'), 5);
  assert.equal(pts('1.000 a 3.000 blocos'), 15);
  assert.equal(pts('3.000 a 10.000 blocos'), 30);
  assert.equal(pts('Acima de 10.000 blocos'), 40);
});

test('normaliza nomes de campo do Elementor e do formulário', () => {
  const { dados } = normalizarFormulario({
    'form_fields[name]': 'Maria',
    'form_fields[WhatsApp]': '(38) 99999-0000',
    'E-mail': 'MARIA@EXEMPLO.COM',
    'Cidade': 'Patos de Minas/MG',
    'Quantidade': '300 m²',
    website: '',
  });
  assert.equal(dados.nome, 'Maria');
  assert.equal(dados.telefone, '(38) 99999-0000');
  assert.equal(dados.email, 'maria@exemplo.com');
  assert.equal(dados.cidade, 'Patos de Minas');
  assert.equal(dados.uf, 'MG');
  assert.equal(dados.volume, '300 m²');
});

const hotmart = {
  event: 'PURCHASE_APPROVED',
  data: { buyer: { name: 'Ana', email: 'ana@x.com' }, purchase: { status: 'APPROVED' }, items: [{ sku: 'A1' }] },
};

test('mapeamento lê caminhos aninhados e listas', () => {
  const d = aplicarMapeamento(hotmart, { nome: 'data.buyer.name', email: 'data.buyer.email', produto: 'data.items[0].sku' });
  assert.deepEqual(d, { nome: 'Ana', email: 'ana@x.com', produto: 'A1' });
  assert.ok(listarCaminhos(hotmart).some((c) => c.caminho === 'data.items[0].sku'));
});

test('regras condicionais definem a etapa', () => {
  const regras = [{ campo: 'data.purchase.status', operador: 'igual' as const, valor: 'approved', etapa: 'ganho' }];
  assert.equal(etapaPorRegras(hotmart, regras, 'novo'), 'ganho');
  assert.equal(etapaPorRegras({ data: { purchase: { status: 'CANCELED' } } }, regras, 'novo'), 'novo');
});

test('reconhece os campos de um formulário instantâneo da Meta', () => {
  const { dados } = normalizarFormulario({
    full_name: 'Carlos Obras',
    phone_number: '+5538999998888',
    email: 'carlos@obras.com',
    city: 'Três Marias',
    'você_é?': 'Construtora / empreiteira',
    quantos_blocos_voce_precisa: '3.000 a 10.000 blocos',
    quando_pretende_comprar_os_blocos: 'Em até 30 dias',
  });
  assert.equal(dados.nome, 'Carlos Obras');
  assert.equal(dados.telefone, '+5538999998888');
  assert.equal(dados.cidade, 'Três Marias');
  assert.equal(dados.perfil, 'Construtora / empreiteira');
  assert.equal(dados.volume, '3.000 a 10.000 blocos');
  assert.equal(dados.prazo, 'Em até 30 dias');
  assert.equal(classificarPorRegras(dados).categoria, 'A');
});
