import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db, dbProprio } from "@/lib/db";
import { getDesktopGoogle, googleDrive } from "@/lib/googleDrive";
import {
  AcessoRevogadoError, atualizarAmbiente, removerAmbienteLocal, sincronizarComoConvidado, sincronizarComoDono,
  opsPendentes, type DriveTroca,
} from "@/lib/compartilhamento/sync";

/** Adaptador do Drive real (processo principal do Electron). */
export const driveReal: DriveTroca = {
  publicar: (id, nome, conteudo) => googleDrive.sharePublish(id, nome, conteudo),
  ler: (id) => googleDrive.shareRead(id),
  remover: (id) => googleDrive.shareDelete(id),
  compartilharDocumentos: (email, permitir) => googleDrive.docsCompartilhar(email, permitir),
};

const CICLO_DONO_MS = 45_000;
const CICLO_CONVIDADO_MS = 30_000;

interface Estado {
  papel: "nenhum" | "dono" | "convidado";
  sincronizando: boolean;
  ultimaSync: string | null;
  erro: string | null;
  /** Chegaram dados novos que a tela atual ainda não mostra. */
  novidades: string | null;
  pendentes: number;
  googleConectado: boolean;
}

interface Ctx extends Estado {
  sincronizarAgora: () => Promise<void>;
  marcarVisto: () => void;
}

const C = createContext<Ctx | null>(null);

export function CompartilhamentoProvider({ children }: { children: ReactNode }) {
  const { usuarioLocal, ambiente, podeGerenciarUsuarios, entrarAmbiente, recarregarAmbientes, atualizarAmbienteAtual } = useAuth();
  const desktop = !!getDesktopGoogle();
  const [estado, setEstado] = useState<Estado>({
    papel: "nenhum", sincronizando: false, ultimaSync: null, erro: null, novidades: null, pendentes: 0, googleConectado: false,
  });
  const rodando = useRef(false);
  const ultimoPacote = useRef<string | null>(null);

  const papel: Estado["papel"] = !desktop || !usuarioLocal ? "nenhum" : ambiente ? "convidado" : podeGerenciarUsuarios ? "dono" : "nenhum";

  const ciclo = useCallback(async (manual = false) => {
    if (rodando.current || papel === "nenhum" || !usuarioLocal) return;
    rodando.current = true;
    setEstado((e) => ({ ...e, papel, sincronizando: manual }));
    try {
      const status = await googleDrive.status().catch(() => null);
      const conectado = !!status?.connected;
      if (papel === "dono") {
        if (!conectado) { setEstado((e) => ({ ...e, googleConectado: false })); return; }
        const temConvidados = (await dbProprio.users.toArray()).some((u) => u.acessoRemoto);
        if (!temConvidados) { setEstado((e) => ({ ...e, googleConectado: true, erro: null })); return; }
        const r = await sincronizarComoDono(dbProprio, driveReal, {
          nome: usuarioLocal.nome, email: status!.email, escritorio: usuarioLocal.nomeEscritorio,
        });
        setEstado((e) => ({
          ...e, googleConectado: true, ultimaSync: new Date().toISOString(),
          erro: r.erros.length ? r.erros.join(" · ") : null,
          novidades: r.aplicadas > 0 ? `${r.aplicadas} alteração(ões) recebida(s) de usuários convidados` : e.novidades,
        }));
        if (manual) toast.success(`Sincronizado: ${r.convidados} convidado(s), ${r.aplicadas} alteração(ões) recebida(s).`);
      } else if (papel === "convidado" && ambiente) {
        // Ler o pacote não exige login; enviar alterações exige a conta Google conectada.
        const pendentes = opsPendentes(ambiente.id).length;
        if (pendentes && !conectado) {
          setEstado((e) => ({ ...e, googleConectado: false, pendentes, erro: "Conecte sua conta Google (Perfil → Backup) para enviar suas alterações." }));
        }
        const driveParaUso: DriveTroca = conectado ? driveReal : { ...driveReal, publicar: async (id) => id || "" };
        const r = await sincronizarComoConvidado(db, conectado ? driveReal : driveParaUso, ambiente);
        const amb = { ...ambiente, ultimaSync: new Date().toISOString(), permissoes: r.pacote.permissoes, perfil: r.pacote.voce.perfil, voceNome: r.pacote.voce.nome };
        atualizarAmbiente(usuarioLocal.id, amb);
        atualizarAmbienteAtual(amb);
        for (const x of r.recusadas) toast.warning(`Uma alteração sua não foi aceita pelo administrador: ${x.resultado.motivo}`, { duration: 10_000 });
        const mudou = ultimoPacote.current !== null && ultimoPacote.current !== r.pacote.geradoEm;
        ultimoPacote.current = r.pacote.geradoEm;
        setEstado((e) => ({
          ...e, googleConectado: conectado, ultimaSync: amb.ultimaSync, pendentes: opsPendentes(ambiente.id).length,
          erro: conectado || !opsPendentes(ambiente.id).length ? null : e.erro,
          novidades: mudou ? `Dados atualizados por ${ambiente.donoNome}` : e.novidades,
        }));
        if (manual) toast.success("Ambiente sincronizado");
      }
    } catch (e) {
      if (e instanceof AcessoRevogadoError && ambiente && usuarioLocal) {
        toast.error(`${e.message} (${ambiente.donoNome})`, { duration: 15_000 });
        entrarAmbiente(null);
        await removerAmbienteLocal(usuarioLocal.id, ambiente.id).catch(() => {});
        recarregarAmbientes();
      } else {
        setEstado((s) => ({ ...s, erro: e instanceof Error ? e.message : String(e) }));
        if (manual) toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
      }
    } finally {
      rodando.current = false;
      setEstado((e) => ({ ...e, sincronizando: false }));
    }
  }, [papel, usuarioLocal, ambiente, entrarAmbiente, recarregarAmbientes, atualizarAmbienteAtual]);

  // Ciclo automático; no convidado roda logo ao entrar (para baixar os dados).
  useEffect(() => {
    ultimoPacote.current = null;
    setEstado((e) => ({ ...e, papel, novidades: null, erro: null }));
    if (papel === "nenhum") return;
    const primeiro = setTimeout(() => ciclo(), papel === "convidado" ? 300 : 5_000);
    const t = setInterval(() => ciclo(), papel === "convidado" ? CICLO_CONVIDADO_MS : CICLO_DONO_MS);
    return () => { clearTimeout(primeiro); clearInterval(t); };
  }, [papel, ambiente?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convidado: envia logo depois de uma alteração (sem esperar o ciclo).
  useEffect(() => {
    if (papel !== "convidado" || !ambiente) return;
    let pend = opsPendentes(ambiente.id).length;
    const t = setInterval(() => {
      const agora = opsPendentes(ambiente.id).length;
      if (agora !== pend) {
        pend = agora;
        setEstado((e) => ({ ...e, pendentes: agora }));
        if (agora > 0) ciclo();
      }
    }, 4_000);
    return () => clearInterval(t);
  }, [papel, ambiente, ciclo]);

  const sincronizarAgora = useCallback(() => ciclo(true), [ciclo]);
  const marcarVisto = useCallback(() => setEstado((e) => ({ ...e, novidades: null })), []);

  return <C.Provider value={{ ...estado, papel, sincronizarAgora, marcarVisto }}>{children}</C.Provider>;
}

export function useCompartilhamento(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useCompartilhamento fora do provider");
  return c;
}
