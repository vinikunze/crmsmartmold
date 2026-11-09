// Estado compartilhado entre as telas. Os registros do período carregado
// ficam na memória: cada mudança atualiza aqui na hora, sem recarregar tudo.

import type { Agua, Horario, Pessoa, Refeicao, TipoRefeicao } from '../../shared/tipos';
import { hoje, horaAgora, somarDias, diasEntre } from '../../shared/datas';
import { api, novaChave } from './api';
import { formatarMl } from '../../shared/resumo';

const PESSOA_SALVA = 'emdia:pessoa';
/** Ao abrir, carrega os últimos 35 dias: cobre o histórico de 30 dias e as sugestões. */
const DIAS_INICIAIS = 35;

export type Gaveta =
  | { tipo: 'nova'; dia: string; pessoa_id: number; refeicao?: TipoRefeicao; hora?: string }
  | { tipo: 'editar'; refeicao: Refeicao }
  | { tipo: 'agua'; dia: string; pessoa_id: number }
  | null;

class Estado {
  email = $state('');
  /** A pessoa que está logada. null se o e-mail não tiver cadastro (não deveria acontecer). */
  eu = $state<number | null>(null);
  pessoas = $state<Pessoa[]>([]);
  horarios = $state<Horario[]>([]);
  refeicoes = $state<Refeicao[]>([]);
  agua = $state<Agua[]>([]);
  /** Primeiro dia carregado. Dias antes dele são buscados quando alguém abre. */
  de = $state('');

  /** De quem é o dia mostrado. Fica guardado no aparelho. */
  pessoaId = $state<number>(0);

  /** Relógio de Brasília, atualizado a cada 30 s: muda "atrasada", "no ritmo"… */
  relogio = $state({ dia: hoje(), hora: horaAgora() });

  gaveta = $state<Gaveta>(null);

  aviso = $state<{ texto: string; acao?: { rotulo: string; fazer: () => void }; erro?: boolean } | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private buscando: Promise<void> | null = null;

  constructor() {
    setInterval(() => (this.relogio = { dia: hoje(), hora: horaAgora() }), 30_000);
  }

  get pessoa(): Pessoa | undefined {
    return this.pessoas.find((p) => p.id === this.pessoaId);
  }

  nomeDe(id: number): string {
    return this.pessoas.find((p) => p.id === id)?.nome ?? '';
  }

  planoDe(id: number): Horario[] {
    return this.horarios.filter((h) => h.pessoa_id === id);
  }

  escolher(id: number) {
    this.pessoaId = id;
    localStorage.setItem(PESSOA_SALVA, String(id));
  }

  async carregar() {
    const ate = somarDias(hoje(), 1);
    const de = somarDias(hoje(), -DIAS_INICIAIS);
    const [eu, dados] = await Promise.all([api.eu(), api.dados(de, ate)]);
    this.email = eu.email;
    this.eu = eu.pessoa_id;
    this.pessoas = dados.pessoas;
    this.horarios = dados.horarios;
    this.refeicoes = dados.refeicoes;
    this.agua = dados.agua;
    this.de = dados.de;
    const salva = Number(localStorage.getItem(PESSOA_SALVA));
    const valida = (id: number | null) => (id && this.pessoas.some((p) => p.id === id) ? id : null);
    this.pessoaId = valida(salva) ?? valida(eu.pessoa_id) ?? this.pessoas[0]?.id ?? 0;
  }

  /** Garante que o dia (e um mês antes dele) está carregado. Para abrir dias antigos. */
  async garantir(dia: string): Promise<void> {
    // Busca em blocos de 60 dias para trás (a API aceita até 120 por vez),
    // um de cada vez, até cobrir o dia pedido e o mês antes dele.
    const alvo = somarDias(dia, -30);
    while (this.de && dia < this.de) {
      if (!this.buscando) {
        const ate = somarDias(this.de, -1);
        const de = diasEntre(alvo, ate) > 59 ? somarDias(ate, -59) : alvo;
        this.buscando = api.dados(de, ate).then((d) => {
          this.refeicoes = [...d.refeicoes, ...this.refeicoes];
          this.agua = [...d.agua, ...this.agua];
          this.de = de;
        }).finally(() => (this.buscando = null));
      }
      await this.buscando;
    }
  }

  guardarRefeicao(r: Refeicao) {
    const i = this.refeicoes.findIndex((x) => x.id === r.id);
    if (i >= 0) this.refeicoes[i] = r;
    else this.refeicoes.push(r);
  }

  tirarRefeicao(id: number) {
    this.refeicoes = this.refeicoes.filter((x) => x.id !== id);
  }

  guardarPessoa(p: Pessoa) {
    const i = this.pessoas.findIndex((x) => x.id === p.id);
    if (i >= 0) this.pessoas[i] = p;
  }

  /** Copo de água. A hora é a de agora se for hoje; num dia passado, meio-dia. */
  async beber(pessoaId: number, dia: string, ml: number) {
    const hora = dia === this.relogio.dia ? horaAgora() : '12:00';
    try {
      const a = await api.criarAgua({ chave: novaChave(), pessoa_id: pessoaId, dia, hora, ml });
      this.agua.push(a);
      this.avisar(`+ ${formatarMl(ml)} de água`, { acao: { rotulo: 'Desfazer', fazer: () => this.desbeber(a) } });
    } catch (e) {
      this.erro(e);
    }
  }

  async desbeber(a: Agua) {
    try {
      await api.apagarAgua(a.id);
      this.agua = this.agua.filter((x) => x.id !== a.id);
      this.avisar(`${formatarMl(a.ml)} de água retirados.`);
    } catch (e) {
      this.erro(e);
    }
  }

  avisar(texto: string, opcoes: { acao?: { rotulo: string; fazer: () => void }; erro?: boolean } = {}) {
    clearTimeout(this.timer);
    this.aviso = { texto, ...opcoes };
    this.timer = setTimeout(() => (this.aviso = null), opcoes.acao ? 6000 : 3500);
  }

  erro(e: unknown) {
    this.avisar(e instanceof Error ? e.message : 'Algo deu errado.', { erro: true });
  }
}

export const estado = new Estado();
