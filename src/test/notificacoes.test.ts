import { describe, expect, it } from "vitest";
import { gerarNotificacoes } from "@/lib/notificacoes";
import type { Evento, Prazo } from "@/types";

const prazo = (id: string, dataLimite: string, status: Prazo["status"] = "pendente") =>
  ({ id, titulo: `Prazo ${id}`, dataLimite, status }) as Prazo;
const evento = (id: string, data: string, status: Evento["status"] = "pendente") =>
  ({ id, titulo: `Evento ${id}`, data, status, partesIds: [], responsaveisIds: [] }) as unknown as Evento;
const hoje = "2026-11-04";

describe("gerarNotificacoes", () => {
  it("sem dados → nenhuma notificação", () => {
    expect(gerarNotificacoes({ prazos: [], eventos: [], hoje })).toEqual([]);
  });

  it("classifica prazos e ignora cumpridos e distantes", () => {
    const n = gerarNotificacoes({
      prazos: [prazo("a", "2026-11-01"), prazo("h", hoje), prazo("m", "2026-11-05"), prazo("x", "2026-11-20"), prazo("c", hoje, "cumprido")],
      eventos: [],
      hoje,
    });
    expect(n.map((x) => x.titulo)).toEqual(["Prazo atrasado", "Prazo vence hoje", "Prazo vence amanhã"]);
  });

  it("compromissos de hoje/amanhã, ignorando cancelados", () => {
    const n = gerarNotificacoes({ prazos: [], eventos: [evento("1", hoje), evento("2", "2026-11-05"), evento("3", hoje, "cancelado")], hoje });
    expect(n).toHaveLength(2);
  });

  it("respeita as preferências desligadas", () => {
    const n = gerarNotificacoes({
      prazos: [prazo("h", hoje)],
      eventos: [evento("1", hoje)],
      prefs: { notifPrazoHoje: false, notifAgenda: false },
      hoje,
    });
    expect(n).toEqual([]);
  });
});
