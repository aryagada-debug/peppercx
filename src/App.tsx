import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Clients from "./pages/Clients.tsx";
import DealDetail from "./pages/DealDetail.tsx";
import Staffing from "./pages/Staffing.tsx";
import Revenue from "./pages/Revenue.tsx";
import Targets from "./pages/Targets.tsx";
import RGYHealth from "./pages/RGYHealth.tsx";
import MBRTracker from "./pages/MBRTracker.tsx";
import SlackHealth from "./pages/SlackHealth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import DealDesk from "./pages/DealDesk.tsx";
import SEOStaffing from "./pages/SEOStaffing.tsx";
import GM2Calculator from "./pages/GM2Calculator.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/deals" element={<Navigate to="/clients" replace />} />
          <Route path="/deals/:dealId" element={<DealDetail />} />
          <Route path="/staffing" element={<Staffing />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/rgy-health" element={<RGYHealth />} />
          <Route path="/mbr-tracker" element={<MBRTracker />} />
          <Route path="/slack-health" element={<SlackHealth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/deal-desk" element={<DealDesk />} />
          <Route path="/seo-staffing" element={<SEOStaffing />} />
          <Route path="/gm2-calculator" element={<GM2Calculator />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
