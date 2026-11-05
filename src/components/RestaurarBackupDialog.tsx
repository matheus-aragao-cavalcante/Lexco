import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { backupStats, isLegacyBackup, restoreBackup, type LexcoBackup } from "@/lib/backup";

interface Props {
  backup: LexcoBackup | null;
  /** Ex.: "arquivo lexco_backup_2026-11-04.json" ou "Google Drive". */
  origem?: string;
  onOpenChange: (open: boolean) => void;
}

/** Confirma a restauração de um backup, oferecendo mesclar ou substituir os dados atuais. */
export function RestaurarBackupDialog({ backup, origem, onOpenChange }: Props) {
  const [running, setRunning] = useState(false);
  const stats = backup ? backupStats(backup) : null;
  const legado = backup ? isLegacyBackup(backup) : false;
  const quando = backup?.createdAt ? new Date(backup.createdAt).toLocaleString("pt-BR") : "data desconhecida";

  const run = async (mode: "substituir" | "mesclar") => {
    if (!backup) return;
    setRunning(true);
    try {
      await restoreBackup(backup, mode);
      toast.success("Backup restaurado! Recarregando...");
      // Recarrega para que sessão, tema e listas reflitam os dados restaurados.
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao restaurar o backup. Nenhum dado foi alterado.");
      setRunning(false);
    }
  };

  return (
    <AlertDialog open={!!backup} onOpenChange={(o) => !running && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Restaurar backup
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Backup de <strong>{quando}</strong>
                {origem ? <> ({origem})</> : null}.
              </p>
              {stats && (
                <p>
                  {stats.processos} processos · {stats.partes} partes · {stats.prazos} prazos · {stats.eventos} eventos ·{" "}
                  {stats.arquivos} anexos · {stats.usuarios} usuários
                </p>
              )}
              <p>
                <strong>Mesclar</strong>: mantém os dados atuais e atualiza/adiciona os do backup.
                <br />
                <strong>Substituir</strong>: apaga tudo deste computador e deixa igual ao backup.
              </p>
              {legado && (
                <p className="text-warning">
                  Este backup é do formato antigo (sem anexos e sem os demais usuários), por isso só pode ser mesclado.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancelar</AlertDialogCancel>
          <Button variant="outline" disabled={running} onClick={() => run("mesclar")}>
            Mesclar
          </Button>
          <Button variant="destructive" disabled={running || legado} onClick={() => run("substituir")}>
            Substituir tudo
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
