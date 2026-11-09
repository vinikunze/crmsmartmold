import { defineConfig } from 'vitest/config';

// Os testes são da lógica pura (dinheiro, resumo, validação).
// Config própria para não subir o ambiente da Cloudflare a cada teste.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
