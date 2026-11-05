/**
 * Datas "de calendário" (YYYY-MM-DD) sempre no fuso LOCAL do computador.
 *
 * Não use `new Date().toISOString().slice(0, 10)`: isso devolve a data em UTC,
 * e no Brasil (UTC-3) depois das 21h o "hoje" vira amanhã — prazos apareceriam
 * como vencidos/no dia errado.
 */
import type { Prazo } from "@/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Converte um Date em YYYY-MM-DD no fuso local. */
export function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hoje (YYYY-MM-DD, fuso local). */
export function hojeISO(agora = new Date()): string {
  return toISODateLocal(agora);
}

/** Soma dias de calendário a uma data YYYY-MM-DD (sem efeito de horário de verão). */
export function somarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODateLocal(new Date(y, m - 1, d + dias));
}

/** YYYY-MM-DD → DD/MM/AAAA (sem passar por Date, para não deslocar o dia). */
export function formatarData(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/**
 * Status considerando a data: um prazo não cumprido com data já passada
 * é "atrasado", mesmo que esteja salvo como "pendente"/"urgente".
 */
export function statusEfetivoPrazo(p: Pick<Prazo, "status" | "dataLimite">, hoje = hojeISO()): Prazo["status"] {
  if (p.status === "cumprido") return "cumprido";
  if (p.dataLimite && p.dataLimite < hoje) return "atrasado";
  return p.status;
}
