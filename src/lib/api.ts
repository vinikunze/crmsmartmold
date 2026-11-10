import type { Agua, Horario, Pessoa, Refeicao, TipoRefeicao } from '../../shared/tipos';

export class ErroApi extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const RECARREGOU = 'emdia:recarregou';

async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'same-origin',
      // O Access redireciona para a tela de login quando a sessão expira.
      redirect: 'manual',
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (r.type === 'opaqueredirect' || r.status === 401) {
    // Sessão do Access expirou: recarregar leva para o login. Uma vez só por
    // minuto, para nunca virar um laço (lição do nosso ap., 08/11/2026).
    const ultima = Number(sessionStorage.getItem(RECARREGOU) ?? 0);
    if (Date.now() - ultima > 60_000) {
      sessionStorage.setItem(RECARREGOU, String(Date.now()));
      location.reload();
      throw new ErroApi(401, 'Entrando de novo…');
    }
    throw new ErroApi(401, 'Não deu para confirmar o seu login. Toque em Sair e entre de novo com o código do e-mail.');
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(r.status, (dados as { erro?: string }).erro ?? 'Algo deu errado.');
  return dados as T;
}

export interface Dados {
  de: string;
  ate: string;
  pessoas: Pessoa[];
  horarios: Horario[];
  refeicoes: Refeicao[];
  agua: Agua[];
}

export interface DadosRefeicao {
  dia: string;
  hora: string;
  tipo: TipoRefeicao;
  descricao: string;
  kcal: number | null;
  obs: string | null;
}

export const api = {
  eu: () => pedir<{ email: string; pessoa_id: number | null }>('GET', 'eu'),
  dados: (de: string, ate: string) => pedir<Dados>('GET', `dados?de=${de}&ate=${ate}`),
  criarAgua: (a: { chave: string; pessoa_id: number; dia: string; hora: string; ml: number }) => pedir<Agua>('POST', 'agua', a),
  apagarAgua: (id: number) => pedir('DELETE', `agua/${id}`),
  criarRefeicao: (r: DadosRefeicao & { chave: string; pessoa_id: number }) => pedir<Refeicao>('POST', 'refeicoes', r),
  editarRefeicao: (id: number, r: DadosRefeicao) => pedir<Refeicao>('PUT', `refeicoes/${id}`, r),
  apagarRefeicao: (id: number) => pedir('DELETE', `refeicoes/${id}`),
  editarPessoa: (id: number, p: Partial<Omit<Pessoa, 'id' | 'email'>>) => pedir<Pessoa>('PATCH', `pessoas/${id}`, p),
  salvarHorarios: (id: number, horarios: { tipo: TipoRefeicao; hora: string }[]) =>
    pedir<Horario[]>('PUT', `pessoas/${id}/horarios`, { horarios }),
};

/** Link que o navegador abre direto (arquivo .ics), com o login do Access. */
export const linkLembretes = (pessoaId: number, refeicoes: boolean, agua: number) =>
  `/api/pessoas/${pessoaId}/lembretes.ics?refeicoes=${refeicoes ? 1 : 0}&agua=${agua}`;

export const novaChave = () => crypto.randomUUID();
