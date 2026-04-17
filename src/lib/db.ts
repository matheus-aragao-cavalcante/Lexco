import Dexie, { type Table } from "dexie";
import type {
  User, Processo, ParteInteressada, VinculoProcessoParte,
  Evento, Prazo, Arquivo, HistoricoAlteracao,
} from "@/types";

/**
 * Camada local-first via IndexedDB (Dexie).
 *
 * Quando migrar para Firestore, mantenha a mesma forma das funções
 * (addHistorico, deleteProcessoCascata, etc.) — elas serão a interface
 * usada pelas páginas, e a implementação interna é que muda.
 *
 * Veja src/services/db/firestoreRepositories.ts para o ponto de troca.
 */
class LexcoDB extends Dexie {
  users!: Table<User>;
  processos!: Table<Processo>;
  partes!: Table<ParteInteressada>;
  vinculos!: Table<VinculoProcessoParte>;
  eventos!: Table<Evento>;
  prazos!: Table<Prazo>;
  arquivos!: Table<Arquivo>;
  historico!: Table<HistoricoAlteracao>;

  constructor() {
    super("lexco");
    this.version(1).stores({
      users: "id, email, status",
      processos: "id, numero, status, responsavelId, criadoPor",
      partes: "id, tipoPessoa, cpfCnpj, nome, status",
      vinculos: "id, processoId, parteId",
      eventos: "id, data, tipo, processoId, status",
      prazos: "id, processoId, dataLimite, status, responsavelId",
      arquivos: "id, entidadeId, entidadeTipo",
      historico: "id, entidadeId, entidadeTipo, data",
    });
  }
}

export const db = new LexcoDB();

/** Registra alteração no histórico. */
export async function addHistorico(
  entidadeId: string,
  entidadeTipo: HistoricoAlteracao["entidadeTipo"],
  acao: string,
  descricao: string,
  usuarioId: string,
  usuarioNome: string,
) {
  await db.historico.add({
    id: crypto.randomUUID(),
    entidadeId,
    entidadeTipo,
    acao,
    descricao,
    usuarioId,
    usuarioNome,
    data: new Date().toISOString(),
  });
}

/** Conta dependências de um processo (para mensagens de confirmação). */
export async function contarDependenciasProcesso(processoId: string) {
  const [prazos, eventos, arquivos, vinculos, historico] = await Promise.all([
    db.prazos.where("processoId").equals(processoId).count(),
    db.eventos.where("processoId").equals(processoId).count(),
    db.arquivos.where("entidadeId").equals(processoId).count(),
    db.vinculos.where("processoId").equals(processoId).count(),
    db.historico.where("entidadeId").equals(processoId).count(),
  ]);
  return { prazos, eventos, arquivos, vinculos, historico };
}

/** Exclusão em cascata: processo + prazos + eventos + arquivos + vínculos + histórico. */
export async function deleteProcessoCascata(processoId: string) {
  await Promise.all([
    db.prazos.where("processoId").equals(processoId).delete(),
    db.eventos.where("processoId").equals(processoId).delete(),
    db.arquivos.where("entidadeId").equals(processoId).delete(),
    db.vinculos.where("processoId").equals(processoId).delete(),
    db.historico.where("entidadeId").equals(processoId).delete(),
  ]);
  await db.processos.delete(processoId);
}

/** Verifica se uma parte tem vínculos antes de excluir. */
export async function podeExcluirParte(parteId: string) {
  const vinculos = await db.vinculos.where("parteId").equals(parteId).count();
  return { ok: vinculos === 0, vinculos };
}
