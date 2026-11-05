import { describe, expect, it } from "vitest";
import { formatarData, hojeISO, somarDiasISO, statusEfetivoPrazo } from "@/lib/dates";

describe("datas locais", () => {
  it("hoje usa o calendário local, não UTC (23h no Brasil continua sendo o mesmo dia)", () => {
    const noite = new Date(2026, 10, 4, 23, 30); // 04/11/2026 23:30 local
    expect(hojeISO(noite)).toBe("2026-11-04");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDiasISO("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDiasISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDiasISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formata sem deslocar o dia", () => {
    expect(formatarData("2026-11-04")).toBe("04/11/2026");
    expect(formatarData(undefined)).toBe("—");
  });

  it("status efetivo: pendente vencido vira atrasado; cumprido nunca", () => {
    const hoje = "2026-11-04";
    expect(statusEfetivoPrazo({ status: "pendente", dataLimite: "2026-11-03" }, hoje)).toBe("atrasado");
    expect(statusEfetivoPrazo({ status: "urgente", dataLimite: "2026-11-04" }, hoje)).toBe("urgente");
    expect(statusEfetivoPrazo({ status: "cumprido", dataLimite: "2026-01-01" }, hoje)).toBe("cumprido");
  });
});
