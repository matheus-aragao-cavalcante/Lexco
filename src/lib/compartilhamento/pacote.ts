import type { LexcoDB } from "@/lib/db";
import { permissoesDe, nomeReduzido, mascararDocumentoParcial, type Permissoes } from "@/lib/permissoes";
import type { Arquivo, Evento, HistoricoAlteracao, ParteInteressada, Prazo, Processo, ResultadoOperacao, User, VinculoProcessoParte } from "@/types";
import { aplicarLocal, semCaptura, TABELAS_COMPARTILHADAS, type Operacao } from "./operacoes";

/**
 * Pacote = fotografia FILTRADA do ambiente do administrador para UM convidado.
 * O que o convidado não pode ver simplesmente não vai no arquivo (não é só
 * escondido na tela): CPF, telefone etc. saem mascarados/removidos aqui.
 */
export interface Pacote {
  formato: "lexco-pacote";
  versao: 1;
  geradoEm: string;
  dono: { nome: string; email: string; escritorio?: string };
  voce: { id: string; nome: string; perfil: User["perfil"] };
  permissoes: Permissoes;
  resultados: ResultadoOperacao[];
  dados: {
    processos: Processo[];
    partes: ParteInteressada[];
    vinculos: VinculoProcessoParte[];
    eventos: Evento[];
    prazos: Prazo[];
    arquivos: Arquivo[];
    historico: HistoricoAlteracao[];
    usuarios: Pick<User, "id" | "nome" | "perfil" | "status">[];
  };
}

export interface Caixa {
  formato: "lexco-caixa";
  versao: 1;
  voceId: string;
  enviadoEm: string;
  ops: Operacao[];
}

/**
 * Histórico também pode carregar dados restritos (nome da parte, título de
 * tarefa, valores antigos de campos): só vai o que o convidado poderia ver.
 */
export function filtrarHistorico(hist: HistoricoAlteracao[], p: Permissoes, eventos: Evento[]): HistoricoAlteracao[] {
  const tarefas = new Set(eventos.filter((e) => e.tipo === "tarefa").map((e) => e.id));
  return hist.filter((h) => {
    if (h.entidadeTipo === "usuario") return false;
    if (p.tarefas === "nenhum" && (tarefas.has(h.entidadeId) || h.acao.startsWith("tarefa_"))) return false;
    if (!p.verDadosPessoais && (h.entidadeTipo === "parte" || h.acao.startsWith("parte_"))) return false;
    return true;
  }).map((h) => (p.verDadosPessoais ? h : { ...h, detalhes: h.detalhes?.filter((d) => d.campo !== "responsavelId") }));
}

/** Remove/mascara dados pessoais de uma parte. */
export function ocultarDadosPessoais(p: ParteInteressada): ParteInteressada {
  return {
    ...p,
    nome: nomeReduzido(p.nome),
    nomeSocial: undefined,
    razaoSocial: p.tipoPessoa === "Pessoa Física" ? undefined : p.razaoSocial, // razão social de empresa não é dado pessoal
    cpfCnpj: p.tipoPessoa === "Pessoa Física" ? mascararDocumentoParcial(p.cpfCnpj || "") || undefined : p.cpfCnpj,
    rg: undefined, orgaoEmissor: undefined, dataNascimento: undefined,
    telefone: undefined, telefone2: undefined, email: undefined,
    endereco: undefined, cep: undefined,
    foto: undefined,
  };
}

export async function construirPacote(
  db: LexcoDB,
  convidado: User,
  dono: Pacote["dono"],
  resultados: ResultadoOperacao[],
): Promise<Pacote> {
  const p = permissoesDe(convidado);
  const vazio = <T,>(): T[] => [];
  const [processos, partes, vinculos, eventos, prazos, arquivos, historico, usuarios] = p.verProcessos
    ? await Promise.all([
      db.processos.toArray(), db.partes.toArray(), db.vinculos.toArray(), db.eventos.toArray(),
      db.prazos.toArray(), db.arquivos.toArray(), p.verHistorico ? db.historico.toArray() : Promise.resolve(vazio<HistoricoAlteracao>()),
      db.users.toArray(),
    ])
    : [vazio<Processo>(), vazio<ParteInteressada>(), vazio<VinculoProcessoParte>(), vazio<Evento>(), vazio<Prazo>(), vazio<Arquivo>(), vazio<HistoricoAlteracao>(), await db.users.toArray()];

  const processosIds = new Set(processos.map((x) => x.id));
  return {
    formato: "lexco-pacote",
    versao: 1,
    geradoEm: new Date().toISOString(),
    dono,
    voce: { id: convidado.id, nome: convidado.nome, perfil: convidado.perfil },
    permissoes: p,
    resultados,
    dados: {
      processos,
      partes: p.verDadosPessoais ? partes : partes.map(ocultarDadosPessoais),
      vinculos: vinculos.filter((v) => processosIds.has(v.processoId)),
      eventos: p.tarefas === "nenhum" ? eventos.filter((e) => e.tipo !== "tarefa") : eventos,
      prazos,
      // Documentos: só os registros (o arquivo em si fica no Drive, com permissão própria).
      // Miniaturas de fotos de documentos pessoais também ficam de fora se não houver acesso.
      arquivos: p.documentos === "nenhum" ? [] : arquivos.filter((a) => a.entidadeTipo === "processo" || p.verDadosPessoais),
      historico: filtrarHistorico(historico, p, eventos),
      // Usuários: só nome e perfil (nunca e-mail, senha, CPF...).
      usuarios: usuarios.map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil, status: u.status })),
    },
  };
}

/**
 * Convidado: substitui a cópia local pelo pacote e reaplica por cima as
 * alterações dele que o administrador ainda não processou (para não "sumirem").
 */
export async function aplicarPacoteLocal(db: LexcoDB, pacote: Pacote, pendentes: Operacao[]) {
  if (pacote?.formato !== "lexco-pacote") throw new Error("Pacote inválido.");
  const tabelas = [...TABELAS_COMPARTILHADAS, "users"];
  await semCaptura(db, tabelas, async () => {
    for (const t of tabelas) await db.table(t).clear();
    const d = pacote.dados;
    await db.processos.bulkPut(d.processos);
    await db.partes.bulkPut(d.partes);
    await db.vinculos.bulkPut(d.vinculos);
    await db.eventos.bulkPut(d.eventos);
    await db.prazos.bulkPut(d.prazos);
    await db.arquivos.bulkPut(d.arquivos);
    await db.historico.bulkPut(d.historico);
    const agora = pacote.geradoEm;
    await db.users.bulkPut(d.usuarios.map((u) => ({
      ...u, email: "", senha: "", criadoEm: agora, atualizadoEm: agora,
      preferencias: { tema: "light" as const },
    })) as User[]);
    for (const op of pendentes) {
      try {
        await aplicarLocal(db, op);
      } catch {
        /* operação que não se encaixa mais (ex.: registro excluído) — o administrador dirá o resultado */
      }
    }
  });
}
