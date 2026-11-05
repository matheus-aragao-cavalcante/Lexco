import { describe, it, expect } from "vitest";
import { parseNumeroCNJ, aliasDataJud, normalizarConsulta, consultarProcesso, dataISO, capitalizarNome } from "@/lib/consultaProcesso";

const NUM = "0095837-75.2003.8.19.0001";

// Formato real das respostas (dados fictícios).
const datajud = { hits: { hits: [{ _source: {
  numeroProcesso: "00958377520038190001", tribunal: "TJRJ", grau: "G1", dataAjuizamento: "20031201000000",
  classe: { nome: "Embargos à Execução Fiscal" }, orgaoJulgador: { nome: "17ª Vara de Fazenda Pública" },
  assuntos: [{ nome: "ICMS" }], nivelSigilo: 0, dataHoraUltimaAtualizacao: "2026-10-01T10:00:00Z",
  movimentos: [
    { nome: "Conclusão", dataHora: "2026-09-01T10:00:00Z" },
    { nome: "Juntada", dataHora: "2026-10-01T10:00:00Z", complementosTabelados: [{ nome: "Petição" }] },
  ],
} }] } };
const djen = { items: [
  { siglaTribunal: "TJRJ", nomeOrgao: "Cartório da 17ª Vara", nomeClasse: "EMBARGOS À EXECUÇÃO FISCAL",
    destinatarios: [{ nome: "EMPRESA EXEMPLO LTDA", polo: "A" }, { nome: "ESTADO DO RIO DE JANEIRO", polo: "P" }],
    destinatarioadvogados: [{ advogado: { nome: "FULANO DE TAL", numero_oab: "123", uf_oab: "RJ" } }] },
  { destinatarios: [{ nome: "EMPRESA EXEMPLO LTDA", polo: "A" }], destinatarioadvogados: [{ advogado: { nome: "FULANO DE TAL", numero_oab: "123", uf_oab: "RJ" } }] },
] };

describe("número CNJ", () => {
  it("valida o dígito verificador", () => {
    expect(parseNumeroCNJ(NUM)?.digitos).toBe("00958377520038190001");
    expect(parseNumeroCNJ("0095837-76.2003.8.19.0001")).toBeNull();
    expect(parseNumeroCNJ("123")).toBeNull();
  });
  it("descobre o tribunal no DataJud", () => {
    const n = (s: string) => aliasDataJud({ ...parseNumeroCNJ(NUM)!, justica: s.split(".")[0], tribunal: s.split(".")[1] });
    expect(n("8.19")).toBe("api_publica_tjrj");
    expect(n("8.07")).toBe("api_publica_tjdft");
    expect(n("8.17")).toBe("api_publica_tjpe");
    expect(n("4.05")).toBe("api_publica_trf5");
    expect(n("5.06")).toBe("api_publica_trt6");
    expect(n("5.00")).toBe("api_publica_tst");
    expect(n("6.26")).toBe("api_publica_tre-sp");
    expect(n("3.00")).toBe("api_publica_stj");
    expect(n("1.00")).toBeNull();
  });
});

describe("normalização", () => {
  it("combina DataJud (dados do processo) e DJEN (partes)", () => {
    const r = normalizarConsulta(parseNumeroCNJ(NUM)!, datajud, djen);
    expect(r.tribunal).toBe("TJRJ");
    expect(r.orgaoJulgador).toBe("17ª Vara de Fazenda Pública");
    expect(r.origem.orgaoJulgador).toBe("DataJud");
    expect(r.dataDistribuicao).toBe("2003-12-01");
    expect(r.instancia).toBe("1º Grau");
    expect(r.movimentos[0].descricao).toBe("Juntada — Petição");
    expect(r.partes).toEqual([
      { nome: "Empresa Exemplo Ltda", polo: "ativo", advogados: ["Fulano de Tal (OAB 123/RJ)"] },
      { nome: "Estado do Rio de Janeiro", polo: "passivo", advogados: [] },
    ]);
  });
  it("sem DataJud, usa órgão e classe do DJEN", () => {
    const r = normalizarConsulta(parseNumeroCNJ(NUM)!, null, djen);
    expect(r.orgaoJulgador).toBe("Cartório da 17ª Vara");
    expect(r.origem.orgaoJulgador).toBe("DJEN");
  });
  it("avisa quando não há partes", () => {
    const r = normalizarConsulta(parseNumeroCNJ(NUM)!, datajud, { items: [] });
    expect(r.avisos.join(" ")).toMatch(/partes não foram encontradas/);
  });
  it("datas e nomes", () => {
    expect(dataISO("2003-12-01T00:00:00Z")).toBe("2003-12-01");
    expect(capitalizarNome("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(capitalizarNome("Já Formatado")).toBe("Já Formatado");
  });
});

describe("consultarProcesso", () => {
  it("se uma fonte cai, usa a outra e avisa", async () => {
    const r = await consultarProcesso(NUM, {
      datajud: () => Promise.reject(new Error("O DataJud está sobrecarregado no momento.")),
      djen: () => Promise.resolve(djen),
    });
    expect(r.partes).toHaveLength(2);
    expect(r.avisos[0]).toMatch(/DataJud: .*sobrecarregado/);
  });
  it("se as duas caem, explica o erro", async () => {
    await expect(consultarProcesso(NUM, {
      datajud: () => Promise.reject(new Error("fora")), djen: () => Promise.reject(new Error("fora")),
    })).rejects.toThrow(/Não foi possível consultar agora/);
  });
  it("número inválido nem consulta", async () => {
    await expect(consultarProcesso("123", { datajud: async () => ({}), djen: async () => ({}) })).rejects.toThrow(/Número inválido/);
  });
});
