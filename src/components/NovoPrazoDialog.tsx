import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrazoDialog } from "@/components/PrazoDialog";
import { Plus } from "lucide-react";

/** Wrapper compatível com a API antiga (`<NovoPrazoDialog />`). */
export function NovoPrazoDialog({ processoId, onSaved }: { processoId?: string; onSaved?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo Prazo</Button>
      <PrazoDialog open={open} onOpenChange={setOpen} processoId={processoId} onSaved={onSaved} />
    </>
  );
}
