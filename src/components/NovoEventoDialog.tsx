import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EventoDialog } from "@/components/EventoDialog";
import { Plus } from "lucide-react";

/** Wrapper compatível com a API antiga (`<NovoEventoDialog />`). */
export function NovoEventoDialog({ processoId, initialDate, onSaved }: { processoId?: string; initialDate?: string; onSaved?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo Evento</Button>
      <EventoDialog open={open} onOpenChange={setOpen} processoId={processoId} initialDate={initialDate} onSaved={onSaved} />
    </>
  );
}
