import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { dbProprio as db, definirBancoAtivo, type LexcoDB } from "@/lib/db";
import { permissoesDe, MODELOS_PERMISSAO, type Permissoes } from "@/lib/permissoes";
import { abrirBancoAmbiente, listarAmbientes, type AmbienteSalvo } from "@/lib/compartilhamento/sync";
import { hashPassword, verifyPassword, getSessionUserId, setSessionUserId, clearSession } from "@/lib/auth";
import { getDesktopGoogle, getLastDriveSync, googleDrive } from "@/lib/googleDrive";
import { solicitarEnvioImediato } from "@/lib/autoBackup";
import type { User, UserPreferences } from "@/types";

type AuthResult = { success: boolean; error?: string };

interface AuthContextType {
  /**
   * Usuário EFETIVO. No ambiente compartilhado é o cadastro do convidado no
   * ambiente do administrador (id, nome e permissões de lá).
   */
  currentUser: User | null;
  /** Usuário deste computador (perfil, senha, preferências). */
  usuarioLocal: User | null;
  /** null = meu ambiente. */
  ambiente: AmbienteSalvo | null;
  ambientesDisponiveis: AmbienteSalvo[];
  /** Já escolheu o ambiente nesta sessão (tela de escolha só aparece uma vez). */
  ambienteEscolhido: boolean;
  entrarAmbiente: (id: string | null) => void;
  recarregarAmbientes: () => void;
  /** Atualiza dados do ambiente atual (permissões recebidas no pacote etc.). */
  atualizarAmbienteAtual: (amb: AmbienteSalvo) => void;
  permissoes: Permissoes;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  /** Abre o login do Google no navegador; entra no usuário local com aquele e-mail (ou cria um). */
  loginWithGoogle: () => Promise<AuthResult & { novo?: boolean }>;
  register: (data: RegisterData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  switchUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  localUsers: Pick<User, "id" | "nome" | "email" | "foto" | "perfil" | "status" | "contaGoogle">[];
  /** Admin — ou qualquer usuário enquanto não existir nenhum admin (evita ficar trancado). */
  podeGerenciarUsuarios: boolean;
  refreshLocalUsers: () => Promise<void>;
}

interface RegisterData {
  nome: string;
  email: string;
  senha: string;
  perfil?: User["perfil"];
}

const DEFAULT_PREFS: UserPreferences = {
  tema: "light",
  notifPrazo1Dia: true,
  notifPrazoHoje: true,
  notifAgenda: true,
  notifPendencias: true,
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [localUsers, setLocalUsers] = useState<AuthContextType["localUsers"]>([]);
  const [ambiente, setAmbiente] = useState<AmbienteSalvo | null>(null);
  const [ambientesDisponiveis, setAmbientesDisponiveis] = useState<AmbienteSalvo[]>([]);
  const [ambienteEscolhido, setAmbienteEscolhido] = useState(false);

  const recarregarAmbientes = useCallback(() => {
    setAmbientesDisponiveis(currentUser ? listarAmbientes(currentUser.id) : []);
  }, [currentUser]);
  useEffect(() => { recarregarAmbientes(); }, [recarregarAmbientes]);

  /** Troca o banco das telas: o próprio (null) ou a cópia local de um ambiente compartilhado. */
  const entrarAmbiente = useCallback((id: string | null) => {
    const amb = id && currentUser ? listarAmbientes(currentUser.id).find((a) => a.id === id) ?? null : null;
    definirBancoAtivo(amb ? bancoDoAmbiente(amb) : db);
    setAmbiente(amb);
    setAmbienteEscolhido(true);
    sessionStorage.setItem(SESSAO_AMBIENTE, amb ? amb.id : "proprio");
  }, [currentUser]);

  const atualizarAmbienteAtual = useCallback((amb: AmbienteSalvo) => {
    setAmbiente((a) => (a && a.id === amb.id ? amb : a));
    setAmbientesDisponiveis((l) => l.map((x) => (x.id === amb.id ? amb : x)));
  }, []);

  const refreshLocalUsers = useCallback(async () => {
    const users = await db.users.toArray();
    setLocalUsers(users.map((u) => ({ id: u.id, nome: u.nome, email: u.email, foto: u.foto, perfil: u.perfil, status: u.status, contaGoogle: u.contaGoogle })));
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshLocalUsers();
      const sessionId = getSessionUserId();
      if (sessionId) {
        const user = await db.users.get(sessionId);
        if (user && user.status !== "inativo") {
          setCurrentUser(user);
          applyUserTheme(user.preferencias);
          // Recarregou a janela dentro de um ambiente compartilhado: volta para ele.
          const sessao = sessionStorage.getItem(SESSAO_AMBIENTE);
          const amb = sessao && sessao !== "proprio" ? listarAmbientes(user.id).find((a) => a.id === sessao) : null;
          if (amb) {
            definirBancoAtivo(bancoDoAmbiente(amb));
            setAmbiente(amb);
          }
          if (sessao) setAmbienteEscolhido(true);
        } else {
          clearSession();
        }
      }
      setLoading(false);
    };
    init();
  }, [refreshLocalUsers]);

