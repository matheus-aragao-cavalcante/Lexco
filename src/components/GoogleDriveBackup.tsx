import { useState } from "react";
import { toast } from "sonner";
import { CloudUpload, CloudDownload, LogOut, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { parseBackup, type LexcoBackup } from "@/lib/backup";
import { formatBytes, getDesktopGoogle, googleDrive } from "@/lib/googleDrive";
import { useDriveBackup } from "@/contexts/DriveBackupContext";
import { EDICAO } from "@/lib/edicao";

interface Props {
  /** Entrega o backup baixado para a tela abrir o diálogo de restauração. */
  onRestore: (backup: LexcoBackup, origem: string) => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const automatico = (f: LexcoDriveFile) => f.name.startsWith("lexco_auto_");

/** Bloco "Google Drive" do Perfil: conexão, backup automático, envio manual e restauração. */
export function GoogleDriveBackup({ onRestore }: Props) {
  const b = useDriveBackup();
  const [files, setFiles] = useState<LexcoDriveFile[] | null>(null);
  const [listando, setListando] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<LexcoDriveFile | null>(null);

  if (!getDesktopGoogle()) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">
          A sincronização com o Google Drive está disponível no app de computador do Lexco.
        </p>
      </Section>
    );
  }
  if (!b.configurado) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">Integração com o Google não configurada nesta versão.</p>
      </Section>
    );
  }

  const openList = async () => {
    setListando(true);
    try {
      setFiles(await googleDrive.list());
    } catch (e) {
      toast.error(errMsg(e));
      b.atualizarStatus();
    } finally {
      setListando(false);
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

  if (!b.conectado) {
    return (
      <Section>
        <p className="text-xs text-muted-foreground">
          Conecte sua conta Google para guardar backups no <strong>seu</strong> Google Drive, na pasta
          "{EDICAO.nomeApp} Backups". O {EDICAO.nomeApp} só acessa os arquivos que ele mesmo cria.
        </p>
        {b.conectando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Aguardando autorização no navegador...
            <Button size="sm" variant="ghost" onClick={b.cancelarConexao}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" onClick={b.conectar}>Conectar conta Google</Button>
        )}
      </Section>
    );
  }

  return (
    <Section>
      <p className="text-sm text-foreground">
        Conectado como <strong>{b.email || "conta Google"}</strong>
      </p>

      <label className="flex items-center justify-between gap-3 max-w-md rounded-lg border border-border p-3 cursor-pointer">
        <span>
          <span className="block text-sm font-medium text-foreground">Backup automático</span>
          <span className="block text-xs text-muted-foreground">
            Envia sozinho após as alterações (um arquivo por dia, guarda os últimos 30 dias).
          </span>
        </span>
        <Switch checked={b.autoLigado} onCheckedChange={b.setAutoLigado} />
      </label>

      <p className="text-xs text-muted-foreground">
        {b.ultimoBackup ? `Último backup enviado deste computador: ${fmtDate(b.ultimoBackup)}` : "Nenhum backup enviado deste computador ainda."}
        {b.estado === "erro" && b.erro ? <span className="block text-destructive">Falha no último envio: {b.erro}</span> : null}
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={b.backupAgora} disabled={b.estado === "enviando"}>
          {b.estado === "enviando" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudUpload className="h-4 w-4 mr-1" />}
          Fazer backup agora
        </Button>
        <Button size="sm" variant="outline" onClick={openList} disabled={listando}>
          {listando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-1" />}
          Restaurar do Drive
        </Button>
        <Button size="sm" variant="ghost" onClick={b.desconectar}>
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
                  <p className="text-sm text-foreground">
                    {fmtDate(f.createdTime)}
                    <span className="ml-2 text-[10px] uppercase rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {automatico(f) ? "automático" : "manual"}
                    </span>
                  </p>
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
