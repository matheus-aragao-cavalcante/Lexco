import { describe, it, expect } from "vitest";
import { validarCPF, validarCNPJ, mascararCPF, mascararCNPJ, erroDocumento, tipoDocumentoDe } from "@/lib/documentos";

describe("CPF", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
  });
  it("recusa dígito verificador errado e sequências repetidas", () => {
    expect(validarCPF("529.982.247-24")).toBe(false);
    expect(validarCPF("111.111.111-11")).toBe(false);
    expect(validarCPF("123")).toBe(false);
  });
  it("aplica máscara progressiva", () => {
    expect(mascararCPF("529")).toBe("529");
    expect(mascararCPF("5299822")).toBe("529.982.2");
    expect(mascararCPF("52998224725999")).toBe("529.982.247-25");
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ numérico válido", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11222333000181")).toBe(true);
  });
  it("aceita CNPJ alfanumérico (exemplo oficial da Receita)", () => {
    expect(validarCNPJ("12.ABC.345/01DE-35")).toBe(true);
    expect(validarCNPJ("12abc34501de35")).toBe(true);
  });
  it("recusa CNPJ inválido", () => {
    expect(validarCNPJ("11.222.333/0001-82")).toBe(false);
    expect(validarCNPJ("00.000.000/0000-00")).toBe(false);
    expect(validarCNPJ("12.ABC.345/01DE-3A")).toBe(false);
  });
  it("aplica máscara", () => {
    expect(mascararCNPJ("11222333000181")).toBe("11.222.333/0001-81");
    expect(mascararCNPJ("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(mascararCNPJ("112")).toBe("11.2");
  });
});

describe("erroDocumento", () => {
  it("documento vazio é aceito (opcional)", () => {
    expect(erroDocumento("cpf", "")).toBeNull();
    expect(erroDocumento("cnpj", undefined)).toBeNull();
  });
  it("devolve mensagens claras", () => {
    expect(erroDocumento("cpf", "123")).toMatch(/11 dígitos/);
    expect(erroDocumento("cpf", "529.982.247-24")).toMatch(/inválido/);
    expect(erroDocumento("cnpj", "11.222.333/0001-81")).toBeNull();
  });
  it("PF usa CPF; demais tipos usam CNPJ", () => {
    expect(tipoDocumentoDe("Pessoa Física")).toBe("cpf");
    expect(tipoDocumentoDe("Pessoa Jurídica")).toBe("cnpj");
    expect(tipoDocumentoDe("Órgão Público")).toBe("cnpj");
  });
});
