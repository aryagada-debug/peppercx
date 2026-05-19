import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserRoleProvider } from "@/hooks/useUserRole";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { RouteFallback } from "./components/layout/RouteFallback";
import { useStaffingSeeder } from "@/hooks/queries/useStaffingMutations";

// Auth pages stay eager — login screen must paint instantly.
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import CalendarCallback from "./pages/CalendarCallback";

// Authenticated pages are code-split — each becomes its own chunk so the
// initial bundle drops from ~2.7 MB to roughly the shell + the landing route.
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Clients = lazy(() => import("./pages/Clients"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const Staffing = lazy(() => import("./pages/Staffing"));
const Revenue = lazy(() => import("./pages/Revenue"));
const Targets = lazy(() => import("./pages/Targets"));
const RGYHealth = lazy(() => import("./pages/RGYHealth"));
const MBRTracker = lazy(() => import("./pages/MBRTracker"));
const SlackHealth = lazy(() => import("./pages/SlackHealth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const DealDesk = lazy(() => import("./pages/DealDesk"));
const SEOStaffing = lazy(() => import("./pages/SEOStaffing"));
const GM2Calculator = lazy(() => import("./pages/GM2Calculator"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const CentralCx = lazy(() => import("./pages/CentralCx"));

// Mounts the one-shot seeder under the auth provider so it can read the
// session and only fire when staffing_people is empty.
function StaffingSeederMount() {
  useStaffingSeeder();
  return null;
}

// React Query defaults tuned for an internal data app: keep responses fresh
// for 5 min and cache for 30 min so navigating between pages doesn't refetch
// the same tables, and don't refetch on every window focus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      // Refetch when the tab regains focus so edits made elsewhere
      // (other tabs, other users) show up without manual reload.
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <UserRoleProvider>
          <CurrencyProvider>
          <StaffingSeederMount />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/calendar/callback" element={<CalendarCallback />} />

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
          </Suspense>
          </CurrencyProvider>
          </UserRoleProvider>
          </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
