import { User, Building2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIPOS_PESSOA } from "@/types";
import { erroDocumento, mascararDocumento, type TipoDocumento } from "@/lib/documentos";

const OUTROS_TIPOS = TIPOS_PESSOA.filter((t) => t !== "Pessoa Física" && t !== "Pessoa Jurídica");

/**
 * Seleção do tipo de pessoa por botões: PF e PJ em destaque; órgão público,
 * entidade e "outro" ficam numa linha secundária e usam os campos de PJ.
 */
export function SeletorTipoPessoa({ value, onChange, disabled }: {
  value: string;
  onChange: (tipo: string) => void;
  disabled?: boolean;
}) {
  const cartao = (tipo: string, Icon: typeof User, titulo: string, sub: string) => {
    const ativo = value === tipo;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(tipo)}
        aria-pressed={ativo}
        className={cn(
          "flex-1 flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
          ativo ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/40",
        )}
      >
        <span className={cn("h-9 w-9 rounded-lg flex items-center justify-center", ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground">{titulo}</span>
          <span className="block text-xs text-muted-foreground">{sub}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {cartao("Pessoa Física", User, "Pessoa Física", "Nome e CPF")}
        {cartao("Pessoa Jurídica", Building2, "Pessoa Jurídica", "Razão social e CNPJ")}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground flex items-center gap-1"><Landmark className="h-3.5 w-3.5" /> Outros:</span>
        {OUTROS_TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t)}
            aria-pressed={value === t}
            className={cn(
              "px-2.5 py-1 rounded-full border transition-colors disabled:opacity-60",
              value === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >{t}</button>
        ))}
      </div>
    </div>
  );
}

/** Campo de CPF/CNPJ com máscara e validação dos dígitos verificadores. */
export function CampoDocumento({ tipo, value, onChange, disabled, duplicado }: {
  tipo: TipoDocumento;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Nome de outra parte já cadastrada com o mesmo documento. */
  duplicado?: string | null;
}) {
  const erro = erroDocumento(tipo, value);
  const rotulo = tipo === "cpf" ? "CPF" : "CNPJ";
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{rotulo}</label>
      <input
        value={value}
        disabled={disabled}
        inputMode={tipo === "cpf" ? "numeric" : "text"}
        onChange={(e) => onChange(mascararDocumento(tipo, e.target.value))}
        placeholder={tipo === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
        aria-invalid={!!erro}
        className={cn(
          "w-full h-9 px-3 rounded-lg border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60",
          erro ? "border-destructive" : "border-input",
        )}
      />
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {!erro && duplicado && <p className="text-xs text-warning">Já cadastrado para "{duplicado}".</p>}
    </div>
  );
}
