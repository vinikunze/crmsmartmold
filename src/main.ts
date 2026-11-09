import { mount } from 'svelte';
import '@fontsource-variable/inter';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });

// Versão nova publicada: recarrega sozinho. Confere ao abrir, ao voltar para
// o app e a cada 5 minutos. Não recarrega com uma gaveta aberta, para não
// perder o que a pessoa está digitando. (No `npm run dev` não há versão.)
const minhaVersao = document.querySelector<HTMLMetaElement>('meta[name="versao"]')?.content;
if (minhaVersao) {
  const conferir = async () => {
    if (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) return;
    try {
      const r = await fetch('/versao.json', { cache: 'no-store', redirect: 'manual' });
      if (!r.ok) return;
      const { versao } = (await r.json()) as { versao?: string };
      // No máximo uma recarga por minuto, para nunca virar um laço.
      const ultima = Number(sessionStorage.getItem('emdia:nova-versao') ?? 0);
      if (versao && versao !== minhaVersao && Date.now() - ultima > 60_000) {
        sessionStorage.setItem('emdia:nova-versao', String(Date.now()));
        location.reload();
      }
    } catch {
      /* sem internet: confere na próxima */
    }
  };
  document.addEventListener('visibilitychange', conferir);
  setInterval(conferir, 5 * 60_000);
  conferir();
}
