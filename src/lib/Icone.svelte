<script lang="ts" module>
  import { Coffee, Apple, Utensils, Sandwich, Soup, Moon, Cookie } from '@lucide/svelte';

  // Nome guardado no código (shared/tipos.ts) → desenho. Trocar a biblioteca
  // de ícones é mexer só aqui.
  export const ICONES = {
    cafe: Coffee, maca: Apple, prato: Utensils, sanduiche: Sandwich, sopa: Soup, lua: Moon, biscoito: Cookie,
  } as const;
</script>

<script lang="ts">
  import { REFEICOES, type TipoRefeicao } from '../../shared/tipos';

  let { tipo, tamanho = 20 }: { tipo: TipoRefeicao; tamanho?: number } = $props();
  const nome = $derived(REFEICOES.find((r) => r.tipo === tipo)?.icone ?? 'prato');
  const Comp = $derived(ICONES[nome as keyof typeof ICONES] ?? Utensils);
</script>

<Comp size={tamanho} strokeWidth={1.75} aria-hidden="true" />
