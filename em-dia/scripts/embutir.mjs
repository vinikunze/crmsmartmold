// Embute o site (dist/client) dentro do Worker. Roda depois do `vite build`.
//
// Por que embutir: com o site servido como "arquivos estáticos", a Cloudflare
// coloca um Worker roteador na frente do nosso, e esse roteador NÃO repassa
// o login do Access (ctx.access) para a API. Resultado: a API achava que
// ninguém estava logado e o app ficava em "Sessão expirada" (08/11/2026; está
// na documentação, "ctx.access limitations"). Com o site embutido, toda
// requisição chega direto no nosso Worker, já com o login.
//
// Também resolve a publicação a partir da sessão do Claude: o envio de
// arquivos estáticos usa uma senha temporária no cabeçalho Authorization que
// o proxy da sessão troca pelo token, o que dá 401.
//
// Para duas pessoas, servir os arquivos do Worker não muda nada de custo:
// continua muito abaixo das 100 mil requisições por dia do plano gratuito.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};


const raiz = 'dist/client';
const arquivos = {};
(function andar(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { andar(caminho); continue; }
    const tipo = TIPOS[extname(nome)];
    if (!tipo) continue; // .assetsignore e afins
    arquivos[`/${relative(raiz, caminho).split('\\').join('/')}`] = {
      tipo,
      b64: readFileSync(caminho).toString('base64'),
    };
  }
})(raiz);
if (!arquivos['/index.html']) throw new Error('Build sem index.html');

// Versão do site: muda sempre que algum arquivo muda. O app compara a dele
// com /versao.json e recarrega sozinho quando sai uma nova (o celular
// guardava a página antiga aberta e mostrava a versão de antes).
const versao = createHash('sha256')
  .update(Object.entries(arquivos).sort().map(([k, a]) => k + a.b64).join('|'))
  .digest('hex').slice(0, 12);
const html = Buffer.from(arquivos['/index.html'].b64, 'base64').toString('utf8')
  .replace('<head>', `<head>\n    <meta name="versao" content="${versao}" />`);
arquivos['/index.html'].b64 = Buffer.from(html).toString('base64');
arquivos['/versao.json'] = { tipo: 'application/json', b64: Buffer.from(JSON.stringify({ versao })).toString('base64') };

mkdirSync('.publicar', { recursive: true });
writeFileSync('.publicar/arquivos.js', `export const ARQUIVOS = ${JSON.stringify(arquivos)};\n`);
writeFileSync('.publicar/entrada.ts', `// Gerado por scripts/publicar.mjs. Não editar.
import api from '../worker/index';
// @ts-ignore gerado
import { ARQUIVOS } from './arquivos.js';

const cache = new Map<string, Uint8Array>();
function bytes(caminho: string): Uint8Array {
  let b = cache.get(caminho);
  if (!b) {
    b = Uint8Array.from(atob(ARQUIVOS[caminho].b64), (c) => c.charCodeAt(0));
    cache.set(caminho, b);
  }
  return b;
}

export default {
  async fetch(req: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return api.fetch(req, env, ctx);
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
    // Rota desconhecida cai no index.html: é um app de página única.
    const caminho = ARQUIVOS[url.pathname] ? url.pathname : '/index.html';
    const imutavel = caminho.startsWith('/assets/'); // nome com hash (JS, CSS, fontes): nunca muda
    return new Response(req.method === 'HEAD' ? null : bytes(caminho), {
      headers: {
        'content-type': ARQUIVOS[caminho].tipo,
        // Página e versão nunca ficam guardadas: sempre a publicada agora.
        'cache-control': imutavel ? 'public, max-age=31536000, immutable' : 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    });
  },
};
`);

// Mesma configuração do wrangler.jsonc, sem os arquivos estáticos e sem o login simulado.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
delete config.$schema;
delete config.assets;
delete config.access;
config.main = 'entrada.ts';
config.d1_databases = config.d1_databases.map((d) => ({ ...d, migrations_dir: '../migrations' }));
writeFileSync('.publicar/wrangler.json', JSON.stringify(config, null, 2));

// O `wrangler deploy` (do painel ou daqui) segue este redirecionamento e
// publica o Worker com o site embutido, em vez da saída padrão do Vite.
mkdirSync('.wrangler/deploy', { recursive: true });
writeFileSync('.wrangler/deploy/config.json', JSON.stringify({ configPath: '../../.publicar/wrangler.json', auxiliaryWorkers: [] }));

const kb = Math.round(Object.values(arquivos).reduce((t, a) => t + a.b64.length, 0) / 1024);
console.log(`${Object.keys(arquivos).length} arquivos embutidos no Worker (${kb} KB em base64), versão ${versao}.`);
