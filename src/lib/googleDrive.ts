/**
 * Acesso ao Google Drive pelo React. Toda a comunicação com o Google acontece
 * no processo principal do Electron (electron/google.cjs); aqui só chamamos
 * as operações e convertemos { ok, error } em exceções.
 */

const LAST_SYNC_KEY = "lexco_drive_ultimo_backup";

export function getDesktopGoogle() {
  return window.lexcoDesktop?.google ?? null;
}

async function unwrap<T>(p: Promise<LexcoIpcResult<T>>): Promise<T> {
  const r = await p;
  if ("error" in r) throw new Error(r.error);
  return r.value;
}

function api() {
  const g = getDesktopGoogle();
  if (!g) throw new Error("Disponível apenas no app de computador.");
  return g;
}

export const googleDrive = {
  status: () => unwrap(api().status()),
  connect: () => unwrap(api().connect()),
  cancelConnect: () => unwrap(api().cancelConnect()),
  disconnect: () => unwrap(api().disconnect()),
  signOut: () => unwrap(api().signOut()),
  upload: (name: string, content: string, auto = false) => unwrap(api().upload(name, content, auto)),
  list: () => unwrap(api().list()),
  download: (id: string) => unwrap(api().download(id)),
  remove: (id: string) => unwrap(api().delete(id)),
};

export function getLastDriveSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function setLastDriveSync(iso: string) {
  localStorage.setItem(LAST_SYNC_KEY, iso);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
