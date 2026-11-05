import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Scale, Eye, EyeOff, ArrowLeft, HardDrive, Cloud, ShieldCheck, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getDesktopGoogle, googleDrive } from "@/lib/googleDrive";

type Mode = "inicio" | "login" | "register";

const inputCls =
  "w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const Login = () => {
  const { login, loginWithGoogle, register, localUsers } = useAuth();
  const googleDisponivel = Boolean(getDesktopGoogle());
  const [mode, setMode] = useState<Mode>("inicio");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleLoadingRef = useRef(false);
  googleLoadingRef.current = googleLoading;
  // Saiu da tela com um login Google pendente: cancela, para não trocar de conta depois.
  useEffect(() => () => {
    if (googleLoadingRef.current) googleDrive.cancelConnect().catch(() => {});
  }, []);

  const voltar = () => {
    setMode("inicio");
    setSenha("");
    setShowPass(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);
    if (!result.success) {
      if (result.error !== "Login cancelado.") toast.error(result.error);
    } else if (result.novo) {
      toast.success("Bem-vindo ao Lexco! Seus backups podem ir direto para o seu Google Drive.");
    }
  };

  const cancelarGoogle = () => {
    googleDrive.cancelConnect().catch(() => {});
  };

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
    if (!nome.trim() || !email.trim() || !senha) { toast.error("Preencha todos os campos"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("E-mail inválido"); return; }
    if (senha.length < 4) { toast.error("Senha deve ter no mínimo 4 caracteres"); return; }
    setLoading(true);
    const result = await register({ nome: nome.trim(), email, senha });
    setLoading(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Conta criada com sucesso!");
  };

  const escolherConta = (u: (typeof localUsers)[number]) => {
    if (u.contaGoogle && googleDisponivel) {
      handleGoogle();
      return;
    }
    setEmail(u.email);
    setSenha("");
    setMode("login");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Painel da marca */}
      <aside className="hidden lg:flex w-[44%] relative overflow-hidden flex-col justify-between p-12 text-white bg-[radial-gradient(ellipse_at_30%_20%,hsl(220_22%_18%),hsl(220_20%_9%)_70%)]">
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex items-center gap-3 fade-up">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[hsl(16_92%_60%)] to-[hsl(12_85%_46%)] flex items-center justify-center shadow-lg shadow-primary/30">
            <Scale className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <span className="font-heading text-2xl font-bold">Lexco</span>
        </div>

        <div className="relative space-y-6">
          <h2 className="font-heading text-4xl leading-tight fade-up" style={{ animationDelay: "120ms" }}>
            Seu escritório organizado,
            <br />
            <span className="text-primary">seus dados com você.</span>
          </h2>
          <ul className="space-y-3 text-sm text-white/75">
            {[
              { icon: Scale, text: "Processos, prazos, agenda e partes em um só lugar" },
              { icon: HardDrive, text: "Tudo fica salvo neste computador, sem servidor" },
              { icon: Cloud, text: "Backup no seu próprio Google Drive com um clique" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3 fade-up" style={{ animationDelay: `${240 + i * 110}ms` }}>
                <span className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">Lexco — Gestão Jurídica</p>
      </aside>

      {/* Painel de acesso */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo (telas estreitas) */}
          <div className="lg:hidden text-center mb-8 fade-up">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
              <Scale className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Lexco</h1>
          </div>

          {mode === "inicio" && (
            <div className="space-y-6">
              <div className="fade-up">
                <h1 className="text-2xl font-heading font-semibold text-foreground">Bem-vindo</h1>
                <p className="text-muted-foreground text-sm mt-1">Como você quer usar o Lexco?</p>
              </div>

              {/* Opção Google */}
              <div className="fade-up" style={{ animationDelay: "100ms" }}>
                {googleLoading ? (
                  <div className="rounded-xl border-2 border-primary/40 bg-card p-5 flex items-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Conclua o login no navegador</p>
                      <p className="text-xs text-muted-foreground">Abrimos a página do Google. Depois volte para cá.</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={cancelarGoogle}>Cancelar</Button>
                  </div>
                ) : (
                  <OptionCard
                    disabled={!googleDisponivel}
                    onClick={handleGoogle}
                    icon={<GoogleIcon />}
                    title="Entrar com Google"
                    description={
                      googleDisponivel
                        ? "Seus dados ficam neste computador, com backup no seu Google Drive."
                        : "Disponível no app de computador do Lexco."
                    }
                    highlight
                  />
                )}
              </div>

              {/* Opção local */}
              <div className="fade-up" style={{ animationDelay: "180ms" }}>
                <OptionCard
                  disabled={googleLoading}
                  onClick={() => { setEmail(""); setMode(localUsers.some((u) => !u.contaGoogle) ? "login" : "register"); }}
                  icon={<HardDrive className="h-5 w-5 text-foreground" />}
                  title="Usar só neste computador"
                  description="Sem conta online. Entre com e-mail e senha locais."
                />
              </div>

              {/* Contas já usadas */}
              {localUsers.length > 0 && (
                <div className="space-y-2 fade-up" style={{ animationDelay: "260ms" }}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contas neste computador</p>
                  <div className="flex flex-wrap gap-2">
                    {localUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => escolherConta(u)}
                        disabled={googleLoading}
                        title={u.email}
                        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        <Avatar nome={u.nome} foto={u.foto} />
                        <span className="text-sm text-foreground max-w-[140px] truncate">{u.nome.split(" ")[0]}</span>
                        {u.contaGoogle && <span className="h-3.5 w-3.5"><GoogleIcon /></span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground fade-up" style={{ animationDelay: "320ms" }}>
                <ShieldCheck className="h-3.5 w-3.5" /> Seus dados nunca passam por servidores do Lexco.
              </p>
            </div>
          )}

          {mode === "login" && (
            <Card onBack={voltar} title="Entrar" subtitle="Use o e-mail e a senha deste computador.">
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} autoFocus={!email} />
                </Field>
                <Field label="Senha">
                  <PasswordInput value={senha} onChange={setSenha} show={showPass} onToggle={() => setShowPass(!showPass)} autoFocus={!!email} />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
              <p className="text-sm text-center text-muted-foreground">
                Não tem conta?{" "}
                <button onClick={() => setMode("register")} className="text-primary hover:underline">Criar conta local</button>
              </p>
            </Card>
          )}

          {mode === "register" && (
            <Card onBack={voltar} title="Criar conta local" subtitle="Os dados ficam apenas neste computador.">
              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="Nome completo">
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dr. João Silva" className={inputCls} autoFocus />
                </Field>
                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
                </Field>
                <Field label="Senha">
                  <PasswordInput value={senha} onChange={setSenha} show={showPass} onToggle={() => setShowPass(!showPass)} placeholder="Mínimo 4 caracteres" />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>
              <p className="text-sm text-center text-muted-foreground">
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">Entrar</button>
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

function OptionCard({
  icon, title, description, onClick, disabled, highlight,
}: { icon: React.ReactNode; title: string; description: string; onClick: () => void; disabled?: boolean; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group w-full text-left flex items-center gap-4 rounded-xl border-2 bg-card p-5 transition-all
        hover:-translate-y-0.5 hover:shadow-elevated disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed
        ${highlight ? "border-primary/30 hover:border-primary" : "border-border hover:border-foreground/30"}`}
    >
      <span className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-disabled:hidden" />
    </button>
  );
}

function Card({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-5 fade-up">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>
      <div className="bg-card rounded-xl border shadow-elevated p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggle, placeholder, autoFocus,
}: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${inputCls} pr-10`}
      />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Avatar({ nome, foto }: { nome: string; foto?: string }) {
  if (foto) return <img src={foto} alt="" className="h-7 w-7 rounded-full object-cover" />;
  const iniciais = nome.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
      {iniciais}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-full w-full max-h-5 max-w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default Login;
