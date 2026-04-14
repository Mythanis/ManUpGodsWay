import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { TourProvider, useTour } from "@/contexts/TourContext";
import { AppTour } from "@/components/app-tour";
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
import AdminEventRegistrants from "@/pages/admin-event-registrants";
import Owners from "@/pages/owners";
import StudyDetail from "@/pages/study-detail";
import DocumentViewer from "@/pages/document-viewer";
import WordViewer from "@/pages/word-viewer";
import AdminWordEditor from "@/pages/admin-word-editor";
import UserProfile from "@/pages/user-profile";
import NotificationPreferences from "@/pages/notification-preferences";
import Notifications from "@/pages/notifications";
import MoreManUp from "@/pages/more-man-up";
import Blog from "@/pages/blog";
import BlogDetail from "@/pages/blog-detail";
import HurdleWall from "@/pages/hurdle-wall";
import UnderFire from "@/pages/under-fire";
import WarGroups from "@/pages/war-groups";
import WarGroupDetail from "@/pages/war-group-detail";
import WarGroupRegister from "@/pages/war-group-register";
import Banned from "@/pages/banned";
import SeriesDetail from "@/pages/series-detail";
import BibleReadingPlan from "@/pages/bible-reading-plan";
import Purchase from "@/pages/purchase";
import Subscribe from "@/pages/subscribe";
import Bible from "@/pages/bible";
import Rations from "@/pages/rations";
import Journal from "@/pages/journal";
import RationsStore from "@/pages/rations-store";
import LiveStreamPage from "@/pages/live-stream";
import MyOrders from "@/pages/my-orders";
import PrivacySecurity from "@/pages/privacy-security";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsConditions from "@/pages/terms-conditions";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/navigation";
import { UserSetupWizard } from "@/components/user-setup-wizard";
import { NameCompletionModal } from "@/components/name-completion-modal";
import { AccountSettingsButton } from "@/components/account-settings-button";
import { TopRightLogo } from "@/components/top-right-logo";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { useTrialAccess } from "@/hooks/useTrialAccess";
import TrialPaywallModal from "@/components/trial-paywall-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Tracks the last path the user was on before navigating to the current one,
// so the paywall can send them back somewhere sensible.
const PrevLocationCtx = createContext<string>("/");

function TrialPageGuard({ area, children }: { area: string; children: React.ReactNode }) {
  const { isTourActive } = useTour();
  const { blocked, reason, isLoading } = useTrialAccess(area);
  const backTo = useContext(PrevLocationCtx);

  // During the tour, unlock all pages so the user can see everything
  if (isTourActive) return <>{children}</>;

  // While auth/settings are loading, show a spinner to avoid a flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FCD000]" />
      </div>
    );
  }

  if (blocked) {
    // Don't render the page at all — show a dark backdrop with the paywall modal
    return (
      <div className="min-h-screen bg-black">
        <TrialPaywallModal open={true} reason={reason} backTo={backTo} />
      </div>
    );
  }

  return <>{children}</>;
}

