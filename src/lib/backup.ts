import { dbProprio as db } from "@/lib/db";
// Backup e restauração SEMPRE no banco próprio (nunca no de um ambiente compartilhado).

/**
 * Backup completo do banco local (Dexie).
 *
 * Usado pelo backup em arquivo (Perfil > Importar/Exportar) e pela
 * sincronização com o Google Drive. Inclui usuários (com hash de senha)
 * e o conteúdo dos anexos, para que uma restauração em outro computador
 * deixe o sistema exatamente como estava.
 */

export const BACKUP_FORMAT = "lexco-backup";
export const BACKUP_VERSION = 1;

const TABLES = [
  "users",
  "processos",
  "partes",
  "vinculos",
  "eventos",
  "prazos",
  "arquivos",
  "historico",
] as const;

type TableName = (typeof TABLES)[number];

export interface LexcoBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  tables: Record<TableName, unknown[]>;
}

export async function createBackup(): Promise<LexcoBackup> {
  return db.transaction("r", TABLES.map((t) => db.table(t)), async () => {
    const entries = await Promise.all(TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      tables: Object.fromEntries(entries) as LexcoBackup["tables"],
    };
  });
}

export function serializeBackup(backup: LexcoBackup): string {
  return JSON.stringify(backup);
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `lexco_backup_${stamp}.json`;
}

/**
 * Converte o JSON lido em um backup válido. Aceita também o formato antigo
 * (exportado antes desta versão: { user, processos, partes, ... }).
 */
export function parseBackup(text: string): LexcoBackup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON externo, validado campo a campo abaixo
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Arquivo de backup inválido.");

  if (raw.format === BACKUP_FORMAT) {
    if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) {
      throw new Error("Este backup foi gerado por uma versão mais nova do Lexco.");
    }
    // Todas as tabelas precisam estar presentes: um backup truncado não pode
    // ser aceito, senão "substituir" apagaria as tabelas que faltam.
    const tables = {} as LexcoBackup["tables"];
    for (const t of TABLES) {
      const rows = raw.tables?.[t];
      if (!Array.isArray(rows)) throw new Error(`Backup incompleto ou corrompido (tabela "${t}" ausente).`);
      tables[t] = validarLinhas(t, rows);
    }
    return { format: BACKUP_FORMAT, version: raw.version, createdAt: String(raw.createdAt ?? ""), tables };
  }

  // Formato legado.
  const legacyKeys = ["processos", "partes", "vinculos", "eventos", "prazos", "historico"];
  if (!legacyKeys.some((k) => Array.isArray(raw[k]))) throw new Error("Arquivo de backup inválido.");
  const legacy = (k: string): unknown[] => {
    const v = raw[k] ?? [];
    if (!Array.isArray(v)) throw new Error(`Backup inválido (campo "${k}").`);
    return v;
  };
  return {
    format: BACKUP_FORMAT,
    version: 0, // legado: só pode ser mesclado (ver isLegacyBackup)
    createdAt: "",
    tables: {
      users: validarLinhas("users", raw.user ? [raw.user] : []),
      processos: validarLinhas("processos", legacy("processos")),
      partes: validarLinhas("partes", legacy("partes")),
      vinculos: validarLinhas("vinculos", legacy("vinculos")),
      eventos: validarLinhas("eventos", legacy("eventos")),
      prazos: validarLinhas("prazos", legacy("prazos")),
      // Backups legados não tinham o conteúdo dos anexos; só restaura os que têm.
      arquivos: validarLinhas("arquivos", legacy("arquivos").filter((a) => (a as { dados?: unknown } | null)?.dados)),
      historico: validarLinhas("historico", legacy("historico")),
    },
  };
}

/** Rejeita o backup inteiro se alguma linha não for um registro com id. */
function validarLinhas(tabela: string, rows: unknown[]): unknown[] {
  rows.forEach((r, i) => {
    if (!r || typeof r !== "object" || typeof (r as { id?: unknown }).id !== "string" || !(r as { id: string }).id) {
      throw new Error(`Backup corrompido: registro ${i + 1} da tabela "${tabela}" é inválido.`);
    }
  });
  return rows;
}

/**
 * Backups do formato antigo não têm todos os usuários nem o conteúdo dos anexos.
 * "Substituir" com eles apagaria dados que o backup não contém, então só mesclam.
 */
export function isLegacyBackup(backup: LexcoBackup): boolean {
  return backup.version < 1;
}

export function backupStats(backup: LexcoBackup) {
  return {
    processos: backup.tables.processos.length,
    partes: backup.tables.partes.length,
    prazos: backup.tables.prazos.length,
    eventos: backup.tables.eventos.length,
    arquivos: backup.tables.arquivos.length,
    usuarios: backup.tables.users.length,
  };
}

/**
 * Restaura um backup.
 *  - "substituir": apaga tudo e deixa o banco igual ao backup.
 *  - "mesclar": mantém o que existe e sobrescreve registros com o mesmo id.
 * Tudo roda em uma transação: se algo falhar, nada é alterado.
 */
export async function restoreBackup(backup: LexcoBackup, mode: "substituir" | "mesclar"): Promise<void> {
  if (mode === "substituir" && isLegacyBackup(backup)) {
    throw new Error("Backups do formato antigo só podem ser mesclados.");
  }
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const table = db.table(t);
      if (mode === "substituir") await table.clear();
      const rows = backup.tables[t];
      if (rows.length) await table.bulkPut(rows);
    }
  });
}
