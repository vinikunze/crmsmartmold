export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...headers },
  });
}

const MAX_BODY = 64 * 1024;

async function readText(request: Request): Promise<string> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Conteúdo muito grande');
  return text;
}

/** Lê o corpo como objeto, aceitando JSON ou formulário (urlencoded / multipart). */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') out[k] = out[k] === undefined ? v : `${out[k]}, ${v}`;
    }
    return out;
  }
  const text = await readText(request);
  if (!text.trim()) return {};
  if (type.includes('application/x-www-form-urlencoded')) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(text)) out[k] = out[k] === undefined ? v : `${out[k]}, ${v}`;
    return out;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return { payload: parsed };
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

export function str(v: unknown, max = 500): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'desconhecido';
}

export function nowIso(): string {
  return new Date().toISOString();
}
