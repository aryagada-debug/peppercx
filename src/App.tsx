import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserRoleProvider } from "@/hooks/useUserRole";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { GeoFilterProvider } from "@/contexts/GeoFilterContext";
import { RouteFallback } from "./components/layout/RouteFallback";
import { useStaffingSeeder } from "@/hooks/queries/useStaffingMutations";
import { useGlobalHorizontalScroll } from "@/hooks/useGlobalHorizontalScroll";

// Auth pages stay eager — login screen must paint instantly.
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import CalendarCallback from "./pages/CalendarCallback";
import GmailCallback from "./pages/GmailCallback";

// Authenticated pages are code-split — each becomes its own chunk so the
// initial bundle drops from ~2.7 MB to roughly the shell + the landing route.
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Clients = lazy(() => import("./pages/Clients"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const Staffing = lazy(() => import("./pages/Staffing"));
const Targets = lazy(() => import("./pages/Targets"));
const RGYHealth = lazy(() => import("./pages/RGYHealth"));
const MBRTracker = lazy(() => import("./pages/MBRTracker"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Help = lazy(() => import("./pages/Help"));
const Trash = lazy(() => import("./pages/Trash"));
const PeopleOps = lazy(() => import("./pages/PeopleOps"));
const Contacts = lazy(() => import("./pages/Contacts"));
const LeadershipInterventions = lazy(() => import("./pages/LeadershipInterventions"));
const Inbox = lazy(() => import("./pages/Inbox"));
const PulseNPS = lazy(() => import("./pages/PulseNPS"));
const PulseNPSAnalytics = lazy(() => import("./pages/PulseNPSAnalytics"));
const DealHandover = lazy(() => import("./pages/DealHandover"));
const PublicSurvey = lazy(() => import("./pages/PublicSurvey"));
const SurveyForm = lazy(() => import("./pages/SurveyForm"));

// Mounts the one-shot seeder under the auth provider so it can read the
// session and only fire when staffing_people is empty.
function StaffingSeederMount() {
  useStaffingSeeder();
  return null;
}

// Enables seamless wheel→horizontal scroll on wide tables across every module.
function GlobalScrollMount() {
  useGlobalHorizontalScroll();
  return null;
}

function isPublicSurveyRequest(location?: ReturnType<typeof useLocation>) {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const hasSurveyQuery = !!params.get("survey");
    const hasSurveyHash = /^#\/s\//.test(window.location.hash || "");
    const path = location?.pathname || window.location.pathname || "";
    const hasSurveyPath = /^\/(?:s|survey)(?:\/|$)/.test(path);
    return hasSurveyQuery || hasSurveyHash || hasSurveyPath;
  }
  return /^\/(?:s|survey)(?:\/|$)/.test(location?.pathname || "");
}

function RootRoute() {
  if (isPublicSurveyRequest()) return <SurveyForm />;
  return <Navigate to="/home" replace />;
}

function AppRoutes() {
  return (
    <AuthProvider>
      <UserRoleProvider>
        <CurrencyProvider>
          <GeoFilterProvider>
            <StaffingSeederMount />
            <GlobalScrollMount />
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/calendar/callback" element={<CalendarCallback />} />
              <Route path="/gmail/callback" element={<GmailCallback />} />

              {/* Protected routes */}
              <Route path="/home" element={<ProtectedRoute routeKey="home"><Home /></ProtectedRoute>} />
              <Route path="/" element={<RootRoute />} />
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
              <Route path="/clients" element={<ProtectedRoute routeKey="clients"><Clients /></ProtectedRoute>} />
              <Route path="/deals" element={<Navigate to="/clients" replace />} />
              <Route path="/deals/:dealId" element={<ProtectedRoute routeKey="clients"><DealDetail /></ProtectedRoute>} />
              <Route path="/staffing" element={<ProtectedRoute routeKey="staffing"><Staffing /></ProtectedRoute>} />
              <Route path="/people-ops" element={<ProtectedRoute routeKey="people-ops"><PeopleOps /></ProtectedRoute>} />
              <Route path="/targets" element={<ProtectedRoute routeKey="targets"><Targets /></ProtectedRoute>} />
              <Route path="/rgy-health" element={<ProtectedRoute routeKey="rgy-health"><RGYHealth /></ProtectedRoute>} />
              <Route path="/pulse-nps" element={<ProtectedRoute routeKey="rgy-health" adminOnly><PulseNPS /></ProtectedRoute>} />
              <Route path="/pulse-nps/analytics" element={<ProtectedRoute routeKey="rgy-health" adminOnly><PulseNPSAnalytics /></ProtectedRoute>} />
              <Route path="/deal-handover" element={<ProtectedRoute routeKey="home" adminOnly><DealHandover /></ProtectedRoute>} />
              <Route path="/mbr-tracker" element={<ProtectedRoute routeKey="mbr-tracker"><MBRTracker /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute routeKey="onboarding"><Onboarding /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute routeKey="settings"><SettingsPage /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute routeKey="home"><Help /></ProtectedRoute>} />
              <Route path="/trash" element={<ProtectedRoute routeKey="settings"><Trash /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute routeKey="home"><Contacts /></ProtectedRoute>} />
              <Route path="/leadership-interventions" element={<ProtectedRoute routeKey="home"><LeadershipInterventions /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute routeKey="home"><Inbox /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </GeoFilterProvider>
        </CurrencyProvider>
      </UserRoleProvider>
    </AuthProvider>
  );
}

function RouterSwitch() {
  const location = useLocation();
  if (isPublicSurveyRequest(location)) return <SurveyForm />;
  return <AppRoutes />;
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
          <Suspense fallback={<RouteFallback />}>
            <RouterSwitch />
          </Suspense>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
