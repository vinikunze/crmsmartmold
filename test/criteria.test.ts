import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarPorRegras } from '../src/criteria.ts';
import { aplicarMapeamento, etapaPorRegras, listarCaminhos, normalizarFormulario } from '../src/mapping.ts';

test('cidade da região atendida é Lead A', () => {
  assert.equal(classificarPorRegras({ cidade: 'Paracatu' }).categoria, 'A');
  assert.equal(classificarPorRegras({ cidade: 'joao pinheiro - MG' }).categoria, 'A');
  assert.equal(classificarPorRegras({ cidade: 'Três Marias', uf: 'MG' }).categoria, 'A');
});

test('outra cidade de MG, ou sem estado, é Lead B', () => {
  assert.equal(classificarPorRegras({ cidade: 'Uberlândia', uf: 'MG' }).categoria, 'B');
  assert.equal(classificarPorRegras({ cidade: 'Belo Horizonte - MG' }).categoria, 'B');
  assert.equal(classificarPorRegras({ cidade: 'Uberlândia' }).categoria, 'B');
});

test('outro estado ou sem cidade é Lead C', () => {
  assert.equal(classificarPorRegras({ cidade: 'Curitiba', uf: 'PR' }).categoria, 'C');
  assert.equal(classificarPorRegras({ cidade: 'Goiânia - GO' }).categoria, 'C');
  assert.equal(classificarPorRegras({}).categoria, 'C');
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
