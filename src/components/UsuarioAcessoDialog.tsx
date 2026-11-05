import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Copy, Loader2, ShieldCheck, Link2, Unlink, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { dbProprio } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { driveReal, useCompartilhamento } from "@/contexts/CompartilhamentoContext";
import { googleDrive, getDesktopGoogle } from "@/lib/googleDrive";
import { MODELOS_PERMISSAO, ROTULOS_PERMISSOES, permissoesDe, type Permissoes } from "@/lib/permissoes";
import { convidarUsuario, registrarResposta, revogarAcesso } from "@/lib/compartilhamento/sync";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

/** Permissões e acesso remoto de um usuário (tela do administrador). */
export function UsuarioAcessoDialog({ user, open, onOpenChange, onSaved }: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { usuarioLocal } = useAuth();
  const { sincronizarAgora } = useCompartilhamento();
  const [aba, setAba] = useState<"permissoes" | "remoto">("permissoes");
  const [perm, setPerm] = useState<Permissoes | null>(null);
  const [perfil, setPerfil] = useState<User["perfil"]>("advogado");
  const [status, setStatus] = useState<User["status"]>("ativo");
  const [emailGoogle, setEmailGoogle] = useState("");
  const [convite, setConvite] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmRevogar, setConfirmRevogar] = useState(false);
  const [atual, setAtual] = useState<User | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setAtual(user);
    setPerm(permissoesDe(user));
    setPerfil(user.perfil);
    setStatus(user.status);
    setEmailGoogle(user.acessoRemoto?.emailGoogle || user.contaGoogle || user.email);
    setConvite(null);
    setResposta("");
    setAba("permissoes");
  }, [open, user]);

  if (!user || !perm || !atual) return null;
  const ehVoce = user.id === usuarioLocal?.id;
  const ehAdmin = perfil === "admin";
  const acesso = atual.acessoRemoto;

  const salvar = async () => {
    if (ehVoce && (perfil !== "admin" || status !== "ativo")) {
      toast.error("Você não pode tirar o seu próprio acesso de administrador.");
      return;
    }
    await dbProprio.users.update(user.id, { permissoes: perm, perfil, status, atualizadoEm: new Date().toISOString() });
    toast.success(acesso ? "Permissões salvas. O acesso remoto é atualizado na próxima sincronização." : "Permissões salvas");
    onSaved();
    if (acesso) sincronizarAgora();
    onOpenChange(false);
  };

  const gerarConvite = async () => {
    setOcupado(true);
    try {
      // Grava as permissões antes: o primeiro pacote já sai com elas.
      await dbProprio.users.update(user.id, { permissoes: perm, perfil, status });
      const st = await googleDrive.status();
      if (!st.connected) throw new Error("Conecte a sua conta Google (Perfil → Backup) antes de convidar.");
      const codigo = await convidarUsuario(dbProprio, driveReal, user.id, {
        nome: usuarioLocal?.nome || "Administrador", email: st.email, escritorio: usuarioLocal?.nomeEscritorio,
      }, emailGoogle.trim().toLowerCase());
      setConvite(codigo);
      setAtual((await dbProprio.users.get(user.id)) ?? atual);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o convite");
    } finally {
      setOcupado(false);
    }
  };

  const colarResposta = async () => {
    try {
      const u = await registrarResposta(dbProprio, resposta);
      if (u.id !== user.id) { toast.error("Este código de resposta é de outro usuário."); return; }
      setAtual(u);
      setResposta("");
      toast.success("Pronto! As alterações deste usuário passam a chegar aqui.");
      onSaved();
      sincronizarAgora();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    }
  };

  const revogar = async () => {
    setOcupado(true);
    try {
      await revogarAcesso(dbProprio, driveReal, user.id);
      setAtual((await dbProprio.users.get(user.id)) ?? atual);
      toast.success("Acesso remoto encerrado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível revogar");
    } finally {
      setOcupado(false);
      setConfirmRevogar(false);
    }
  };

  const copiar = async (t: string) => { await navigator.clipboard.writeText(t).catch(() => {}); toast.success("Código copiado"); };
  const check = (k: keyof Permissoes) => (
    <input type="checkbox" checked={!!perm[k]} disabled={ehAdmin}
      onChange={(e) => setPerm({ ...perm, [k]: e.target.checked })} className="mt-0.5" />
  );
  const recusadas = (acesso?.resultados || []).filter((r) => r.status !== "aplicada" && r.motivo).slice(-5).reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{user.nome}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border">
          {([["permissoes", "Permissões"], ["remoto", "Acesso de outro computador"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setAba(id)}
              className={cn("px-4 py-2 text-sm border-b-2 -mb-px", aba === id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground")}>{l}</button>
          ))}
        </div>

        {aba === "permissoes" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Perfil</span>
                <select value={perfil} onChange={(e) => setPerfil(e.target.value as User["perfil"])} disabled={ehVoce}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="admin">Admin</option><option value="advogado">Advogado</option><option value="colaborador">Colaborador</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Situação</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as User["status"])} disabled={ehVoce}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="ativo">Ativo</option><option value="inativo">Inativo (bloqueia o acesso)</option>
                </select>
              </label>
            </div>
            {ehAdmin ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Administradores têm acesso total.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {MODELOS_PERMISSAO.map((m) => (
                    <button key={m.id} type="button" title={m.descricao} onClick={() => setPerm(m.permissoes)}
                      className="px-2.5 py-1 rounded-full border border-border text-xs hover:border-primary hover:text-primary">{m.nome}</button>
                  ))}
                </div>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {ROTULOS_PERMISSOES.map((r) => (
                    <label key={r.chave} className="flex items-start gap-3 p-2.5 text-sm cursor-pointer">
                      {check(r.chave)}
                      <span><span className="text-foreground">{r.rotulo}</span>{r.dica && <span className="block text-xs text-muted-foreground">{r.dica}</span>}</span>
                    </label>
                  ))}
                  <div className="flex items-center gap-3 p-2.5 text-sm">
                    <span className="flex-1 text-foreground">Tarefas</span>
                    <select value={perm.tarefas} onChange={(e) => setPerm({ ...perm, tarefas: e.target.value as Permissoes["tarefas"] })}
                      className="h-8 px-2 rounded border border-input bg-background text-sm">
                      <option value="nenhum">Sem acesso</option><option value="ver">Só ver</option><option value="editar">Criar, editar e concluir</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 p-2.5 text-sm">
                    <span className="flex-1 text-foreground">Documentos e fotos</span>
                    <select value={perm.documentos} onChange={(e) => setPerm({ ...perm, documentos: e.target.value as Permissoes["documentos"] })}
                      className="h-8 px-2 rounded border border-input bg-background text-sm">
                      <option value="nenhum">Sem acesso</option><option value="ver">Só ver</option><option value="anexar">Ver e anexar</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  No acesso de outro computador estas regras valem nos dados: o que estiver bloqueado não é enviado e qualquer alteração proibida é recusada aqui.
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        )}

        {aba === "remoto" && (
          <div className="space-y-4">
            {!getDesktopGoogle() ? (
              <p className="text-sm text-muted-foreground">Disponível no app de computador.</p>
            ) : ehAdmin ? (
              <p className="text-sm text-muted-foreground">Para dar acesso remoto, escolha um perfil que não seja Admin.</p>
            ) : (
              <>
                <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                  {!acesso && <p className="flex items-center gap-1.5 text-muted-foreground"><Unlink className="h-4 w-4" /> Sem acesso remoto.</p>}
                  {acesso && !acesso.caixaId && <p className="flex items-center gap-1.5 text-warning"><Clock className="h-4 w-4" /> Convite gerado em {new Date(acesso.convidadoEm).toLocaleString("pt-BR")} — aguardando o código de resposta.</p>}
                  {acesso?.caixaId && (
                    <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> Conectado.
                      {acesso.ultimaLeitura && <span className="text-muted-foreground"> Última alteração recebida: {new Date(acesso.ultimaLeitura).toLocaleString("pt-BR")}.</span>}
                    </p>
                  )}
                </div>

                <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-0.5">
                  <li>Gere o código de convite e envie ao usuário (WhatsApp, e-mail...). Trate-o como uma senha.</li>
                  <li>No computador dele: menu do usuário → <em>Tenho um código de convite</em>.</li>
                  <li>Ele devolve um código de resposta: cole abaixo. Pronto.</li>
                </ol>

                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Conta Google do usuário (para ver os documentos no Drive)</span>
                  <input value={emailGoogle} onChange={(e) => setEmailGoogle(e.target.value)} type="email"
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm" />
                </label>

                <Button onClick={gerarConvite} disabled={ocupado} variant={acesso ? "outline" : "default"}>
                  {ocupado ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                  {acesso ? "Gerar novo convite (invalida o anterior)" : "Gerar código de convite"}
                </Button>

                {convite && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Código de convite</p>
                    <div className="flex gap-2">
                      <code className="flex-1 text-[11px] bg-muted rounded p-2 break-all max-h-28 overflow-y-auto">{convite}</code>
                      <Button size="icon" variant="outline" onClick={() => copiar(convite)} aria-label="Copiar"><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}

                {acesso && (
                  <div className="space-y-1.5">
                    <p className="text-sm text-foreground">{acesso.caixaId ? "Código de resposta (só se o usuário entrar de novo)" : "Código de resposta do usuário"}</p>
                    <div className="flex gap-2">
                      <input value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="LXR1-..."
                        className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-xs font-mono" />
                      <Button onClick={colarResposta} disabled={!resposta.trim()}>Confirmar</Button>
                    </div>
                  </div>
                )}

                {recusadas.length > 0 && (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-warning" /> Alterações recusadas recentemente</p>
                    {recusadas.map((r) => <p key={r.opId} className="text-muted-foreground">{new Date(r.em).toLocaleString("pt-BR")} — {r.motivo}</p>)}
                  </div>
                )}

                {acesso && (
                  <div className="pt-2 border-t border-border">
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmRevogar(true)} disabled={ocupado}>
                      <Unlink className="h-4 w-4 mr-1" /> Revogar acesso remoto
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmRevogar}
          onOpenChange={setConfirmRevogar}
          title="Revogar acesso remoto?"
          description={`${user.nome} deixa de receber os dados e de enviar alterações. A pasta de documentos deixa de ser compartilhada com ele. O que já estava no computador dele é apagado na próxima vez que o Lexco dele sincronizar.`}
          confirmLabel="Revogar"
          onConfirm={revogar}
        />
      </DialogContent>
    </Dialog>
  );
}
