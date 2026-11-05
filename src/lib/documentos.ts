/** Validação e máscara de CPF e CNPJ (dígitos verificadores oficiais). */

export const somenteDigitos = (v: string) => (v || "").replace(/\D/g, "");

export function validarCPF(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/**
 * CNPJ normalizado: letras maiúsculas e dígitos. Desde julho/2026 a Receita
 * emite CNPJ alfanumérico (IN RFB 2.229/2024): 12 primeiros caracteres A–Z/0–9
 * e os 2 dígitos verificadores numéricos.
 */
export const normalizarCNPJ = (v: string) => (v || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

export function validarCNPJ(valor: string): boolean {
  const d = normalizarCNPJ(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  // Valor de cada caractere = código ASCII − 48 (para dígitos, o próprio dígito).
  const val = (c: string) => c.charCodeAt(0) - 48;
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + val(d[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Aplica a máscara progressivamente, enquanto o usuário digita. */
export function mascararCPF(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function mascararCNPJ(valor: string): string {
  const d = normalizarCNPJ(valor).slice(0, 14);
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = partes[0];
  if (partes[1]) out += "." + partes[1];
  if (partes[2]) out += "." + partes[2];
  if (partes[3]) out += "/" + partes[3];
  if (partes[4]) out += "-" + partes[4];
  return out;
}

export type TipoDocumento = "cpf" | "cnpj";

/** PF usa CPF; PJ, órgão público e entidade usam CNPJ. */
export function tipoDocumentoDe(tipoPessoa: string): TipoDocumento {
  return tipoPessoa === "Pessoa Física" ? "cpf" : "cnpj";
}

/**
 * Mensagem de erro do documento, ou null se estiver ok.
 * Campo vazio é aceito (o documento é opcional).
 */
export function erroDocumento(tipo: TipoDocumento, valor: string | undefined): string | null {
  const d = tipo === "cpf" ? somenteDigitos(valor || "") : normalizarCNPJ(valor || "");
  if (!d) return null;
  if (tipo === "cpf") {
    if (d.length !== 11) return "O CPF deve ter 11 dígitos.";
    return validarCPF(d) ? null : "CPF inválido — confira os dígitos.";
  }
  const c = normalizarCNPJ(valor || "");
  if (c.length !== 14) return "O CNPJ deve ter 14 caracteres.";
  return validarCNPJ(c) ? null : "CNPJ inválido — confira os dígitos.";
}

export function mascararDocumento(tipo: TipoDocumento, valor: string): string {
  return tipo === "cpf" ? mascararCPF(valor) : mascararCNPJ(valor);
}
