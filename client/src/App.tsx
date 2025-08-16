import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Library from "@/pages/library";
import Videos from "@/pages/videos";
import Community from "@/pages/community";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import StudyDetail from "@/pages/study-detail";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/navigation";
import { UserSetupWizard } from "@/components/user-setup-wizard";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard for new users
  if (isAuthenticated && user && !user.isProfileComplete) {
    return (
      <UserSetupWizard 
        onComplete={() => window.location.reload()} 
      />
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/library" component={Library} />
          <Route path="/videos" component={Videos} />
          <Route path="/community" component={Community} />
          <Route path="/messages" component={Messages} />
          <Route path="/profile" component={Profile} />
          <Route path="/admin" component={Admin} />
          <Route path="/studies/:id" component={StudyDetail} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="max-w-md mx-auto bg-background text-foreground shadow-2xl min-h-screen relative">
      <Router />
      {isAuthenticated && !isLoading && <Navigation />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
