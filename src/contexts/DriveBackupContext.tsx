import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { backupFileName, createBackup, serializeBackup } from "@/lib/backup";
import { getDesktopGoogle, getLastDriveSync, googleDrive, setLastDriveSync } from "@/lib/googleDrive";
import {
  autoBackupLigado, definirAutoBackup, deveEnviar, instalarRastreamento, limparPendente,
  nomeBackupAutomatico, pendenteDesde, solicitarEnvioImediato,
} from "@/lib/autoBackup";

type Estado = "ocioso" | "enviando" | "erro";

interface DriveBackupContextType {
  /** App de computador + usuário que pode fazer backup completo (admin). */
  disponivel: boolean;
  configurado: boolean;
  conectado: boolean;
  email: string;
  autoLigado: boolean;
  setAutoLigado: (v: boolean) => void;
  estado: Estado;
  erro: string | null;
  ultimoBackup: string | null;
  pendente: boolean;
  conectando: boolean;
  conectar: () => Promise<void>;
  cancelarConexao: () => void;
  desconectar: () => Promise<void>;
  /** Backup manual (arquivo próprio, nunca apagado automaticamente). */
  backupAgora: () => Promise<void>;
  atualizarStatus: () => Promise<void>;
}

const Ctx = createContext<DriveBackupContextType | null>(null);
const VERIFICAR_A_CADA_MS = 20_000;

export function DriveBackupProvider({ children }: { children: ReactNode }) {
  const { currentUser, podeGerenciarUsuarios } = useAuth();
  const desktop = Boolean(getDesktopGoogle());
  const disponivel = desktop && !!currentUser && podeGerenciarUsuarios;

  const [status, setStatus] = useState<LexcoGoogleStatus | null>(null);
  const [autoLigado, setAutoLigadoState] = useState(false);
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);
  const [pendente, setPendente] = useState(pendenteDesde() !== null);
  const [conectando, setConectando] = useState(false);
  const enviandoRef = useRef(false);
  const ultimoEnvioRef = useRef<number | null>(null);
  // Identifica a sessão atual: um envio iniciado por outro usuário/conta é descartado.
  const sessaoRef = useRef(0);
  const emailRef = useRef("");

  useEffect(() => {
    instalarRastreamento();
  }, []);

  const atualizarStatus = useCallback(async () => {
    if (!desktop) return;
    try {
      setStatus(await googleDrive.status());
    } catch {
      setStatus(null);
    }
  }, [desktop]);

  // Ao trocar de usuário (login/logout), relê status e preferência.
  useEffect(() => {
    sessaoRef.current++;
    ultimoEnvioRef.current = null;
    atualizarStatus();
    setAutoLigadoState(currentUser ? autoBackupLigado(currentUser.id) : false);
    setErro(null);
    setEstado("ocioso");
  }, [currentUser?.id, atualizarStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const conectado = !!status?.connected;
  const email = status?.email || "";

  // Conta Google mudou: nova "sessão" de backup, último backup daquela conta.
  useEffect(() => {
    if (emailRef.current !== email) {
      sessaoRef.current++;
      emailRef.current = email;
    }
    setUltimoBackup(getLastDriveSync(email));
  }, [email]);

  const enviar = useCallback(
    async (auto: boolean) => {
      if (enviandoRef.current) return;
      enviandoRef.current = true;
      setEstado("enviando");
      const marca = pendenteDesde();
      const sessao = sessaoRef.current;
      const conta = emailRef.current;
      try {
        const backup = await createBackup();
        if (sessao !== sessaoRef.current) throw new Error("Usuário ou conta mudou durante o backup. Envio cancelado.");
        const quando = new Date(backup.createdAt); // nome pelo instante do snapshot (virada de meia-noite)
        const nome = auto ? nomeBackupAutomatico(quando) : backupFileName(quando);
        await googleDrive.upload(nome, serializeBackup(backup), auto, conta);
        if (sessao !== sessaoRef.current) return; // já trocou de sessão: não mexe no estado da nova
        limparPendente(marca);
        setLastDriveSync(conta, backup.createdAt);
        setUltimoBackup(backup.createdAt);
        ultimoEnvioRef.current = Date.now();
        setErro(null);
        setEstado("ocioso");
        if (!auto) toast.success("Backup enviado ao Google Drive");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no backup";
        setErro(msg);
        setEstado("erro");
        // Evita martelar o Drive em caso de erro: tenta de novo após o intervalo mínimo.
        ultimoEnvioRef.current = Date.now();
        if (!auto) toast.error(msg);
        atualizarStatus(); // pode ter sido desconectado (acesso revogado)
      } finally {
        enviandoRef.current = false;
        setPendente(pendenteDesde() !== null);
      }
    },
    [atualizarStatus],
  );

  // Agendador do backup automático.
  useEffect(() => {
    if (!disponivel) return;
    const tick = () => {
      const p = pendenteDesde();
      setPendente(p !== null);
      if (!conectado || !autoLigado || enviandoRef.current) return;
      if (deveEnviar({ pendente: p, ultimoEnvio: ultimoEnvioRef.current, agora: Date.now() })) enviar(true);
    };
    tick();
    const t = setInterval(tick, VERIFICAR_A_CADA_MS);
    return () => clearInterval(t);
  }, [disponivel, conectado, autoLigado, enviar]);

  const setAutoLigado = (v: boolean) => {
    if (!currentUser) return;
    definirAutoBackup(currentUser.id, v);
    setAutoLigadoState(v);
    if (v && !getLastDriveSync(email)) solicitarEnvioImediato(); // primeiro backup já
    toast.success(v ? "Backup automático ligado" : "Backup automático desligado");
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const s = await googleDrive.connect();
      setStatus(s);
      if (!getLastDriveSync(s.email)) solicitarEnvioImediato(); // dados já existentes vão no primeiro envio
      toast.success(`Google Drive conectado (${s.email})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao conectar";
      if (msg !== "Login cancelado.") toast.error(msg);
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    try {
      setStatus(await googleDrive.disconnect());
      toast.success("Google Drive desconectado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar");
    }
  };

  return (
    <Ctx.Provider
      value={{
        disponivel,
        configurado: !!status?.configured,
        conectado,
        email,
        autoLigado,
        setAutoLigado,
        estado,
        erro,
        ultimoBackup,
        pendente,
        conectando,
        conectar,
        cancelarConexao: () => googleDrive.cancelConnect().catch(() => {}),
        desconectar,
        backupAgora: () => enviar(false),
        atualizarStatus,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDriveBackup() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDriveBackup fora do DriveBackupProvider");
  return c;
}
