// Tema claro ou escuro. "Automático" segue o celular e muda junto com ele
// (por exemplo, quando o modo escuro liga sozinho à noite).
// O index.html já aplica o tema antes de desenhar a página; aqui ficam as
// mudanças depois disso e a escolha feita em Ajustes.

export type EscolhaTema = 'auto' | 'claro' | 'escuro';

const CHAVE = 'emdia:tema';
const COR_BARRA = { claro: '#F5F7F2', escuro: '#0D1526' } as const;
const escuroNoCelular = window.matchMedia('(prefers-color-scheme: dark)');

export function escolhaAtual(): EscolhaTema {
  const e = localStorage.getItem(CHAVE);
  return e === 'claro' || e === 'escuro' ? e : 'auto';
}

export function aplicarTema(escolha: EscolhaTema = escolhaAtual()) {
  const tema = escolha === 'auto' ? (escuroNoCelular.matches ? 'escuro' : 'claro') : escolha;
  document.documentElement.dataset.tema = tema;
  // Cor da barra do navegador / do celular com o app instalado.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema]);
}

export function escolherTema(escolha: EscolhaTema) {
  if (escolha === 'auto') localStorage.removeItem(CHAVE);
  else localStorage.setItem(CHAVE, escolha);
  aplicarTema(escolha);
}

escuroNoCelular.addEventListener('change', () => aplicarTema());
