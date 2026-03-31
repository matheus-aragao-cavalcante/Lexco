import { cn } from "@/lib/utils";

type StatusType = "ativo" | "pendente" | "concluido" | "atrasado" | "cumprido" | "urgente" | "inativo" | "arquivado" | "cancelado";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-primary/10 text-primary border-primary/20" },
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20" },
  concluido: { label: "Concluído", className: "bg-success/10 text-success border-success/20" },
  atrasado: { label: "Atrasado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  cumprido: { label: "Cumprido", className: "bg-success/10 text-success border-success/20" },
  urgente: { label: "Urgente", className: "bg-primary/15 text-primary border-primary/30 font-semibold" },
  inativo: { label: "Inativo", className: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
