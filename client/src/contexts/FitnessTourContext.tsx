import { createContext, useContext, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type FitnessTab =
  | "workout"
  | "community"
  | "exercises"
  | "favorites"
  | "pre-built-plans"
  | "my-plans"
  | "nutrition"
  | "intake"
  | "health";

export interface FitnessTourStep {
  tab: FitnessTab;
  title: string;
  description: string;
}

export const FITNESS_TOUR_STEPS: FitnessTourStep[] = [
  {
    tab: "workout",
    title: "Workout",
    description:
      "This is your armory, where you gear up. Each day shows the exercises scheduled for you with an estimated duration. Tap Begin to launch the guided workout player — it walks you through every set, rep, and rest period one screen at a time so you can stay focused on the lift, not the phone.",
  },
  {
    tab: "community",
    title: "Community",
    description:
      "A members-only feed for fitness conversation. Share progress, ask for help, drop nutrition tips, and react to your brothers with Amen or Oh Me. Comment, share, and build real accountability around your physical discipline.",
  },
  {
    tab: "exercises",
    title: "Exercises",
    description:
      "Browse the full exercise library. Search by name or filter by body part, equipment, and difficulty. Tap any exercise to see clear instructions, demonstration media, and the muscle groups it targets — perfect for learning new movements before you add them to a plan.",
  },
  {
    tab: "favorites",
    title: "Favorites",
    description:
      "Your shortlist of go-to movements. Tap the heart on any exercise and it lands here for instant access — no more digging through filters when you already know what you want to train.",
  },
  {
    tab: "pre-built-plans",
    title: "Plans",
    description:
      "Generate or view AI-recommended fitness plans tailored to your goals. Pick one up and you've got a full multi-week program ready to go without building anything from scratch.",
  },
  {
    tab: "my-plans",
    title: "My Plans",
    description:
      "Your personal plan library. Create a new plan from the ground up, edit existing ones, and schedule them onto your calendar. Full control over what your week of training looks like.",
  },
  {
    tab: "nutrition",
    title: "Nutrition",
    description:
      "Look up calories and macros for almost any food, powered by the USDA FoodData Central database. Search a name, see the nutrition breakdown, and use it to plan meals or check your numbers on the fly.",
  },
  {
    tab: "intake",
    title: "Intake",
    description:
      "Log what you eat and watch your daily, weekly, and monthly calorie totals come together. Set meal reminders here too — gentle nudges that help you stay consistent with your nutrition without having to remember on your own.",
  },
  {
    tab: "health",
    title: "Health",
    description:
      "Your full vitals dashboard. Track weight, heart rate, steps, sleep, and more. Set goals, watch the progress charts move, and see the long-term picture of how your body is responding to the work you're putting in.",
  },
];

const TOUR_STEP_KEY = "fitnessTourLastStep";

interface FitnessTourContextType {
  isFitnessTourActive: boolean;
  fitnessTourStep: number;
  savedTourStep: number | null;
  targetTab: FitnessTab | null;
  startFitnessTour: () => void;
  nextFitnessStep: () => void;
  prevFitnessStep: () => void;
  closeFitnessTour: () => void;
}

const FitnessTourContext = createContext<FitnessTourContextType>({
  isFitnessTourActive: false,
  fitnessTourStep: 0,
  savedTourStep: null,
  targetTab: null,
  startFitnessTour: () => {},
  nextFitnessStep: () => {},
  prevFitnessStep: () => {},
  closeFitnessTour: () => {},
});

export function FitnessTourProvider({ children }: { children: React.ReactNode }) {
  const [isFitnessTourActive, setIsFitnessTourActive] = useState(false);
  const [fitnessTourStep, setFitnessTourStep] = useState(0);
  const [savedTourStep, setSavedTourStep] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(TOUR_STEP_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {}
    return null;
  });
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const targetTab: FitnessTab | null = isFitnessTourActive
    ? FITNESS_TOUR_STEPS[fitnessTourStep]?.tab ?? null
    : null;

  const endFitnessTour = useCallback(async () => {
    setIsFitnessTourActive(false);
    setFitnessTourStep(0);
    try {
      localStorage.removeItem(TOUR_STEP_KEY);
      setSavedTourStep(null);
    } catch {}
    try {
      await apiRequest("POST", "/api/user/complete-fitness-tour");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
    }
  }, [queryClient]);

  const startFitnessTour = useCallback(() => {
    const resumeStep = savedTourStep ?? 0;
    setFitnessTourStep(resumeStep);
    setIsFitnessTourActive(true);
    navigate("/fitness");
  }, [navigate, savedTourStep]);

  const nextFitnessStep = useCallback(() => {
    const next = fitnessTourStep + 1;
    if (next >= FITNESS_TOUR_STEPS.length) {
      endFitnessTour();
    } else {
      setFitnessTourStep(next);
    }
  }, [fitnessTourStep, endFitnessTour]);

  const prevFitnessStep = useCallback(() => {
    if (fitnessTourStep > 0) {
      setFitnessTourStep(fitnessTourStep - 1);
    }
  }, [fitnessTourStep]);

  const closeFitnessTour = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STEP_KEY, String(fitnessTourStep));
      setSavedTourStep(fitnessTourStep);
    } catch {}
    setIsFitnessTourActive(false);
    setFitnessTourStep(0);
  }, [fitnessTourStep]);

  return (
    <FitnessTourContext.Provider
      value={{
        isFitnessTourActive,
        fitnessTourStep,
        savedTourStep,
        targetTab,
        startFitnessTour,
        nextFitnessStep,
        prevFitnessStep,
        closeFitnessTour,
      }}
    >
      {children}
    </FitnessTourContext.Provider>
  );
}

export function useFitnessTour() {
  return useContext(FitnessTourContext);
}
