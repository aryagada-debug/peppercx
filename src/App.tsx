import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import DealDetail from "./pages/DealDetail";
import Staffing from "./pages/Staffing";
import Revenue from "./pages/Revenue";
import Targets from "./pages/Targets";
import RGYHealth from "./pages/RGYHealth";
import MBRTracker from "./pages/MBRTracker";
import SlackHealth from "./pages/SlackHealth";
import Onboarding from "./pages/Onboarding";
import DealDesk from "./pages/DealDesk";
import SEOStaffing from "./pages/SEOStaffing";
import GM2Calculator from "./pages/GM2Calculator";
import SettingsPage from "./pages/Settings";
import CentralCx from "./pages/CentralCx";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/deals" element={<Navigate to="/clients" replace />} />
            <Route path="/deals/:dealId" element={<ProtectedRoute><DealDetail /></ProtectedRoute>} />
            <Route path="/staffing" element={<ProtectedRoute><Staffing /></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
            <Route path="/targets" element={<ProtectedRoute><Targets /></ProtectedRoute>} />
            <Route path="/rgy-health" element={<ProtectedRoute><RGYHealth /></ProtectedRoute>} />
            <Route path="/mbr-tracker" element={<ProtectedRoute><MBRTracker /></ProtectedRoute>} />
            <Route path="/slack-health" element={<ProtectedRoute><SlackHealth /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/deal-desk" element={<ProtectedRoute><DealDesk /></ProtectedRoute>} />
            <Route path="/seo-staffing" element={<ProtectedRoute><SEOStaffing /></ProtectedRoute>} />
            <Route path="/gm2-calculator" element={<ProtectedRoute><GM2Calculator /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/central-cx" element={<ProtectedRoute><CentralCx /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
