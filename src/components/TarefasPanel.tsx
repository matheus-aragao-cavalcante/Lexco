import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Square, Pencil, Trash2, Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatarData, hojeISO } from "@/lib/dates";
import { ehTarefa, tarefaAberta, ordenarTarefas } from "@/lib/tarefas";
import type { Evento, Processo } from "@/types";
import { cn } from "@/lib/utils";

type Filtro = "abertas" | "minhas" | "atrasadas" | "concluidas" | "todas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abertas", label: "Abertas" },
  { id: "minhas", label: "Minhas" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "concluidas", label: "Concluídas" },
  { id: "todas", label: "Todas" },
];

/** Lista de tarefas da agenda: concluir, editar e excluir sem sair da tela. */
export function TarefasPanel({ eventos, processos, usuarios, usuarioAtualId, onNova, onEditar, onAlternar, onExcluir, podeEditar = true }: {
  /** false = só visualização (permissão "Tarefas: só ver"). */
  podeEditar?: boolean;
  eventos: Evento[];
  processos: Record<string, Processo>;
  usuarios: Record<string, string>;
  usuarioAtualId?: string;
  onNova: () => void;
  onEditar: (t: Evento) => void;
  onAlternar: (t: Evento) => void;
  onExcluir: (t: Evento) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const hoje = hojeISO();
  const tarefas = useMemo(() => eventos.filter(ehTarefa).sort(ordenarTarefas), [eventos]);
  const atrasada = (t: Evento) => tarefaAberta(t) && t.data < hoje;

  const visiveis = tarefas.filter((t) => {
    switch (filtro) {
      case "abertas": return tarefaAberta(t);
      case "minhas": return tarefaAberta(t) && !!usuarioAtualId && t.responsaveisIds?.includes(usuarioAtualId);
      case "atrasadas": return atrasada(t);
      case "concluidas": return t.status === "concluido";
      default: return true;
    }
  });
  const contagem = (f: Filtro) => tarefas.filter((t) =>
    f === "abertas" ? tarefaAberta(t)
      : f === "minhas" ? tarefaAberta(t) && !!usuarioAtualId && t.responsaveisIds?.includes(usuarioAtualId)
        : f === "atrasadas" ? atrasada(t)
          : f === "concluidas" ? t.status === "concluido" : true).length;

  return (
    <div className="bg-card rounded-lg border shadow-card">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" /> Tarefas
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={cn("px-2.5 py-1 rounded text-xs transition-colors",
                  filtro === f.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
                  f.id === "atrasadas" && contagem("atrasadas") > 0 && filtro !== f.id && "text-destructive")}>
                {f.label} <span className="opacity-70">({contagem(f.id)})</span>
              </button>
            ))}
          </div>
          {podeEditar && <Button size="sm" variant="outline" className="gap-1" onClick={onNova}><Plus className="h-3.5 w-3.5" /> Nova Tarefa</Button>}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {visiveis.map((t) => {
          const proc = t.processoId ? processos[t.processoId] : undefined;
          const concluida = t.status === "concluido";
          const resp = (t.responsaveisIds || []).map((id) => usuarios[id]).filter(Boolean);
          return (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <button onClick={() => podeEditar && onAlternar(t)} disabled={!podeEditar} className="mt-0.5 text-muted-foreground hover:text-primary disabled:hover:text-muted-foreground"
                title={concluida ? "Reabrir tarefa" : "Marcar como concluída"} aria-label={concluida ? "Reabrir tarefa" : "Concluir tarefa"}>
                {concluida ? <CheckSquare className="h-5 w-5 text-success" /> : <Square className="h-5 w-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => podeEditar && onEditar(t)}
                  className={cn("text-sm font-medium text-left", podeEditar && "hover:text-primary", concluida ? "line-through text-muted-foreground" : "text-foreground")}>
                  {t.titulo}
                </button>
                <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                  <span className={cn(atrasada(t) && "text-destructive font-medium")}>
                    {atrasada(t) ? "Atrasada · " : t.data === hoje && !concluida ? "Hoje · " : ""}{formatarData(t.data)}{t.horaInicio ? ` ${t.horaInicio}` : ""}
                  </span>
                  {proc && <Link to={`/processos/${proc.id}`} className="underline hover:text-foreground">{proc.numero || proc.titulo}</Link>}
                  {resp.length > 0 && <span>· {resp.join(", ")}</span>}
                  {t.prioridade && t.prioridade !== "Normal" && <span>· {t.prioridade}</span>}
                </p>
              </div>
              <StatusBadge status={t.status} />
              {podeEditar && <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => onEditar(t)} aria-label="Editar tarefa"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onExcluir(t)} aria-label="Excluir tarefa"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>}
            </li>
          );
        })}
      </ul>
      {visiveis.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">
          {tarefas.length === 0 ? "Nenhuma tarefa ainda. Use \"+ Nova Tarefa\" para criar a primeira." : "Nenhuma tarefa neste filtro."}
        </p>
      )}
    </div>
  );
}
