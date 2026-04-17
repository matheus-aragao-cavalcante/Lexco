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
