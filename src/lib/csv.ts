/**
 * CSV no padrão do Excel em português: separador ";" (o Excel pt-BR usa
 * vírgula como decimal, então "," jogaria tudo numa coluna só).
 */
export const CSV_SEP = ";";

/**
 * Uma célula CSV segura:
 *  - aspas internas duplicadas ("" ) e valor entre aspas;
 *  - valores que começam com = + - @ (ou tab/CR) ganham um apóstrofo, para a
 *    planilha não executá-los como fórmula ("CSV injection").
 */
export function csvCelula(valor: unknown): string {
  let s = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Linha CSV terminada em \n. */
export function csvLinha(valores: unknown[]): string {
  return valores.map(csvCelula).join(CSV_SEP) + "\n";
}
