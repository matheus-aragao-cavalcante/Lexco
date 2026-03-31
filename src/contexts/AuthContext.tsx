import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, getSessionUserId, setSessionUserId, clearSession } from "@/lib/auth";
import type { User, UserPreferences } from "@/types";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  localUsers: Pick<User, "id" | "nome" | "email" | "foto" | "perfil">[];
  refreshLocalUsers: () => Promise<void>;
}

interface RegisterData {
  nome: string;
  email: string;
  senha: string;
  perfil?: User["perfil"];
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [localUsers, setLocalUsers] = useState<Pick<User, "id" | "nome" | "email" | "foto" | "perfil">[]>([]);

  const refreshLocalUsers = useCallback(async () => {
    const users = await db.users.toArray();
    setLocalUsers(users.map((u) => ({ id: u.id, nome: u.nome, email: u.email, foto: u.foto, perfil: u.perfil })));
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshLocalUsers();
      const sessionId = getSessionUserId();
      if (sessionId) {
        const user = await db.users.get(sessionId);
        if (user) {
          setCurrentUser(user);
          applyUserTheme(user.preferencias);
        }
      }
      setLoading(false);
    };
    init();
  }, [refreshLocalUsers]);

  const login = async (email: string, password: string) => {
    const user = await db.users.where("email").equals(email.toLowerCase().trim()).first();
    if (!user) return { success: false, error: "Usuário não encontrado" };
    const valid = await verifyPassword(password, user.senha);
    if (!valid) return { success: false, error: "Senha incorreta" };
    if (user.status === "inativo") return { success: false, error: "Usuário inativo" };
    setSessionUserId(user.id);
    setCurrentUser(user);
    applyUserTheme(user.preferencias);
    return { success: true };
  };

  const register = async (data: RegisterData) => {
    const existing = await db.users.where("email").equals(data.email.toLowerCase().trim()).first();
    if (existing) return { success: false, error: "Email já cadastrado" };
    const now = new Date().toISOString();
    const defaultPrefs: UserPreferences = {
      tema: "light",
      notifPrazo1Dia: true,
      notifPrazoHoje: true,
      notifAgenda: true,
      notifPendencias: true,
    };
    const user: User = {
      id: crypto.randomUUID(),
      nome: data.nome,
      email: data.email.toLowerCase().trim(),
      senha: await hashPassword(data.senha),
      perfil: data.perfil || "advogado",
      status: "ativo",
      preferencias: defaultPrefs,
      criadoEm: now,
      atualizadoEm: now,
    };
    await db.users.add(user);
    setSessionUserId(user.id);
    setCurrentUser(user);
    await refreshLocalUsers();
    return { success: true };
  };

  const logout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const switchUser = () => {
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

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, register, logout, switchUser, updateUser, localUsers, refreshLocalUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function applyUserTheme(prefs: UserPreferences) {
  if (prefs.tema === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("theme", prefs.tema);
}
