import { db } from "@/lib/db";
import { hojeISO } from "@/lib/dates";

/**
 * Backup automático no Google Drive — regras puras e rastreamento de alterações.
 * O agendador em si fica em src/contexts/DriveBackupContext.tsx.
 */

const PENDENTE_KEY = "lexco_backup_pendente"; // timestamp (ms) da última alteração ainda não enviada
const prefKey = (userId: string) => `lexco_autobackup_${userId}`;

/** Espera este tempo sem novas alterações antes de enviar (agrupa várias edições). */
export const ESPERA_SEM_ALTERACOES_MS = 60_000;
/** Intervalo mínimo entre dois envios automáticos. */
export const INTERVALO_MINIMO_MS = 5 * 60_000;

// ---- alterações pendentes ----

export function pendenteDesde(): number | null {
  const v = Number(localStorage.getItem(PENDENTE_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function marcarPendente(agora = Date.now()) {
  localStorage.setItem(PENDENTE_KEY, String(agora));
}

/** Pede um envio no próximo ciclo (ex.: ao conectar ou ligar o automático). */
export function solicitarEnvioImediato(agora = Date.now()) {
  if (pendenteDesde() === null) marcarPendente(agora - ESPERA_SEM_ALTERACOES_MS);
}

/** Limpa só se não houve nova alteração durante o envio. */
export function limparPendente(marcaEnviada: number | null) {
  if (marcaEnviada !== null && pendenteDesde() === marcaEnviada) localStorage.removeItem(PENDENTE_KEY);
}

let rastreando = false;
/** Marca "pendente" a cada criação/edição/exclusão em qualquer tabela do banco. */
export function instalarRastreamento() {
  if (rastreando) return;
  rastreando = true;
  // Nunca deixa uma falha do localStorage abortar a gravação no banco.
  const marcar = () => {
    try {
      marcarPendente();
    } catch {
      /* ignora: no pior caso o próximo envio só acontece na próxima alteração */
    }
  };
  for (const table of db.tables) {
    table.hook("creating", marcar);
    table.hook("updating", marcar);
    table.hook("deleting", marcar);
  }
}

// ---- preferência (por usuário, neste computador) ----

/** Padrão: LIGADO (quem conecta o Google já sai com backup automático). */
export function autoBackupLigado(userId: string): boolean {
  return localStorage.getItem(prefKey(userId)) !== "off";
}

export function definirAutoBackup(userId: string, ligado: boolean) {
  localStorage.setItem(prefKey(userId), ligado ? "on" : "off");
}

// ---- decisão e nome do arquivo ----

export function deveEnviar(
  { pendente, ultimoEnvio, agora }: { pendente: number | null; ultimoEnvio: number | null; agora: number },
): boolean {
  if (pendente === null) return false;
  // Marcas "no futuro" = relógio do sistema foi ajustado para trás: não bloqueia.
  if (pendente <= agora && agora - pendente < ESPERA_SEM_ALTERACOES_MS) return false;
  if (ultimoEnvio !== null && ultimoEnvio <= agora && agora - ultimoEnvio < INTERVALO_MINIMO_MS) return false;
  return true;
}

/** Um arquivo automático por dia (o envio seguinte no mesmo dia o atualiza). */
export function nomeBackupAutomatico(agora = new Date()): string {
  return `lexco_auto_${hojeISO(agora)}.json`;
}
