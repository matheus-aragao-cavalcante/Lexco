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

const queryClient = new QueryClient();

function AppRoutes() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/processos" element={<Processos />} />
      <Route path="/processos/:id" element={<ProcessoDetalhe />} />
      <Route path="/prazos" element={<Prazos />} />
      <Route path="/agenda" element={<Agenda />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/usuarios" element={<Usuarios />} />
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
