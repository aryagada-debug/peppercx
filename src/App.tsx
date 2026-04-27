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
import Home from "./pages/Home";
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
            <Route path="/home" element={<ProtectedRoute routeKey="home"><Home /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute routeKey="dashboard"><Index /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute routeKey="clients"><Clients /></ProtectedRoute>} />
            <Route path="/deals" element={<Navigate to="/clients" replace />} />
            <Route path="/deals/:dealId" element={<ProtectedRoute routeKey="clients"><DealDetail /></ProtectedRoute>} />
            <Route path="/staffing" element={<ProtectedRoute routeKey="staffing"><Staffing /></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute routeKey="revenue"><Revenue /></ProtectedRoute>} />
            <Route path="/targets" element={<ProtectedRoute routeKey="targets"><Targets /></ProtectedRoute>} />
            <Route path="/rgy-health" element={<ProtectedRoute routeKey="rgy-health"><RGYHealth /></ProtectedRoute>} />
            <Route path="/mbr-tracker" element={<ProtectedRoute routeKey="mbr-tracker"><MBRTracker /></ProtectedRoute>} />
            <Route path="/slack-health" element={<ProtectedRoute routeKey="slack-health"><SlackHealth /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute routeKey="onboarding"><Onboarding /></ProtectedRoute>} />
            <Route path="/deal-desk" element={<ProtectedRoute routeKey="deal-desk"><DealDesk /></ProtectedRoute>} />
            <Route path="/seo-staffing" element={<ProtectedRoute routeKey="seo-staffing"><SEOStaffing /></ProtectedRoute>} />
            <Route path="/gm2-calculator" element={<ProtectedRoute routeKey="gm2-calculator"><GM2Calculator /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute routeKey="settings"><SettingsPage /></ProtectedRoute>} />
            <Route path="/central-cx" element={<ProtectedRoute routeKey="central-cx"><CentralCx /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
