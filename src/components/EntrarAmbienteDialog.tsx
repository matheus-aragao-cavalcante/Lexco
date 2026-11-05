import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, CheckCircle2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { driveReal } from "@/contexts/CompartilhamentoContext";
import { googleDrive, getDesktopGoogle } from "@/lib/googleDrive";
import { aceitarConvite } from "@/lib/compartilhamento/sync";

/**
 * Convidado: cola o código recebido do administrador. O app cria a "caixa de
 * alterações" no Drive do convidado e mostra o código de resposta para devolver.
 */
export function EntrarAmbienteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { usuarioLocal, recarregarAmbientes, entrarAmbiente } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [resposta, setResposta] = useState<{ codigo: string; ambienteId: string; dono: string } | null>(null);
  const [conectado, setConectado] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setCodigo(""); setResposta(null);
    if (getDesktopGoogle()) googleDrive.status().then((s) => setConectado(s.connected)).catch(() => setConectado(false));
  }, [open]);

  const conectar = async () => {
    try {
      const r = await googleDrive.connect();
      setConectado(r.connected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conectar");
    }
  };

  const aceitar = async () => {
    if (!usuarioLocal) return;
    setProcessando(true);
    try {
      const r = await aceitarConvite(driveReal, usuarioLocal.id, codigo);
      recarregarAmbientes();
      setResposta({ codigo: r.codigoResposta, ambienteId: r.ambiente.id, dono: r.ambiente.donoNome });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível usar o convite");
    } finally {
      setProcessando(false);
    }
  };

  const copiar = async () => {
    if (!resposta) return;
    await navigator.clipboard.writeText(resposta.codigo).catch(() => {});
    toast.success("Código de resposta copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Entrar em ambiente compartilhado</DialogTitle>
          <DialogDescription>
            Use o código de convite que o administrador do outro escritório enviou para você.
          </DialogDescription>
        </DialogHeader>

        {!getDesktopGoogle() ? (
          <p className="text-sm text-muted-foreground">Disponível no app de computador.</p>
        ) : !resposta ? (
          <div className="space-y-4">
            {conectado === false && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
                <p>Para enviar as suas alterações ao administrador, o Lexco usa a sua conta Google (um arquivo cifrado no seu Drive).</p>
                <Button size="sm" variant="outline" onClick={conectar}>Conectar conta Google</Button>
              </div>
            )}
            <textarea value={codigo} onChange={(e) => setCodigo(e.target.value)} rows={4} placeholder="LXC1-..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono break-all focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={aceitar} disabled={processando || !codigo.trim() || conectado === false}>
                {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Usar convite
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span>Convite aceito! Você já pode ver o ambiente de <strong>{resposta.dono}</strong>.</span>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-foreground font-medium">Último passo: envie este código de resposta ao administrador</p>
              <p className="text-xs text-muted-foreground">Até ele colar o código, você consegue ver os dados, mas as suas alterações ficam aguardando.</p>
              <div className="flex gap-2">
                <code className="flex-1 text-[11px] bg-muted rounded p-2 break-all max-h-24 overflow-y-auto">{resposta.codigo}</code>
                <Button size="icon" variant="outline" onClick={copiar} aria-label="Copiar"><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { entrarAmbiente(resposta.ambienteId); onOpenChange(false); }}>
                <LogIn className="h-4 w-4 mr-1" /> Abrir ambiente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
