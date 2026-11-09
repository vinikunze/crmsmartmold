// Comparação de texto sem ligar para maiúsculas, acentos e espaços.

/** "Pão  com Ovo" vira "pao com ovo". */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