// Stable module-level wrapper components (Wouter v3 requires component= prop for conditional rendering)
const LibraryGuarded    = () => <TrialPageGuard area="studies"><Library /></TrialPageGuard>;
const VideosGuarded     = () => <TrialPageGuard area="videos"><Videos /></TrialPageGuard>;
const PodcastsGuarded   = () => <TrialPageGuard area="podcasts"><Podcasts /></TrialPageGuard>;
const CommunityGuarded  = () => <TrialPageGuard area="discussions"><Community /></TrialPageGuard>;
const BlogGuarded       = () => <TrialPageGuard area="blog"><Blog /></TrialPageGuard>;
const HurdleWallGuarded = () => <TrialPageGuard area="warRoom"><HurdleWall /></TrialPageGuard>;
const UnderFireGuarded  = () => <TrialPageGuard area="underFire"><UnderFire /></TrialPageGuard>;
const WarGroupsGuarded  = () => <TrialPageGuard area="warGroups"><WarGroups /></TrialPageGuard>;

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
  const { startTour, isTourActive } = useTour();
  const { toast } = useToast();

  // Track previous location so the paywall can send the user back somewhere sensible
  const [location] = useLocation();
  const locationRef = useRef(location);
  const [prevLocation, setPrevLocation] = useState("/");
  useEffect(() => {
    if (location !== locationRef.current) {
      setPrevLocation(locationRef.current);
      locationRef.current = location;
    }
  }, [location]);

  // Auto-launch tour on first login (profile complete, welcome popup dismissed, tour not completed yet)
  const hasLaunchedTourRef = useRef(false);
  useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      user.isProfileComplete &&
      user.hasSeenWelcome &&
      user.hasCompletedTour === false &&
      !isTourActive &&
      !hasLaunchedTourRef.current
    ) {
      hasLaunchedTourRef.current = true;
      // Small delay to let the page render first
      const timer = setTimeout(() => startTour(), 600);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, isTourActive, startTour]);

  // Check and award grace bonus once per session when a user logs in after 14+ days away
  const hasCheckedGraceRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || isLoading || hasCheckedGraceRef.current) return;
    hasCheckedGraceRef.current = true;
    apiRequest('POST', '/api/rations/grace-bonus').then((result: any) => {
      if (result?.success && result?.amount > 0) {
        toast({
          title: "Welcome back, soldier!",
          description: `You've been away a while — here are ${result.amount} rations for returning to the fight.`,
          duration: 6000,
        });
      }
    }).catch(() => {});
  }, [isAuthenticated, isLoading]);

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
    <PrevLocationCtx.Provider value={prevLocation}>
      <>
        {isAuthenticated && user && user.isProfileComplete && (!user.firstName?.trim() || !user.lastName?.trim()) && (
          <NameCompletionModal currentFirstName={user.firstName} currentLastName={user.lastName} />
        )}
        <Switch>
          <Route path="/banned" component={Banned} />
          {!isAuthenticated ? (
            <>
              <Route path="/" component={Landing} />
              <Route><Redirect to="/" /></Route>
            </>
          ) : (
            <>
              <Route path="/" component={Home} />
              <Route path="/library" component={LibraryGuarded} />
              <Route path="/series/:id" component={SeriesDetail} />
              <Route path="/bible-plans/:id" component={BibleReadingPlan} />
              <Route path="/videos" component={VideosGuarded} />
              <Route path="/podcasts" component={PodcastsGuarded} />
              <Route path="/challenges" component={Challenges} />
              <Route path="/fitness" component={Fitness} />
              <Route path="/fitness/plans/:planId" component={ViewPlan} />
              <Route path="/create-plan" component={CreatePlan} />
              <Route path="/edit-plan/:planId" component={EditPlan} />
              <Route path="/events" component={Events} />
              <Route path="/community" component={CommunityGuarded} />
              <Route path="/brothers" component={Brothers} />
              <Route path="/messages" component={Messages} />
              <Route path="/profile" component={Profile} />
              <Route path="/journal" component={Journal} />
              <Route path="/live" component={LiveStreamPage} />
              <Route path="/admin" component={Admin} />
              <Route path="/admin/events/:id/registrants" component={AdminEventRegistrants} />
              <Route path="/admin/studies/:id/edit-word" component={AdminWordEditor} />
              <Route path="/owners" component={Owners} />
              <Route path="/studies/:id" component={StudyDetail} />
              <Route path="/studies/:id/document" component={DocumentViewer} />
              <Route path="/studies/:id/word" component={WordViewer} />
              <Route path="/users/:userId" component={UserProfile} />
              <Route path="/notification-preferences" component={NotificationPreferences} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/blog" component={BlogGuarded} />
              <Route path="/blog/:slug" component={BlogDetail} />
              <Route path="/hurdle-wall" component={HurdleWallGuarded} />
              <Route path="/under-fire" component={UnderFireGuarded} />
              <Route path="/war-groups" component={WarGroupsGuarded} />
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
          <Route>
            {isAuthenticated ? <Redirect to="/" /> : <NotFound />}
          </Route>
        </Switch>

        {/* Persistent Account Settings Button for authenticated users */}
        {isAuthenticated && <AccountSettingsButton />}

        {/* Persistent Top Right Logo for authenticated users */}
        {isAuthenticated && <TopRightLogo />}
      </>
    </PrevLocationCtx.Provider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { splashCompleted } = useSplash();
  const { isTourActive } = useTour();

  // When a push notification arrives while the app is open, the service worker
  // broadcasts PUSH_RECEIVED so we can immediately refresh notifications and messages
  // without waiting for the next polling interval.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        // Also refetch any open message list
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  return (
    <div
      className="max-w-md mx-auto text-foreground shadow-2xl min-h-screen relative"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* During the tour all page content is read-only — interactions are blocked.
          The AppTour panel sits outside this wrapper so it stays clickable. */}
      <div className={isTourActive ? "pointer-events-none select-none" : ""}>
        {/* Add top padding to create space for the fixed header logo, but only when authenticated */}
        <div className={isAuthenticated ? "pt-24" : ""}>
          <Router />
        </div>
        {isAuthenticated && !isLoading && splashCompleted && <Navigation />}
        <PWAInstallPrompt />
      </div>
      {/* Tour overlay — renders on top of all content during onboarding */}
      {isAuthenticated && <AppTour />}
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
            <TourProvider>
              <AppContent />
            </TourProvider>
          </SplashContext.Provider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
