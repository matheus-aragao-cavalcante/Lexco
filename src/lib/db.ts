import Dexie, { type Table } from "dexie";
import type {
  User, Processo, ParteInteressada, VinculoProcessoParte,
  Evento, Prazo, Arquivo, HistoricoAlteracao,
} from "@/types";

class LexControlDB extends Dexie {
  users!: Table<User>;
  processos!: Table<Processo>;
  partes!: Table<ParteInteressada>;
  vinculos!: Table<VinculoProcessoParte>;
  eventos!: Table<Evento>;
  prazos!: Table<Prazo>;
  arquivos!: Table<Arquivo>;
  historico!: Table<HistoricoAlteracao>;

  constructor() {
    super("lexcontrol");
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

export const db = new LexControlDB();

// Helper to add history entry
export async function addHistorico(
  entidadeId: string,
  entidadeTipo: HistoricoAlteracao["entidadeTipo"],
  acao: string,
  descricao: string,
  usuarioId: string,
  usuarioNome: string
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
