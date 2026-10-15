import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarPorRegras, metragem } from '../src/criteria.ts';
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

test('metragem converte faixas, texto livre e quantidade de blocos', () => {
  assert.equal(metragem('Até 50 m²'), 50);
  assert.equal(metragem('200 a 1.000 m²'), 1000);
  assert.ok(metragem('Acima de 1.000 m²')! > 1000);
  assert.equal(metragem('5000 blocos'), 400);
  assert.equal(metragem('uns 3 mil m2'), 3000);
  assert.equal(metragem('não sei'), null);
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
