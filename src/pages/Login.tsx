import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Scale, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { signInWithGoogleStub } from "@/services/auth/firebaseAuth";

const Login = () => {
  const { login, register, localUsers } = useAuth();
  const [mode, setMode] = useState<"select" | "login" | "register">(localUsers.length > 0 ? "select" : "register");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    const result = await login(email, senha);
    setLoading(false);
    if (!result.success) toast.error(result.error);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !senha) { toast.error("Preencha todos os campos"); return; }
    if (senha.length < 4) { toast.error("Senha deve ter no mínimo 4 caracteres"); return; }
    setLoading(true);
    const result = await register({ nome, email, senha });
    setLoading(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Conta criada com sucesso!");
  };

  const handleSelectUser = (userEmail: string) => {
    setEmail(userEmail);
    setMode("login");
  };

  const handleGoogle = async () => {
    // FIREBASE: integração real está stub em src/services/auth/firebaseAuth.ts
    const result = await signInWithGoogleStub();
    if (!result.success) toast.message("Login com Google", { description: result.message });
    else toast.success(result.message);
  };

  // Botão visual preparado para Firebase Spark (stub)
  const GoogleButton = () => (
    <button
      type="button"
      onClick={handleGoogle}
      className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-input bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
      </svg>
      Continuar com Google
    </button>
  );

  const Divider = () => (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">ou</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Scale className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Lexco</h1>
          <p className="text-muted-foreground mt-1">Sistema de Gestão Jurídica</p>
        </div>

        <div className="bg-card rounded-xl border shadow-elevated p-6 space-y-5">
          {/* User selection */}
          {mode === "select" && (
            <>
              <h2 className="text-lg font-heading font-semibold text-foreground text-center">Selecionar Usuário</h2>
              <div className="space-y-2">
                {localUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u.email)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors text-left"
                  >
                    {u.foto ? (
                      <img src={u.foto} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {u.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{u.perfil}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setMode("login")}>
                  <LogIn className="h-4 w-4 mr-2" /> Outro login
                </Button>
                <Button className="flex-1" onClick={() => setMode("register")}>
                  <UserPlus className="h-4 w-4 mr-2" /> Novo cadastro
                </Button>
              </div>
            </>
          )}

          {/* Login form */}
          {mode === "login" && (
            <>
              <h2 className="text-lg font-heading font-semibold text-foreground text-center">Entrar</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Senha</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
                      className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
              <div className="flex gap-2 text-sm justify-center">
                {localUsers.length > 0 && (
                  <button onClick={() => { setMode("select"); setEmail(""); setSenha(""); }} className="text-primary hover:underline">Trocar usuário</button>
                )}
                <span className="text-muted-foreground">·</span>
                <button onClick={() => setMode("register")} className="text-primary hover:underline">Criar conta</button>
              </div>
            </>
          )}

          {/* Register form */}
          {mode === "register" && (
            <>
              <h2 className="text-lg font-heading font-semibold text-foreground text-center">Criar Conta</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Nome completo</label>
                  <input
                    value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Dr. João Silva"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Senha</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
              </form>
              <div className="text-sm text-center">
                {localUsers.length > 0 ? (
                  <button onClick={() => setMode("select")} className="text-primary hover:underline">Voltar para seleção</button>
                ) : (
                  <button onClick={() => setMode("login")} className="text-primary hover:underline">Já tenho conta</button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Dados armazenados localmente no seu dispositivo
        </p>
      </div>
    </div>
  );
};

export default Login;
