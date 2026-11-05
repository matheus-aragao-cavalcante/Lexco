import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, CloudDownload, LogOut, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { backupFileName, createBackup, parseBackup, serializeBackup, type LexcoBackup } from "@/lib/backup";
import {
  formatBytes, getDesktopGoogle, getLastDriveSync, googleDrive, setLastDriveSync,
} from "@/lib/googleDrive";

interface Props {
  /** Entrega o backup baixado para a tela abrir o diálogo de restauração. */
  onRestore: (backup: LexcoBackup, origem: string) => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Bloco "Google Drive": conectar conta, sincronizar (enviar backup) e restaurar. */
export function GoogleDriveBackup({ onRestore }: Props) {
  const desktop = Boolean(getDesktopGoogle());
  const [status, setStatus] = useState<LexcoGoogleStatus | null>(null);
  const [busy, setBusy] = useState<"connect" | "sync" | "list" | "disconnect" | null>(null);
  const [lastSync, setLastSync] = useState(getLastDriveSync());
  const [files, setFiles] = useState<LexcoDriveFile[] | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<LexcoDriveFile | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await googleDrive.status());
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, []);

  useEffect(() => {
    if (desktop) refresh();
  }, [desktop, refresh]);

  if (!desktop) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">
          A sincronização com o Google Drive está disponível no app de computador do Lexco.
        </p>
      </Section>
    );
  }
  if (!status) {
    return (
      <Section>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Section>
    );
  }
  if (!status.configured) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">Integração com o Google não configurada nesta versão.</p>
      </Section>
    );
  }

  const connect = async () => {
    setBusy("connect");
    try {
      const s = await googleDrive.connect();
      setStatus(s);
      toast.success(`Conectado como ${s.email || "conta Google"}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const backup = await createBackup();
      const file = await googleDrive.upload(backupFileName(new Date(backup.createdAt)), serializeBackup(backup));
      setLastDriveSync(backup.createdAt);
      setLastSync(backup.createdAt);
      toast.success(`Backup enviado ao Google Drive (${formatBytes(file.size)})`);
    } catch (e) {
      toast.error(errMsg(e));
      refresh(); // pode ter sido desconectado (token revogado)
    } finally {
      setBusy(null);
    }
  };

  const openList = async () => {
    setBusy("list");
    try {
      setFiles(await googleDrive.list());
    } catch (e) {
      toast.error(errMsg(e));
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const restore = async (f: LexcoDriveFile) => {
    setRowBusy(f.id);
    try {
      const backup = parseBackup(await googleDrive.download(f.id));
      setFiles(null);
      onRestore(backup, `Google Drive · ${f.name}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRowBusy(null);
    }
  };

  const remove = async (f: LexcoDriveFile) => {
    setRowBusy(f.id);
    try {
      await googleDrive.remove(f.id);
      setFiles((list) => list?.filter((x) => x.id !== f.id) ?? null);
      toast.success("Backup excluído do Drive");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRowBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      setStatus(await googleDrive.disconnect());
      toast.success("Conta Google desconectada");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (!status.connected) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">
          Conecte sua conta Google para guardar backups no <strong>seu</strong> Google Drive, na pasta
          "Lexco Backups". O Lexco só acessa os arquivos que ele mesmo cria.
        </p>
        {busy === "connect" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Aguardando autorização no navegador...
            <Button size="sm" variant="ghost" onClick={() => googleDrive.cancelConnect().catch(() => {})}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={connect}>Conectar conta Google</Button>
        )}
      </Section>
    );
  }

  return (
    <Section>
      <p className="text-sm text-foreground">
        Conectado como <strong>{status.email || "conta Google"}</strong>
      </p>
      <p className="text-xs text-muted-foreground">
        {lastSync ? `Último backup enviado deste computador: ${fmtDate(lastSync)}` : "Nenhum backup enviado deste computador ainda."}
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={sync} disabled={!!busy}>
          {busy === "sync" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudUpload className="h-4 w-4 mr-1" />}
          Sincronizar agora
        </Button>
        <Button size="sm" variant="outline" onClick={openList} disabled={!!busy}>
          {busy === "list" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-1" />}
          Restaurar do Drive
        </Button>
        <Button size="sm" variant="ghost" onClick={disconnect} disabled={!!busy}>
          <LogOut className="h-4 w-4 mr-1" /> Desconectar
        </Button>
      </div>

      <Dialog open={files !== null} onOpenChange={(o) => !o && setFiles(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Backups no Google Drive</DialogTitle>
            <DialogDescription>Escolha a versão que deseja restaurar.</DialogDescription>
          </DialogHeader>
          {files?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum backup encontrado.</p>}
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {files?.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{fmtDate(f.createdTime)}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.name} · {formatBytes(f.size)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" disabled={!!rowBusy} onClick={() => restore(f)}>
                    {rowBusy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restaurar"}
                  </Button>
                  <Button size="icon" variant="ghost" disabled={!!rowBusy} onClick={() => setToDelete(f)} aria-label="Excluir backup">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir backup do Drive?"
        description={toDelete ? `O backup de ${fmtDate(toDelete.createdTime)} será excluído definitivamente do Google Drive (não vai para a lixeira).` : ""}
        confirmLabel="Excluir"
        onConfirm={async () => {
          const f = toDelete;
          setToDelete(null);
          if (f) await remove(f);
        }}
      />
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Google Drive</h3>
      {children}
    </div>
  );
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}
