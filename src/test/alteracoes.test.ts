import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { salvarProcesso, ConflitoEdicaoError, rebasearFormulario, registrarAndamento } from "@/lib/alteracoes";
import type { Processo } from "@/types";

const base = (over: Partial<Processo> = {}): Processo => ({
  id: "p1", titulo: "Ação X", numero: "123", status: "ativo", dataCadastro: "2026-01-01",
  responsavelId: "u1", equipeIds: [], tags: [], modeloNomenclaturaId: "civel",
  labelPoloAtivo: "Autor", labelPoloPassivo: "Réu", criadoPor: "u1",
  atualizadoEm: "2026-01-01T00:00:00.000Z", atualizadoPor: "u1", ...over,
});
const formDe = (p: Processo) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string")) as Record<string, string>;
const ana = { id: "u1", nome: "Ana" };
const bia = { id: "u2", nome: "Bia" };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.users.bulkPut([{ id: "u1", nome: "Ana" }, { id: "u2", nome: "Bia" }] as never);
});

describe("salvarProcesso", () => {
  it("grava só o que mudou e registra antes → depois no histórico", async () => {
    const p = base();
    await db.processos.put(p);
    const r = await salvarProcesso(p, { ...formDe(p), titulo: "Ação Y", comarca: "Recife" }, ana);
    expect(r.detalhes.map((d) => d.campo).sort()).toEqual(["comarca", "titulo"]);
    const salvo = await db.processos.get("p1");
    expect(salvo?.titulo).toBe("Ação Y");
    expect(salvo?.atualizadoPor).toBe("u1");
    const [h] = await db.historico.toArray();
    expect(h.usuarioNome).toBe("Ana");
    expect(h.detalhes).toContainEqual({ campo: "titulo", rotulo: "Título", de: "Ação X", para: "Ação Y" });
  });

  it("sem mudanças não grava nem cria histórico", async () => {
    const p = base();
    await db.processos.put(p);
    await salvarProcesso(p, formDe(p), ana);
    expect(await db.historico.count()).toBe(0);
  });

  it("preserva alteração de outra pessoa em outro campo (mescla)", async () => {
    const p = base();
    await db.processos.put(p);
    // Bia altera a comarca enquanto Ana edita o título a partir da versão antiga.
    await salvarProcesso(p, { ...formDe(p), comarca: "Olinda" }, bia);
    const r = await salvarProcesso(p, { ...formDe(p), titulo: "Ação Z" }, ana);
    expect(r.mesclou).toBe(true);
    const salvo = await db.processos.get("p1");
    expect(salvo?.titulo).toBe("Ação Z");
    expect(salvo?.comarca).toBe("Olinda");
  });

  it("acusa conflito quando os dois mudam o mesmo campo", async () => {
    const p = base();
    await db.processos.put(p);
    await salvarProcesso(p, { ...formDe(p), numero: "999" }, bia);
    const erro = await salvarProcesso(p, { ...formDe(p), numero: "555" }, ana).catch((e) => e);
    expect(erro).toBeInstanceOf(ConflitoEdicaoError);
    expect(erro.conflitos).toEqual([{ campo: "numero", rotulo: "Número do Processo", meu: "555", atual: "999" }]);
    expect(erro.atualizadoPorNome).toBe("Bia");
    expect((await db.processos.get("p1"))?.numero).toBe("999");
  });

  it("não acusa conflito se os dois chegaram ao mesmo valor", async () => {
    const p = base();
    await db.processos.put(p);
    await salvarProcesso(p, { ...formDe(p), numero: "777" }, bia);
    await expect(salvarProcesso(p, { ...formDe(p), numero: "777" }, ana)).resolves.toBeTruthy();
  });

  it("usa rótulos da modalidade administrativa", async () => {
    const p = base({ modalidade: "administrativo" });
    await db.processos.put(p);
    const r = await salvarProcesso(p, { ...formDe(p), orgaoJulgador: "SPU/PE" }, ana);
    expect(r.detalhes[0].rotulo).toBe("Unidade Responsável");
  });
});

describe("rebasearFormulario", () => {
  it("mantém o que o usuário mexeu e traz o resto do banco", () => {
    const antiga = base();
    const nova = base({ comarca: "Olinda", titulo: "Mudado por outro" });
    const form = { ...formDe(antiga), titulo: "Meu título" };
    const r = rebasearFormulario(antiga, nova, form);
    expect(r.titulo).toBe("Meu título");
    expect(r.comarca).toBe("Olinda");
  });
});

describe("registrarAndamento", () => {
  it("cria entrada de andamento e atualiza só a data/autor do processo", async () => {
    const p = base();
    await db.processos.put(p);
    await registrarAndamento("p1", "  Juntada de petição  ", "2026-11-01", bia);
    const [h] = await db.historico.toArray();
    expect(h.acao).toBe("andamento");
    expect(h.descricao).toBe("Juntada de petição");
    expect(h.dataReferencia).toBe("2026-11-01");
    const salvo = await db.processos.get("p1");
    expect(salvo?.atualizadoPor).toBe("u2");
    expect(salvo?.titulo).toBe("Ação X");
  });
});

describe("cenários da revisão", () => {
  it("recarregar no meio da edição não esconde conflito no mesmo campo", async () => {
    const { rebasearBase } = await import("@/lib/alteracoes");
    const p = base();
    await db.processos.put(p);
    const formAna = { ...formDe(p), titulo: "Título da Ana" };
    await salvarProcesso(p, { ...formDe(p), titulo: "Título da Bia" }, bia);
    const novo = (await db.processos.get("p1"))!;
    // A tela recarrega (ex.: Ana criou uma tarefa) e rebaseia a edição.
    const baseNova = rebasearBase(p, novo, formAna);
    const formNovo = rebasearFormulario(p, novo, formAna);
    await expect(salvarProcesso(baseNova, formNovo, ana)).rejects.toBeInstanceOf(ConflitoEdicaoError);
  });

  it("trocar a nomenclatura atualiza os rótulos e o papel das partes", async () => {
    const p = base();
    await db.processos.put(p);
    await db.vinculos.bulkPut([
      { id: "v1", processoId: "p1", parteId: "a", tipoEnvolvimento: "Autor" },
      { id: "v2", processoId: "p1", parteId: "b", tipoEnvolvimento: "Réu" },
      { id: "v3", processoId: "p1", parteId: "c", tipoEnvolvimento: "Testemunha" },
    ]);
    const r = await salvarProcesso(p, { ...formDe(p), modalidade: "administrativo", modeloNomenclaturaId: "spu" }, ana);
    expect(r.processo.labelPoloAtivo).toBe("Manifestante");
    const vs = Object.fromEntries((await db.vinculos.toArray()).map((v) => [v.id, v.tipoEnvolvimento]));
    expect(vs).toEqual({ v1: "Manifestante", v2: "Interessado", v3: "Testemunha" });
  });
});
