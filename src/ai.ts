import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './types.ts';
import { CIDADES_ATENDIDAS, CRITERIOS_TEXTO, LIMIARES, categoriaPorScore, type Classificacao } from './criteria.ts';

const SYSTEM = `Você qualifica leads comerciais da Smart Mold, fábrica de blocos de concreto
(blocos de vedação e estruturais, meio-blocos e canaletas) com sede em João Pinheiro (MG).
A empresa vende somente blocos de concreto.

Região atendida pela fábrica: ${CIDADES_ATENDIDAS.join(', ')}.

Critérios de referência:
${CRITERIOS_TEXTO}

Use os critérios como base, mas leia todas as respostas do formulário (inclusive a mensagem livre): sinais como
obra já iniciada, pedido de visita técnica, compra recorrente (revendas), CNPJ ou grandes quantidades de blocos podem subir o lead;
pedido genérico, curiosidade, região muito distante ou interesse em produtos que a empresa não vende (pisos, cobogós, telhas etc.) podem baixá-lo. Responda com:
- score: 0 a 100
- categoria: "A" (${LIMIARES.A}+), "B" (${LIMIARES.B}–${LIMIARES.A - 1}) ou "C" (abaixo de ${LIMIARES.B}), coerente com o score
- motivo: uma ou duas frases em português explicando a classificação para o vendedor.`;

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    categoria: { type: 'string', enum: ['A', 'B', 'C'] },
    motivo: { type: 'string' },
  },
  required: ['score', 'categoria', 'motivo'],
  additionalProperties: false,
};

export function iaAtiva(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Classifica o lead com Claude. Retorna null se a IA não estiver configurada ou falhar. */
export async function classificarComIA(env: Env, lead: Record<string, unknown>): Promise<Classificacao | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  try {
    const response = await client.beta.messages.create({
      model: env.AI_MODEL || 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Respostas do lead:\n${JSON.stringify(lead, null, 2)}` }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    const texto = response.content.find((b) => b.type === 'text');
    if (!texto || texto.type !== 'text') return null;
    const out = JSON.parse(texto.text) as { score: number; categoria: string; motivo: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(out.score) || 0)));
    return { score, categoria: categoriaPorScore(score), motivo: `IA: ${String(out.motivo).slice(0, 600)}` };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Falha na classificação por IA', err.status, err.message);
    } else {
      console.error('Falha na classificação por IA', err);
    }
    return null;
  }
}
