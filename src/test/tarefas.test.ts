import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { criarTarefa, atualizarTarefa, alternarConclusao, excluirTarefa, ordenarTarefas } from "@/lib/tarefas";
import { resolverEdicao, configDaEdicao, rotulosProcesso } from "@/lib/edicao";
import { modelosDaModalidade } from "@/types";
import type { Evento } from "@/types";

const ana = { id: "u1", nome: "Ana" };
const dados = (over: Partial<Evento> = {}) => ({
  titulo: "Protocolar", descricao: "", data: "2026-11-10", horaInicio: "", processoId: "p1",
  responsaveisIds: ["u1"], prioridade: "Normal", status: "pendente" as Evento["status"], observacoes: "", ...over,
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("tarefas", () => {
  it("cria como evento do tipo tarefa e registra no histórico do processo", async () => {
    const t = await criarTarefa(dados(), ana);
    expect((await db.eventos.get(t.id))?.tipo).toBe("tarefa");
    const hs = await db.historico.where("entidadeId").equals("p1").toArray();
    expect(hs[0].descricao).toContain("criada");
  });

  it("concluir e reabrir registram quem e quando", async () => {
    const t = await criarTarefa(dados(), ana);
    const c = await alternarConclusao(t, ana);
    expect(c.status).toBe("concluido");
    expect(c.concluidoPor).toBe("u1");
    const r = await alternarConclusao(c, ana);
    expect(r.status).toBe("pendente");
    expect(r.concluidoEm).toBeUndefined();
  });

  it("recusa salvar edição feita sobre versão desatualizada", async () => {
    const t = await criarTarefa(dados(), ana);
    await atualizarTarefa(t, dados({ titulo: "Outro" }), ana);
    await expect(atualizarTarefa(t, dados({ titulo: "Meu" }), ana)).rejects.toThrow(/alterada em outro lugar/);
  });

  it("excluir remove a tarefa e deixa rastro no processo", async () => {
    const t = await criarTarefa(dados(), ana);
    await excluirTarefa(t, ana);
    expect(await db.eventos.get(t.id)).toBeUndefined();
    const hs = await db.historico.where("entidadeId").equals("p1").toArray();
    expect(hs.some((h) => h.acao === "tarefa_exclusao")).toBe(true);
  });

  it("ordena abertas por prazo e concluídas no fim", () => {
    const e = (id: string, data: string, status: Evento["status"]) => ({ id, data, status } as Evento);
    const lista = [e("c", "2026-01-01", "concluido"), e("b", "2026-02-01", "pendente"), e("a", "2026-01-15", "em_andamento")];
    expect(lista.sort(ordenarTarefas).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("edições", () => {
  it("só 'spu' ativa a versão SPU; qualquer outro valor é a completa", () => {
    expect(resolverEdicao("spu")).toBe("spu");
    expect(resolverEdicao(undefined)).toBe("completa");
    expect(resolverEdicao("xyz")).toBe("completa");
  });
  it("versão SPU só tem modalidade administrativa e nomenclatura Manifestante", () => {
    const spu = configDaEdicao("spu");
    expect(spu.modalidades).toEqual(["administrativo"]);
    const modelo = modelosDaModalidade("administrativo").find((m) => m.id === spu.modeloPadraoPorModalidade.administrativo);
    expect(modelo?.poloAtivo).toBe("Manifestante");
  });
  it("rótulos mudam conforme a modalidade", () => {
    expect(rotulosProcesso("judicial").orgaoJulgador).toBe("Órgão Julgador");
    expect(rotulosProcesso("administrativo").orgaoJulgador).toBe("Unidade Responsável");
    expect(modelosDaModalidade("judicial").some((m) => m.id === "spu")).toBe(false);
  });
});

describe("tarefa excluída em outro lugar", () => {
  it("concluir não recria a tarefa", async () => {
    const t = await criarTarefa(dados(), ana);
    await db.eventos.delete(t.id);
    await expect(alternarConclusao(t, ana)).rejects.toThrow(/não existe mais/);
    expect(await db.eventos.get(t.id)).toBeUndefined();
  });
});
