import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, deleteProcessoCascata, excluirParte } from "@/lib/db";

// Fixtures mínimas: só os campos que as funções testadas usam.
const put = {
  processo: (id: string) => db.processos.put({ id, titulo: id } as never),
  prazo: (id: string, processoId: string) => db.prazos.put({ id, processoId, dataLimite: "2026-11-04" } as never),
  evento: (id: string, processoId: string | undefined, partesIds: string[] = []) =>
    db.eventos.put({ id, processoId, data: "2026-11-04", partesIds } as never),
  arquivo: (id: string, entidadeId: string) => db.arquivos.put({ id, entidadeId } as never),
  historico: (id: string, entidadeId: string) => db.historico.put({ id, entidadeId } as never),
  parte: (id: string) => db.partes.put({ id, nome: id } as never),
  vinculo: (id: string, processoId: string, parteId: string) => db.vinculos.put({ id, processoId, parteId } as never),
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("deleteProcessoCascata", () => {
  it("apaga processo, filhos e o histórico/anexos dos filhos — sem tocar em outro processo", async () => {
    await put.processo("p1");
    await put.processo("p2");
    await put.prazo("pz1", "p1");
    await put.evento("ev1", "p1");
    await put.prazo("pz2", "p2");
    await put.historico("h-proc", "p1");
    await put.historico("h-prazo", "pz1");
    await put.historico("h-evento", "ev1");
    await put.historico("h-outro", "pz2");
    await put.arquivo("a-proc", "p1");
    await put.arquivo("a-prazo", "pz1");
    await put.parte("pt1");
    await put.vinculo("v1", "p1", "pt1");

    await deleteProcessoCascata("p1");

    expect(await db.processos.get("p1")).toBeUndefined();
    expect(await db.prazos.count()).toBe(1); // só pz2
    expect(await db.eventos.count()).toBe(0);
    expect((await db.historico.toArray()).map((h) => h.id)).toEqual(["h-outro"]);
    expect(await db.arquivos.count()).toBe(0);
    expect(await db.vinculos.count()).toBe(0);
    expect(await db.partes.get("pt1")).toBeTruthy(); // a parte em si continua
  });
});

describe("excluirParte", () => {
  it("recusa excluir parte vinculada a processo", async () => {
    await put.parte("pt1");
    await put.vinculo("v1", "p1", "pt1");
    await expect(excluirParte("pt1")).rejects.toThrow(/vinculada/);
    expect(await db.partes.get("pt1")).toBeTruthy();
  });

  it("remove parte, anexos, histórico e referências em eventos", async () => {
    await put.parte("pt1");
    await put.arquivo("a1", "pt1");
    await put.historico("h1", "pt1");
    await put.evento("ev1", undefined, ["pt1", "pt2"]);

    await excluirParte("pt1");

    expect(await db.partes.get("pt1")).toBeUndefined();
    expect(await db.arquivos.count()).toBe(0);
    expect(await db.historico.count()).toBe(0);
    expect((await db.eventos.get("ev1"))?.partesIds).toEqual(["pt2"]);
  });
});
