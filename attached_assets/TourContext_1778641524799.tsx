import { createContext, useContext, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface TourStep {
  route: string;
  title: string;
  description: string;
}

/**
 * TRIMMED TOUR — 5 essential steps only.
 *
 * Reasoning: New users need to know what to DO first, not everything
 * the app can do. All other features (Videos, Podcasts, Messages, Blog,
 * Brothers, War Groups, Events, Fitness, Resources) are discoverable
 * through the home screen tiles and push notifications during their
 * first week. Showing 16 steps on day 1 causes skip rates and drop-off.
 *
 * All steps use route "/" so the user stays on the home screen
 * and isn't bounced across 16 different pages during onboarding.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    route: "/",
    title: "Welcome Home",
    description:
      "This is your home base. Check today's devotional, your active Bible study, weekly challenge, and quick links to every feature — all from right here.",
  },
  {
    route: "/library",
    title: "Bible Studies",
    description:
      "Structured day-by-day lessons with scripture, reflection questions, and full progress tracking. Pick a series and show up daily — each lesson builds on the last.",
  },
  {
    route: "/hurdle-wall",
    title: "War Room",
    description:
      "A sacred space to post and pray over one another's prayer requests. Real names, real faith, real intercession — stand in the gap for your brothers.",
  },
  {
    route: "/under-fire",
    title: "Under Fire — Accountability",
    description:
      "Post an accountability request and connect with a brother who will come alongside you. One tap opens a private conversation so the partnership stays real.",
  },
  {
    route: "/profile",
    title: "You're Ready, Soldier",
    description:
      "Manage your subscription, notifications, and settings from your Profile. Your Rations balance and rank are tracked here too. Now get to work — the brotherhood is waiting.",
  },
];

interface TourContextType {
  isTourActive: boolean;
  tourStep: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  closeTour: () => void;
}

const TourContext = createContext<TourContextType>({
  isTourActive: false,
  tourStep: 0,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  closeTour: () => {},
});

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const endTour = useCallback(async () => {
    setIsTourActive(false);
    setTourStep(0);
    try {
      await apiRequest("POST", "/api/user/complete-tour");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      // Silently fail — tour completion is best-effort
    }
  }, [queryClient]);

  const startTour = useCallback(() => {
    setTourStep(0);
    setIsTourActive(true);
    navigate(TOUR_STEPS[0].route);
  }, [navigate]);

  const nextStep = useCallback(() => {
    const next = tourStep + 1;
    if (next >= TOUR_STEPS.length) {
      endTour();
    } else {
      setTourStep(next);
      navigate(TOUR_STEPS[next].route);
    }
  }, [tourStep, navigate, endTour]);

  const prevStep = useCallback(() => {
    if (tourStep > 0) {
      const prev = tourStep - 1;
      setTourStep(prev);
      navigate(TOUR_STEPS[prev].route);
    }
  }, [tourStep, navigate]);

  const closeTour = useCallback(() => {
    endTour();
  }, [endTour]);

  return (
    <TourContext.Provider value={{ isTourActive, tourStep, startTour, nextStep, prevStep, closeTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
