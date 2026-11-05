import { db, addHistorico } from "@/lib/db";
import { STATUS_TAREFA_LABELS, type Evento } from "@/types";

/**
 * Tarefas são eventos do tipo "tarefa" (mesma tabela da agenda): assim aparecem
 * no calendário, entram no backup e nas notificações sem migração de dados.
 * A data do evento é o prazo da tarefa.
 */
export const TIPO_TAREFA = "tarefa";

export const ehTarefa = (e: Pick<Evento, "tipo">) => e.tipo === TIPO_TAREFA;
export const tarefaAberta = (e: Pick<Evento, "status">) => e.status === "pendente" || e.status === "em_andamento";

export interface Autor { id: string; nome: string }

export type DadosTarefa = Pick<Evento, "titulo" | "descricao" | "data" | "horaInicio" | "processoId" | "responsaveisIds" | "prioridade" | "status" | "observacoes">;

async function registrar(tarefa: Pick<Evento, "id" | "titulo" | "processoId">, acao: string, descricao: string, autor: Autor) {
  await addHistorico(tarefa.id, "evento", acao, descricao, autor.id, autor.nome);
  if (tarefa.processoId) await addHistorico(tarefa.processoId, "processo", `tarefa_${acao}`, descricao, autor.id, autor.nome);
}

export async function criarTarefa(dados: DadosTarefa, autor: Autor): Promise<Evento> {
  const agora = new Date().toISOString();
  const tarefa: Evento = {
    ...dados,
    processoId: dados.processoId || undefined,
    id: crypto.randomUUID(),
    tipo: TIPO_TAREFA,
    partesIds: [],
    criadoPor: autor.id,
    criadoEm: agora,
    atualizadoEm: agora,
    ...(dados.status === "concluido" ? { concluidoEm: agora, concluidoPor: autor.id } : {}),
  };
  await db.eventos.add(tarefa);
  await registrar(tarefa, "criacao", `Tarefa "${tarefa.titulo}" criada`, autor);
  return tarefa;
}

export async function atualizarTarefa(original: Evento, dados: DadosTarefa, autor: Autor): Promise<Evento> {
  // Leitura, verificação de versão e gravação na mesma transação.
  return db.transaction("rw", [db.eventos, db.historico], () => atualizarTarefaTx(original, dados, autor));
}

async function atualizarTarefaTx(original: Evento, dados: DadosTarefa, autor: Autor): Promise<Evento> {
  const atual = await db.eventos.get(original.id);
  if (!atual) throw new Error("A tarefa não existe mais (foi excluída em outro lugar).");
  if (atual.atualizadoEm !== original.atualizadoEm) {
    throw new Error("A tarefa foi alterada em outro lugar enquanto você editava. Feche e abra de novo para ver a versão atual.");
  }
  const agora = new Date().toISOString();
  const concluiuAgora = dados.status === "concluido" && atual.status !== "concluido";
  const atualizada: Evento = {
    ...atual, ...dados,
    processoId: dados.processoId || undefined,
    atualizadoEm: agora,
    ...(concluiuAgora ? { concluidoEm: agora, concluidoPor: autor.id } : {}),
    ...(dados.status !== "concluido" ? { concluidoEm: undefined, concluidoPor: undefined } : {}),
  };
  await db.eventos.put(atualizada);
  const desc = atual.status !== dados.status
    ? `Tarefa "${dados.titulo}": ${STATUS_TAREFA_LABELS[atual.status]} → ${STATUS_TAREFA_LABELS[dados.status]}`
    : `Tarefa "${dados.titulo}" editada`;
  await registrar(atualizada, "edicao", desc, autor);
  // Se o vínculo com processo mudou, registra também no processo anterior.
  if (atual.processoId && atual.processoId !== atualizada.processoId) {
    await addHistorico(atual.processoId, "processo", "tarefa_desvinculada", `Tarefa "${dados.titulo}" desvinculada`, autor.id, autor.nome);
  }
  return atualizada;
}

/** Marca como concluída ou reabre (volta para "A fazer"). */
export async function alternarConclusao(tarefa: Evento, autor: Autor): Promise<Evento> {
  return db.transaction("rw", [db.eventos, db.historico], () => alternarConclusaoTx(tarefa, autor));
}

async function alternarConclusaoTx(tarefa: Evento, autor: Autor): Promise<Evento> {
  // Nunca recria a partir da cópia da tela: se foi excluída em outro lugar, avisa.
  const atual = await db.eventos.get(tarefa.id);
  if (!atual) throw new Error("A tarefa não existe mais (foi excluída em outro lugar).");
  const concluir = atual.status !== "concluido";
  const agora = new Date().toISOString();
  const atualizada: Evento = {
    ...atual,
    status: concluir ? "concluido" : "pendente",
    concluidoEm: concluir ? agora : undefined,
    concluidoPor: concluir ? autor.id : undefined,
    atualizadoEm: agora,
  };
  await db.eventos.put(atualizada);
  await registrar(atualizada, concluir ? "concluida" : "reaberta",
    `Tarefa "${atual.titulo}" ${concluir ? "concluída" : "reaberta"}`, autor);
  return atualizada;
}

export async function excluirTarefa(tarefa: Evento, autor: Autor) {
  await db.transaction("rw", [db.eventos, db.historico, db.arquivos], async () => {
    await db.eventos.delete(tarefa.id);
    await db.arquivos.where("entidadeId").equals(tarefa.id).delete();
    if (tarefa.processoId) {
      await addHistorico(tarefa.processoId, "processo", "tarefa_exclusao", `Tarefa "${tarefa.titulo}" excluída`, autor.id, autor.nome);
    }
  });
}

/** Ordem do painel: abertas primeiro, por prazo; concluídas por último. */
export function ordenarTarefas(a: Evento, b: Evento): number {
  const aa = tarefaAberta(a) ? 0 : 1;
  const bb = tarefaAberta(b) ? 0 : 1;
  if (aa !== bb) return aa - bb;
  return `${a.data}${a.horaInicio || ""}`.localeCompare(`${b.data}${b.horaInicio || ""}`);
}
