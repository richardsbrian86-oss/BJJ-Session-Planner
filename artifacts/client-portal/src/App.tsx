import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientAuthProvider } from "@/lib/client-auth";
import { InstructorAuthProvider } from "@/lib/instructor-auth";
import { SiteHeader } from "@/components/site-header";
import NotFound from "@/pages/not-found";
import InstructorDirectory from "@/pages/instructor-directory";
import InstructorProfile from "@/pages/instructor-profile";
import BookingFlow from "@/pages/booking-flow";
import BookingSuccess from "@/pages/booking-success";
import BookingConfirmation from "@/pages/booking-confirmation";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ClientDashboard from "@/pages/client-dashboard";
import VerifyEmail from "@/pages/verify-email";
import InstructorLogin from "@/pages/instructor-login";
import InstructorDashboard from "@/pages/instructor-dashboard";
import InstructorForgotPassword from "@/pages/instructor-forgot-password";
import InstructorResetPassword from "@/pages/instructor-reset-password";
import InstructorForgotPin from "@/pages/instructor-forgot-pin";
import InstructorResetPin from "@/pages/instructor-reset-pin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const NO_HEADER_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/instructor/login",
  "/instructor/forgot-password",
  "/instructor/reset-password",
  "/instructor/forgot-pin",
  "/instructor/reset-pin",
]);

function Router() {
  return (
    <Switch>
      <Route path="/" component={InstructorDirectory} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/instructor/login" component={InstructorLogin} />
      <Route path="/instructor/forgot-password" component={InstructorForgotPassword} />
      <Route path="/instructor/reset-password" component={InstructorResetPassword} />
      <Route path="/instructor/forgot-pin" component={InstructorForgotPin} />
      <Route path="/instructor/reset-pin" component={InstructorResetPin} />
      <Route path="/instructor/dashboard" component={InstructorDashboard} />
      <Route path="/booking/:token" component={BookingConfirmation} />
      <Route path="/:slug/book" component={BookingFlow} />
      <Route path="/:slug/success" component={BookingSuccess} />
      <Route path="/:slug" component={InstructorProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout() {
  return (
    <>
      <SiteHeader />
      <Router />
    </>
  );
}

function App() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <ClientAuthProvider>
        <InstructorAuthProvider>
          <TooltipProvider>
            <WouterRouter base={baseUrl}>
              <Layout />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </InstructorAuthProvider>
      </ClientAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
