import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import SplashScreen from "@/components/splash-screen";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Library from "@/pages/library";
import Videos from "@/pages/videos";
import Podcasts from "@/pages/podcasts";
import Challenges from "@/pages/challenges";
import Fitness from "@/pages/fitness";
import CreatePlan from "@/pages/create-plan";
import EditPlan from "@/pages/edit-plan";
import ViewPlan from "@/pages/view-plan";
import Events from "@/pages/events";
import Community from "@/pages/community";
import Brothers from "@/pages/brothers";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import Owners from "@/pages/owners";
import StudyDetail from "@/pages/study-detail";
import DocumentViewer from "@/pages/document-viewer";
import WordViewer from "@/pages/word-viewer";
import AdminWordEditor from "@/pages/admin-word-editor";
import UserProfile from "@/pages/user-profile";
import NotificationPreferences from "@/pages/notification-preferences";
import MoreManUp from "@/pages/more-man-up";
import Blog from "@/pages/blog";
import BlogDetail from "@/pages/blog-detail";
import HurdleWall from "@/pages/hurdle-wall";
import UnderFire from "@/pages/under-fire";
import WarGroups from "@/pages/war-groups";
import WarGroupDetail from "@/pages/war-group-detail";
import WarGroupRegister from "@/pages/war-group-register";
import SeriesDetail from "@/pages/series-detail";
import Purchase from "@/pages/purchase";
import Subscribe from "@/pages/subscribe";
import Bible from "@/pages/bible";
import Rations from "@/pages/rations";
import RationsStore from "@/pages/rations-store";
import MyOrders from "@/pages/my-orders";
import PrivacySecurity from "@/pages/privacy-security";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsConditions from "@/pages/terms-conditions";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/navigation";
import { UserSetupWizard } from "@/components/user-setup-wizard";
import { AccountSettingsButton } from "@/components/account-settings-button";
import { TopRightLogo } from "@/components/top-right-logo";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { useTrialAccess } from "@/hooks/useTrialAccess";
import TrialPaywallModal from "@/components/trial-paywall-modal";

function TrialPageGuard({ area, children }: { area: string; children: React.ReactNode }) {
  const { blocked, reason } = useTrialAccess(area);
  return (
    <>
      <TrialPaywallModal open={blocked} reason={reason} onClose={() => {}} />
      {children}
    </>
  );
}

// Splash screen context
const SplashContext = createContext<{
  splashCompleted: boolean;
  setSplashCompleted: (completed: boolean) => void;
}>({
  splashCompleted: false,
  setSplashCompleted: () => {},
});

const useSplash = () => useContext(SplashContext);

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { splashCompleted, setSplashCompleted } = useSplash();

  // Skip splash screen for purchase pages
  const isPurchasePage = window.location.pathname.includes('/purchase');
  
  // Show splash screen first (on every app load), unless it's a purchase page
  if (!splashCompleted && !isPurchasePage) {
    return <SplashScreen onComplete={() => setSplashCompleted(true)} />;
  }
  
  // If this is a purchase page and splash hasn't completed, mark it as completed
  if (!splashCompleted && isPurchasePage) {
    setSplashCompleted(true);
  }

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
    <>
      <Switch>
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/library">
              <TrialPageGuard area="studies"><Library /></TrialPageGuard>
            </Route>
            <Route path="/series/:id" component={SeriesDetail} />
            <Route path="/videos">
              <TrialPageGuard area="videos"><Videos /></TrialPageGuard>
            </Route>
            <Route path="/podcasts">
              <TrialPageGuard area="podcasts"><Podcasts /></TrialPageGuard>
            </Route>
            <Route path="/challenges" component={Challenges} />
            <Route path="/fitness" component={Fitness} />
            <Route path="/fitness/plans/:planId" component={ViewPlan} />
            <Route path="/create-plan" component={CreatePlan} />
            <Route path="/edit-plan/:planId" component={EditPlan} />
            <Route path="/events" component={Events} />
            <Route path="/community">
              <TrialPageGuard area="discussions"><Community /></TrialPageGuard>
            </Route>
            <Route path="/brothers" component={Brothers} />
            <Route path="/messages" component={Messages} />
            <Route path="/profile" component={Profile} />
            <Route path="/admin" component={Admin} />
            <Route path="/admin/studies/:id/edit-word" component={AdminWordEditor} />
            <Route path="/owners" component={Owners} />
            <Route path="/studies/:id" component={StudyDetail} />
            <Route path="/studies/:id/document" component={DocumentViewer} />
            <Route path="/studies/:id/word" component={WordViewer} />
            <Route path="/users/:userId" component={UserProfile} />
            <Route path="/notification-preferences" component={NotificationPreferences} />
            <Route path="/blog">
              <TrialPageGuard area="blog"><Blog /></TrialPageGuard>
            </Route>
            <Route path="/blog/:slug" component={BlogDetail} />
            <Route path="/hurdle-wall">
              <TrialPageGuard area="warRoom"><HurdleWall /></TrialPageGuard>
            </Route>
            <Route path="/under-fire">
              <TrialPageGuard area="underFire"><UnderFire /></TrialPageGuard>
            </Route>
            <Route path="/war-groups">
              <TrialPageGuard area="warGroups"><WarGroups /></TrialPageGuard>
            </Route>
            <Route path="/war-groups/register" component={WarGroupRegister} />
            <Route path="/war-groups/:id" component={WarGroupDetail} />
            <Route path="/subscribe" component={Subscribe} />
            <Route path="/purchase" component={Purchase} />
            <Route path="/purchase/:studyId" component={Purchase} />
            <Route path="/bible" component={Bible} />
            <Route path="/rations" component={Rations} />
            <Route path="/rations-store" component={RationsStore} />
            <Route path="/my-orders" component={MyOrders} />
            <Route path="/privacy-security" component={PrivacySecurity} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-conditions" component={TermsConditions} />
            <Route path="/more-man-up" component={MoreManUp} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
      
      {/* Persistent Account Settings Button for authenticated users */}
      {isAuthenticated && <AccountSettingsButton />}
      
      {/* Persistent Top Right Logo for authenticated users */}
      {isAuthenticated && <TopRightLogo />}
    </>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { splashCompleted } = useSplash();

  return (
    <div className="max-w-md mx-auto bg-background text-foreground shadow-2xl min-h-screen relative">
      {/* Add top padding to create space for the fixed header logo, but only when authenticated */}
      <div className={isAuthenticated ? "pt-24" : ""}>
        <Router />
      </div>
      {isAuthenticated && !isLoading && splashCompleted && <Navigation />}
      <PWAInstallPrompt />
    </div>
  );
}

function App() {
  const [splashCompleted, setSplashCompleted] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SplashContext.Provider value={{ splashCompleted, setSplashCompleted }}>
            <AppContent />
          </SplashContext.Provider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
