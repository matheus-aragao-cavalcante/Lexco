import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, getSessionUserId, setSessionUserId, clearSession } from "@/lib/auth";
import { getDesktopGoogle, googleDrive } from "@/lib/googleDrive";
import type { User, UserPreferences } from "@/types";

type AuthResult = { success: boolean; error?: string };

interface AuthContextType {
  currentUser: User | null;
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

  const podeGerenciarUsuarios =
    !!currentUser &&
    (currentUser.perfil === "admin" || !localUsers.some((u) => u.perfil === "admin" && u.status !== "inativo"));

  return (
    <AuthContext.Provider
      value={{
        currentUser, loading, login, loginWithGoogle, register, logout, switchUser: logout,
        updateUser, localUsers, refreshLocalUsers, podeGerenciarUsuarios,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

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
