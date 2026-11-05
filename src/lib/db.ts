import Dexie, { type Table } from "dexie";
import type {
  User, Processo, ParteInteressada, VinculoProcessoParte,
  Evento, Prazo, Arquivo, HistoricoAlteracao,
} from "@/types";

/**
 * Banco local (IndexedDB via Dexie). Todos os dados do Lexco ficam aqui, no
 * computador do usuário. Backup/restauração: src/lib/backup.ts (arquivo ou Google Drive).
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
  // Mesmo conjunto que deleteProcessoCascata apaga (inclui o que pertence a prazos/eventos filhos).
  const prazoIds = await db.prazos.where("processoId").equals(processoId).primaryKeys();
  const eventoIds = await db.eventos.where("processoId").equals(processoId).primaryKeys();
  const entidades = [processoId, ...prazoIds, ...eventoIds] as string[];
  const [arquivos, vinculos, historico] = await Promise.all([
    db.arquivos.where("entidadeId").anyOf(entidades).count(),
    db.vinculos.where("processoId").equals(processoId).count(),
    db.historico.where("entidadeId").anyOf(entidades).count(),
  ]);
  return { prazos: prazoIds.length, eventos: eventoIds.length, arquivos, vinculos, historico };
}

/**
 * Exclusão em cascata, numa única transação (ou apaga tudo, ou nada):
 * processo + prazos + eventos + vínculos, e o histórico/anexos do processo
 * E dos prazos/eventos filhos.
 */
export async function deleteProcessoCascata(processoId: string) {
  await db.transaction("rw", [db.processos, db.prazos, db.eventos, db.arquivos, db.vinculos, db.historico], async () => {
    const prazoIds = await db.prazos.where("processoId").equals(processoId).primaryKeys();
    const eventoIds = await db.eventos.where("processoId").equals(processoId).primaryKeys();
    const entidades = [processoId, ...prazoIds, ...eventoIds] as string[];

    await db.arquivos.where("entidadeId").anyOf(entidades).delete();
    await db.historico.where("entidadeId").anyOf(entidades).delete();
    await db.prazos.bulkDelete(prazoIds);
    await db.eventos.bulkDelete(eventoIds);
    await db.vinculos.where("processoId").equals(processoId).delete();
    await db.processos.delete(processoId);
  });
}

/** Verifica se uma parte tem vínculos antes de excluir. */
export async function podeExcluirParte(parteId: string) {
  const vinculos = await db.vinculos.where("parteId").equals(parteId).count();
  return { ok: vinculos === 0, vinculos };
}

/**
 * Exclui uma parte SEM vínculos com processos (quem chama deve checar
 * podeExcluirParte antes), junto com anexos/histórico dela e as
 * referências em eventos.partesIds.
 */
export async function excluirParte(parteId: string) {
  await db.transaction("rw", [db.partes, db.vinculos, db.arquivos, db.historico, db.eventos], async () => {
    if ((await db.vinculos.where("parteId").equals(parteId).count()) > 0) {
      throw new Error("A parte ainda está vinculada a processos.");
    }
    await db.arquivos.where("entidadeId").equals(parteId).delete();
    await db.historico.where("entidadeId").equals(parteId).delete();
    await db.eventos
      .filter((e) => Array.isArray(e.partesIds) && e.partesIds.includes(parteId))
      .modify((e) => {
        e.partesIds = e.partesIds.filter((id) => id !== parteId);
      });
    await db.partes.delete(parteId);
  });
}
