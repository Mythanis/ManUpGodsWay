import { createContext, useContext, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface TourStep {
  route: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: "/",
    title: "Welcome Home",
    description:
      "This is your Home screen. From here you can see today's devotional, your current challenge, recommended studies, and quick links to everything the app has to offer.",
  },
  {
    route: "/library",
    title: "Studies",
    description:
      "Explore day-by-day Bible studies and multi-week series with full progress tracking. Each study contains daily lessons, scripture, reflection questions, and key takeaways.",
  },
  {
    route: "/community",
    title: "Community",
    description:
      "Connect and grow with other men. Post discussions, reply to others, honor great contributions, and build real fellowship with your brothers in the faith.",
  },
  {
    route: "/messages",
    title: "Messages",
    description:
      "Send and receive direct messages with other members, and participate in group conversations. Tap the compose button to start a new conversation with any brother in the app.",
  },
  {
    route: "/brothers",
    title: "Brothers",
    description:
      "Find and connect with other men in the app. Use the search bar to look up any member by name. Tap a user's profile picture to view their profile and send a brother request — building your personal circle of accountability.",
  },
  {
    route: "/war-groups",
    title: "War Groups",
    description:
      "Find or lead a local discipleship group near you. Browse groups on the map, join an existing group, or register your own. Every great man needs men to do life with.",
  },
  {
    route: "/videos",
    title: "Videos",
    description:
      "Access a growing library of teachings, sermons, and ministry videos organized by topic — leadership, fatherhood, character, marriage, and more.",
  },
  {
    route: "/podcasts",
    title: "Podcasts",
    description:
      "Listen to audio content you can take with you anywhere — during your commute, workout, or quiet time. New episodes added regularly.",
  },
  {
    route: "/challenges",
    title: "Weekly Challenges",
    description:
      "Sharpen your discipline with weekly spiritual and physical challenges. Accept the challenge, track your progress, and earn Rations for showing up.",
  },
  {
    route: "/hurdle-wall",
    title: "War Room",
    description:
      "A dedicated space to post and pray over one another's prayer requests. Real names, real faith, real intercession — stand in the gap for your brothers.",
  },
  {
    route: "/under-fire",
    title: "Under Fire",
    description:
      "Post an accountability request and connect with a brother who will come alongside you. Clicking 'Assist' opens a direct message so you can walk through it together.",
  },
  {
    route: "/events",
    title: "Events",
    description:
      "Find upcoming ministry events and purchase tickets directly inside the app. Single-tier and multi-tier pricing is supported — no external checkout required.",
  },
  {
    route: "/blog",
    title: "Blog",
    description:
      "Read articles, devotional posts, and teaching content from the Man Up God's Way ministry. A great place to go deeper between studies and find new perspectives on faith and leadership.",
  },
  {
    route: "/more-man-up",
    title: "Man Up Resources",
    description:
      "Quick links to the full Man Up God's Way ecosystem — the website, social media, merch, and more. Everything you need to stay connected to the mission beyond the app.",
  },
  {
    route: "/profile",
    title: "Your Profile",
    description:
      "Manage your account, subscription, notification preferences, and app settings. You can also view your study progress, Rations balance, and rank from here.",
  },
];

interface TourContextType {
  isTourActive: boolean;
  tourStep: number;
  startTour: () => void;
  nextStep: () => void;
  closeTour: () => void;
}

const TourContext = createContext<TourContextType>({
  isTourActive: false,
  tourStep: 0,
  startTour: () => {},
  nextStep: () => {},
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

  const closeTour = useCallback(() => {
    endTour();
  }, [endTour]);

  return (
    <TourContext.Provider value={{ isTourActive, tourStep, startTour, nextStep, closeTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
