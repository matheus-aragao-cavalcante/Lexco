import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Database, Users } from "lucide-react";
import type { DadosEncontrados, ParteEncontrada } from "@/lib/consultaProcesso";
import { formatarData } from "@/lib/dates";
import type { RotulosProcesso } from "@/lib/edicao";

/** Campos do processo que a consulta pode preencher. */
export const CAMPOS_CONSULTA = ["tribunal", "orgaoJulgador", "classeProcessual", "assuntoPrincipal", "dataDistribuicao", "instancia"] as const;
export type CampoConsulta = typeof CAMPOS_CONSULTA[number];

export interface SelecaoConsulta {
  campos: Partial<Record<CampoConsulta, string>>;
  partes: ParteEncontrada[];
  movimentos: DadosEncontrados["movimentos"];
}

const rotuloCampo = (c: CampoConsulta, rot: RotulosProcesso) => ({
  tribunal: rot.tribunal, orgaoJulgador: rot.orgaoJulgador, classeProcessual: rot.classeProcessual,
  assuntoPrincipal: "Assunto Principal", dataDistribuicao: rot.dataDistribuicao, instancia: rot.instancia,
}[c]);

/**
 * Mostra o que foi encontrado nas fontes públicas, lado a lado com o que já está
 * no formulário. Nada é preenchido sem o usuário marcar e confirmar.
 */
export function RevisaoConsultaDialog({ open, onOpenChange, dados, atuais, rot, labelAtivo, labelPassivo, onAplicar }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: DadosEncontrados | null;
  atuais: Record<string, string>;
  rot: RotulosProcesso;
  labelAtivo: string;
  labelPassivo: string;
  onAplicar: (s: SelecaoConsulta) => void;
}) {
  const [campos, setCampos] = useState<Set<CampoConsulta>>(new Set());
  const [partes, setPartes] = useState<Set<number>>(new Set());
  const [importarMov, setImportarMov] = useState(true);

  useEffect(() => {
    if (!dados) return;
    // Pré-marca o que foi encontrado e ainda está vazio no formulário (não troca o que o usuário digitou).
    setCampos(new Set(CAMPOS_CONSULTA.filter((c) => dados[c] && !atuais[c])));
    setPartes(new Set(dados.partes.map((_, i) => i).filter((i) => dados.partes[i].polo !== "outro")));
    setImportarMov(dados.movimentos.length > 0);
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dados) return null;
  const encontrados = CAMPOS_CONSULTA.filter((c) => dados[c]);
  const toggle = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  const mostrar = (c: CampoConsulta, v?: string) => (c === "dataDistribuicao" && v ? formatarData(v) : v || "—");
  const poloLabel = (p: ParteEncontrada["polo"]) => (p === "ativo" ? labelAtivo : p === "passivo" ? labelPassivo : "Outro");

  const aplicar = () => {
    onAplicar({
      campos: Object.fromEntries([...campos].map((c) => [c, dados[c] as string])),
      partes: [...partes].map((i) => dados.partes[i]),
      movimentos: importarMov ? dados.movimentos.slice(0, 10) : [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Dados encontrados — {dados.numero}</DialogTitle>
          <DialogDescription>
            Revise e marque o que deseja usar. Nada é gravado agora: você ainda confere tudo antes de concluir o cadastro.
          </DialogDescription>
        </DialogHeader>

        {dados.avisos.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
            {dados.avisos.map((a) => <p key={a} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> {a}</p>)}
          </div>
        )}

        {encontrados.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Database className="h-4 w-4 text-primary" /> Dados do processo</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              {encontrados.map((c) => {
                const diferente = atuais[c] && atuais[c] !== dados[c];
                return (
                  <label key={c} className="flex items-start gap-3 p-2.5 text-sm cursor-pointer hover:bg-muted/30">
                    <input type="checkbox" className="mt-1" checked={campos.has(c)} onChange={() => setCampos(toggle(campos, c))} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs text-muted-foreground">{rotuloCampo(c, rot)} · fonte: {dados.origem[c]}</span>
                      <span className="block text-foreground break-words">{mostrar(c, dados[c])}</span>
                      {diferente && <span className="block text-xs text-warning">Substitui o valor digitado: "{mostrar(c, atuais[c])}"</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {dados.partes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> Partes (fonte: DJEN)</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              {dados.partes.map((p, i) => (
                <label key={`${p.polo}-${p.nome}`} className="flex items-start gap-3 p-2.5 text-sm cursor-pointer hover:bg-muted/30">
                  <input type="checkbox" className="mt-1" checked={partes.has(i)} onChange={() => setPartes(toggle(partes, i))} />
                  <span className="flex-1">
                    <span className="text-foreground">{p.nome}</span>
                    <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">{poloLabel(p.polo)}</span>
                    {p.advogados.length > 0 && <span className="block text-xs text-muted-foreground">Advogado(s): {p.advogados.join(", ")}</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Partes que ainda não existem no cadastro serão criadas ao concluir (com o nome; CPF/CNPJ você completa depois).</p>
          </div>
        )}

        {dados.movimentos.length > 0 && (
          <label className="flex items-start gap-3 rounded-lg border border-border p-2.5 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={importarMov} onChange={(e) => setImportarMov(e.target.checked)} />
            <span>
              Importar as {Math.min(10, dados.movimentos.length)} movimentações mais recentes como andamentos
              <span className="block text-xs text-muted-foreground">Última: {dados.movimentos[0].descricao} ({formatarData(dados.movimentos[0].data.slice(0, 10))})</span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Não usar</Button>
          <Button onClick={aplicar} disabled={campos.size === 0 && partes.size === 0 && !importarMov}>Usar dados selecionados</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