  const startSession = (user: User) => {
    setSessionUserId(user.id);
    setCurrentUser(user);
    applyUserTheme(user.preferencias);
  };

  const login = async (email: string, password: string) => {
    const user = await db.users.where("email").equals(email.toLowerCase().trim()).first();
    if (!user) return { success: false, error: "Usuário não encontrado" };
    if (!user.senha) return { success: false, error: "Esta conta entra pelo Google. Use \"Entrar com Google\"." };
    const valid = await verifyPassword(password, user.senha);
    if (!valid) return { success: false, error: "Senha incorreta" };
    if (user.status === "inativo") return { success: false, error: "Usuário inativo" };
    startSession(user);
    return { success: true };
  };

  const loginWithGoogle = async () => {
    let result: Awaited<ReturnType<typeof googleDrive.connect>>;
    try {
      result = await googleDrive.connect();
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Falha no login com Google" };
    }
    const { email, name, picture } = result.profile;
    // Primeiro login desta conta neste computador: o backup automático já envia os dados.
    if (!getLastDriveSync(email)) solicitarEnvioImediato();
    // Primeiro pela conta Google vinculada (o e-mail local pode ter sido alterado no Perfil).
    // Pelo e-mail só vale se o usuário ainda não estiver vinculado a OUTRA conta Google —
    // senão quem controlasse aquele e-mail entraria na conta alheia.
    const porVinculo = await db.users.filter((u) => u.contaGoogle === email).first();
    const porEmail = porVinculo ? undefined : await db.users.where("email").equals(email).first();
    if (porEmail?.contaGoogle && porEmail.contaGoogle !== email) {
      await googleDrive.signOut().catch(() => {});
      return { success: false, error: "Este e-mail pertence a um usuário vinculado a outra conta Google." };
    }
    const existing = porVinculo ?? porEmail;

    if (existing) {
      if (existing.status === "inativo") {
        await googleDrive.signOut().catch(() => {});
        return { success: false, error: "Usuário inativo" };
      }
      const updated: User = {
        ...existing,
        contaGoogle: email,
        foto: existing.foto || picture || undefined,
        atualizadoEm: new Date().toISOString(),
      };
      await db.users.put(updated);
      startSession(updated);
      await refreshLocalUsers();
      return { success: true };
    }

    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      nome: name || email.split("@")[0],
      email,
      senha: "", // sem senha local: entra pelo Google (pode definir uma senha no Perfil)
      contaGoogle: email,
      foto: picture || undefined,
      perfil: await perfilInicial(),
      status: "ativo",
      preferencias: { ...DEFAULT_PREFS },
      criadoEm: now,
      atualizadoEm: now,
    };
    await db.users.add(user);
    startSession(user);
    await refreshLocalUsers();
    return { success: true, novo: true };
  };

  const register = async (data: RegisterData) => {
    const existing = await db.users.where("email").equals(data.email.toLowerCase().trim()).first();
    if (existing) return { success: false, error: "Email já cadastrado" };
    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      nome: data.nome,
      email: data.email.toLowerCase().trim(),
      senha: await hashPassword(data.senha),
      perfil: data.perfil || (await perfilInicial()),
      status: "ativo",
      preferencias: { ...DEFAULT_PREFS },
      criadoEm: now,
      atualizadoEm: now,
    };
    await db.users.add(user);
    startSession(user);
    await refreshLocalUsers();
    return { success: true };
  };

  const logout = async () => {
    // Ao sair, esquece a conta Google neste computador ANTES de liberar a tela de
    // login: quem entrar depois não pode usar o Drive de outra pessoa.
    // (Não revoga a autorização no Google.)
    if (getDesktopGoogle()) {
      await googleDrive.signOut().catch((e) => console.error("Falha ao esquecer a conta Google:", e));
    }
    clearSession();
    definirBancoAtivo(db);
    setAmbiente(null);
    setAmbienteEscolhido(false);
    sessionStorage.removeItem(SESSAO_AMBIENTE);
    setCurrentUser(null);
  };

  const updateUser = async (data: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data, atualizadoEm: new Date().toISOString() };
    await db.users.put(updated);
    setCurrentUser(updated);
    if (data.preferencias) applyUserTheme(data.preferencias);
    await refreshLocalUsers();
  };

  // Dentro de um ambiente compartilhado ninguém gerencia usuários (isso é do administrador de lá).
  const podeGerenciarUsuarios =
    !!currentUser && !ambiente &&
    (currentUser.perfil === "admin" || !localUsers.some((u) => u.perfil === "admin" && u.status !== "inativo"));

  const usuarioEfetivo = useMemo<User | null>(() => {
    if (!currentUser || !ambiente) return currentUser;
    return {
      ...currentUser,
      id: ambiente.voceId,
      nome: ambiente.voceNome,
      perfil: ambiente.perfil ?? "colaborador",
      permissoes: ambiente.permissoes,
      senha: "",
    };
  }, [currentUser, ambiente]);

  const permissoes = useMemo<Permissoes>(() => {
    // Antes da 1ª sincronização (permissões ainda não chegaram): só leitura.
    if (ambiente) return ambiente.permissoes ?? MODELOS_PERMISSAO[0].permissoes;
    return permissoesDe(currentUser);
  }, [currentUser, ambiente]);

  return (
    <AuthContext.Provider
      value={{
        currentUser: usuarioEfetivo, usuarioLocal: currentUser, loading, login, loginWithGoogle, register, logout, switchUser: logout,
        updateUser, localUsers, refreshLocalUsers, podeGerenciarUsuarios,
        ambiente, ambientesDisponiveis, ambienteEscolhido, entrarAmbiente, recarregarAmbientes, atualizarAmbienteAtual, permissoes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

const SESSAO_AMBIENTE = "lexco_ambiente_sessao";

// Uma instância por ambiente (a captura de alterações é instalada uma única vez).
const bancos = new Map<string, LexcoDB>();
function bancoDoAmbiente(amb: AmbienteSalvo): LexcoDB {
  let b = bancos.get(amb.id);
  if (!b) {
    b = abrirBancoAmbiente(amb);
    bancos.set(amb.id, b);
  }
  return b;
}

/** O primeiro usuário cadastrado no computador vira administrador. */
async function perfilInicial(): Promise<User["perfil"]> {
  return (await db.users.count()) === 0 ? "admin" : "advogado";
}

function applyUserTheme(prefs: UserPreferences) {
  if (prefs.tema === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("theme", prefs.tema);
}
