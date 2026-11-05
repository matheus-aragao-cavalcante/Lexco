import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Arquivo, Processo, User } from "@/types";
import { createBackup, isLegacyBackup, parseBackup, restoreBackup, serializeBackup } from "@/lib/backup";

const user = { id: "u1", nome: "Ana", email: "ana@x.com", senha: "hash", perfil: "advogado", status: "ativo" } as unknown as User;
const processo = (id: string, titulo: string) => ({ id, titulo, status: "ativo", criadoPor: "u1" }) as unknown as Processo;
const arquivo = { id: "a1", nome: "peticao.pdf", categoria: "doc", entidadeId: "p1", entidadeTipo: "processo", dados: "data:application/pdf;base64,AAA", responsavelId: "u1", criadoEm: "2026-01-01" } as Arquivo;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("backup", () => {
  it("exporta e restaura tudo, incluindo usuários e conteúdo dos anexos", async () => {
    await db.users.put(user);
    await db.processos.put(processo("p1", "Ação A"));
    await db.arquivos.put(arquivo);

    const text = serializeBackup(await createBackup());
    await Promise.all(db.tables.map((t) => t.clear()));

    await restoreBackup(parseBackup(text), "substituir");
    expect(await db.users.get("u1")).toMatchObject({ email: "ana@x.com", senha: "hash" });
    expect(await db.processos.count()).toBe(1);
    expect((await db.arquivos.get("a1"))?.dados).toBe(arquivo.dados);
  });

  it("substituir remove o que não está no backup; mesclar mantém", async () => {
    await db.processos.put(processo("p1", "Ação A"));
    const backup = await createBackup();

    await db.processos.put(processo("p2", "Ação B"));
    await restoreBackup(backup, "mesclar");
    expect(await db.processos.count()).toBe(2);

    await restoreBackup(backup, "substituir");
    expect((await db.processos.toArray()).map((p) => p.id)).toEqual(["p1"]);
  });

  it("aceita o formato antigo de exportação", () => {
    const legacy = JSON.stringify({ user, processos: [processo("p1", "A")], arquivos: [{ id: "a9", dados: undefined }] });
    const parsed = parseBackup(legacy);
    expect(parsed.tables.users).toHaveLength(1);
    expect(parsed.tables.processos).toHaveLength(1);
    expect(parsed.tables.arquivos).toHaveLength(0); // anexos sem conteúdo são ignorados
  });

  it("rejeita backup truncado (tabela ausente) e registros sem id", async () => {
    const full = await createBackup();
    const truncado = { ...full, tables: { ...full.tables } } as Record<string, unknown> & { tables: Record<string, unknown> };
    delete truncado.tables.arquivos;
    expect(() => parseBackup(JSON.stringify(truncado))).toThrow(/incompleto/);

    const semId = { ...full, tables: { ...full.tables, processos: [{ titulo: "sem id" }] } };
    expect(() => parseBackup(JSON.stringify(semId))).toThrow(/corrompido/);
  });

  it("backup legado não pode substituir (só mesclar)", async () => {
    await db.arquivos.put(arquivo);
    const legado = parseBackup(JSON.stringify({ user, processos: [processo("p9", "Z")] }));
    expect(isLegacyBackup(legado)).toBe(true);
    await expect(restoreBackup(legado, "substituir")).rejects.toThrow(/mesclados/);
    expect(await db.arquivos.count()).toBe(1); // nada foi apagado

    await restoreBackup(legado, "mesclar");
    expect(await db.processos.get("p9")).toBeTruthy();
    expect(await db.arquivos.count()).toBe(1);
  });

  it("rejeita arquivos inválidos e backups de versão futura", () => {
    expect(() => parseBackup("não é json")).toThrow(/JSON/);
    expect(() => parseBackup(JSON.stringify({ foo: 1 }))).toThrow(/inválido/);
    expect(() => parseBackup(JSON.stringify({ format: "lexco-backup", version: 99, tables: {} }))).toThrow(/mais nova/);
  });
});
