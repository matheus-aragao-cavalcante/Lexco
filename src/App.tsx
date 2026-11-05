import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Processos from "./pages/Processos";
import ProcessoDetalhe from "./pages/ProcessoDetalhe";
import Prazos from "./pages/Prazos";
import Agenda from "./pages/Agenda";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import PartesInteressadas from "./pages/PartesInteressadas";
import ParteDetalhe from "./pages/ParteDetalhe";
import PerfilUsuario from "./pages/PerfilUsuario";
import NotFound from "./pages/NotFound";
import { SplashScreen } from "@/components/SplashScreen";
import { DriveBackupProvider } from "@/contexts/DriveBackupContext";
import { CompartilhamentoProvider } from "@/contexts/CompartilhamentoContext";
import EscolherAmbiente from "./pages/EscolherAmbiente";
import { useEffect, useState } from "react";


const queryClient = new QueryClient();

function AppRoutes() {
  const { loading } = useAuth();
  return (
    <>
      <SplashScreen ready={!loading} />
      {!loading && <AppContent />}
    </>
  );
}

function AppContent() {
  const { currentUser, podeGerenciarUsuarios, ambiente, ambientesDisponiveis, ambienteEscolhido } = useAuth();
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const f = () => setVersao((v) => v + 1);
    window.addEventListener("lexco:recarregar-telas", f);
    return () => window.removeEventListener("lexco:recarregar-telas", f);
  }, []);

  if (!currentUser) return <Login />;
  if (ambientesDisponiveis.length > 0 && !ambienteEscolhido) return <EscolherAmbiente />;

  // A chave remonta as telas ao trocar de ambiente (cada um tem o seu banco).
  return (
    <Routes key={`${ambiente?.id ?? "proprio"}-${versao}`}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/processos" element={<Processos />} />
      <Route path="/processos/:id" element={<ProcessoDetalhe />} />
      <Route path="/prazos" element={<Prazos />} />
      <Route path="/agenda" element={<Agenda />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/usuarios" element={podeGerenciarUsuarios ? <Usuarios /> : <NotFound />} />
      <Route path="/partes" element={<PartesInteressadas />} />
      <Route path="/partes/:id" element={<ParteDetalhe />} />
      <Route path="/perfil" element={<PerfilUsuario />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DriveBackupProvider>
            <CompartilhamentoProvider>
              <AppRoutes />
            </CompartilhamentoProvider>
          </DriveBackupProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
