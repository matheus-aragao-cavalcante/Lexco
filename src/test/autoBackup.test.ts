import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  ESPERA_SEM_ALTERACOES_MS, INTERVALO_MINIMO_MS, autoBackupLigado, definirAutoBackup, deveEnviar,
  instalarRastreamento, limparPendente, marcarPendente, nomeBackupAutomatico, pendenteDesde,
} from "@/lib/autoBackup";

beforeEach(() => localStorage.clear());

describe("deveEnviar", () => {
  const agora = 10_000_000;
  it("sem alterações pendentes, não envia", () => {
    expect(deveEnviar({ pendente: null, ultimoEnvio: null, agora })).toBe(false);
  });
  it("espera um tempo sem novas alterações", () => {
    expect(deveEnviar({ pendente: agora - 1000, ultimoEnvio: null, agora })).toBe(false);
    expect(deveEnviar({ pendente: agora - ESPERA_SEM_ALTERACOES_MS, ultimoEnvio: null, agora })).toBe(true);
  });
  it("respeita o intervalo mínimo entre envios", () => {
    const pendente = agora - ESPERA_SEM_ALTERACOES_MS;
    expect(deveEnviar({ pendente, ultimoEnvio: agora - 1000, agora })).toBe(false);
    expect(deveEnviar({ pendente, ultimoEnvio: agora - INTERVALO_MINIMO_MS, agora })).toBe(true);
  });
});

describe("pendente", () => {
  it("só limpa se não houve nova alteração durante o envio", () => {
    marcarPendente(100);
    const marca = pendenteDesde();
    marcarPendente(200); // alteração no meio do envio
    limparPendente(marca);
    expect(pendenteDesde()).toBe(200);
    limparPendente(200);
    expect(pendenteDesde()).toBeNull();
  });

  it("qualquer gravação no banco marca pendente", async () => {
    instalarRastreamento();
    expect(pendenteDesde()).toBeNull();
    await db.partes.put({ id: "x", nome: "x" } as never);
    expect(pendenteDesde()).not.toBeNull();
  });
});

describe("preferência e nome", () => {
  it("vem ligado por padrão e pode ser desligado por usuário", () => {
    expect(autoBackupLigado("u1")).toBe(true);
    definirAutoBackup("u1", false);
    expect(autoBackupLigado("u1")).toBe(false);
    expect(autoBackupLigado("u2")).toBe(true);
  });
  it("um arquivo por dia (data local)", () => {
    expect(nomeBackupAutomatico(new Date(2026, 10, 4, 23, 50))).toBe("lexco_auto_2026-11-04.json");
  });
});
