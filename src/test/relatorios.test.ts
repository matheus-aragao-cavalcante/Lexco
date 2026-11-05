import { describe, expect, it } from "vitest";
import { calcularRelatorio, ultimosMeses } from "@/lib/relatorios";
import type { Prazo, Processo, User } from "@/types";

const hoje = "2026-11-04";
const proc = (id: string, status: Processo["status"], dataCadastro: string, responsavelId = "u1") =>
  ({ id, titulo: id, status, dataCadastro, responsavelId }) as Processo;
const prazo = (id: string, dataLimite: string, status: Prazo["status"]) => ({ id, titulo: id, dataLimite, status }) as Prazo;
const users = [{ id: "u1", nome: "Ana" }] as User[];

describe("relatórios", () => {
  it("meses do período atravessando o ano", () => {
    expect(ultimosMeses("2026-02-10", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("tudo zerado quando não há dados", () => {
    const r = calcularRelatorio({ processos: [], prazos: [], users: [], meses: 6, hoje });
    expect(r.kpis).toEqual({ totalProcessos: 0, concluidos: 0, prazosCumpridos: 0, prazosAtrasados: 0 });
    expect(r.porResponsavel).toEqual([]);
    expect(r.evolucao.every((m) => m.total === 0)).toBe(true);
  });

  it("conta com os dados reais", () => {
    const r = calcularRelatorio({
      processos: [proc("a", "ativo", "2026-09-10"), proc("b", "concluido", "2026-11-01"), proc("c", "ativo", "2026-11-02", "")],
      prazos: [prazo("1", "2026-10-15", "cumprido"), prazo("2", "2026-10-20", "pendente"), prazo("3", "2026-12-01", "pendente"), prazo("4", "2025-01-01", "cumprido")],
      users,
      meses: 3,
      hoje,
    });
    expect(r.kpis).toEqual({ totalProcessos: 3, concluidos: 1, prazosCumpridos: 1, prazosAtrasados: 1 });
    expect(r.porResponsavel).toEqual([{ nome: "Ana", processos: 2 }, { nome: "Sem responsável", processos: 1 }]);
    expect(r.evolucao.map((m) => m.total)).toEqual([1, 1, 3]); // set, out, nov
    expect(r.prazosPorMes.find((m) => m.mes === "out/26")).toEqual({ mes: "out/26", cumpridos: 1, atrasados: 1 });
  });
});
