import { useNavigate } from "react-router-dom";
import { Cloud, CloudOff, CloudUpload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useDriveBackup } from "@/contexts/DriveBackupContext";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Nuvem no topo: estado do backup no Google Drive + liga/desliga do backup automático. */
export function BackupStatusButton() {
  const b = useDriveBackup();
  const navigate = useNavigate();
  if (!b.disponivel || !b.configurado) return null;

  const visual = !b.conectado
    ? { icon: CloudOff, cor: "text-muted-foreground", ponto: "", titulo: "Backup desconectado" }
    : b.estado === "enviando"
      ? { icon: Loader2, cor: "text-primary animate-spin", ponto: "", titulo: "Enviando backup..." }
      : b.estado === "erro"
        ? { icon: Cloud, cor: "text-muted-foreground", ponto: "bg-destructive", titulo: "Falha no último backup" }
        : !b.autoLigado
          ? { icon: CloudOff, cor: "text-muted-foreground", ponto: "", titulo: "Backup automático desligado" }
          : b.pendente
            ? { icon: Cloud, cor: "text-muted-foreground", ponto: "bg-warning", titulo: "Alterações aguardando backup" }
            : { icon: Cloud, cor: "text-success", ponto: "", titulo: "Backup em dia" };
  const Icone = visual.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={visual.titulo} title={visual.titulo}>
          <Icone className={`h-5 w-5 ${visual.cor}`} />
          {visual.ponto && <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${visual.ponto}`} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Backup no Google Drive</p>
          <p className="text-xs text-muted-foreground truncate">
            {b.conectado ? `Conectado como ${b.email}` : "Nenhuma conta Google conectada"}
          </p>
        </div>

        {!b.conectado ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Conecte sua conta Google para guardar cópias de segurança automáticas no seu Drive.
            </p>
            {b.conectando ? (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Aguardando o navegador...</span>
                <Button size="sm" variant="ghost" onClick={b.cancelarConexao}>Cancelar</Button>
              </div>
            ) : (
              <Button size="sm" className="w-full" onClick={b.conectar}>Conectar Google Drive</Button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-foreground">Backup automático</span>
                <span className="block text-xs text-muted-foreground">Envia sozinho após cada alteração</span>
              </span>
              <Switch checked={b.autoLigado} onCheckedChange={b.setAutoLigado} />
            </label>

            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <p className="flex items-center gap-1.5 text-foreground">
                {b.estado === "erro" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <CheckCircle2 className={`h-3.5 w-3.5 ${b.pendente ? "text-warning" : "text-success"}`} />
                )}
                {b.estado === "enviando"
                  ? "Enviando..."
                  : b.estado === "erro"
                    ? "Falha no último envio"
                    : b.pendente
                      ? b.autoLigado ? "Alterações serão enviadas em instantes" : "Há alterações sem backup"
                      : "Tudo salvo no Drive"}
              </p>
              {b.estado === "erro" && b.erro && <p className="text-destructive">{b.erro}</p>}
              <p className="text-muted-foreground">
                Último backup: {b.ultimoBackup ? fmt(b.ultimoBackup) : "nenhum ainda"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={b.backupAgora} disabled={b.estado === "enviando"}>
                <CloudUpload className="h-4 w-4 mr-1" /> Fazer backup agora
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/perfil?aba=exportar")}>
                Gerenciar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
