import { ChevronLeft, ChevronRight, Map, X } from "lucide-react";
import { useTour, TOUR_STEPS } from "@/contexts/TourContext";

const STEP_ICONS: Record<string, string> = {
  "Welcome Home": "🏠",
  "Studies": "📖",
  "Community": "🤝",
  "Messages": "💬",
  "Brothers": "⚔️",
  "War Groups": "🛡️",
  "Videos": "🎬",
  "Podcasts": "🎧",
  "Weekly Challenges": "🎯",
  "War Room": "🙏",
  "Under Fire": "🔥",
  "Events": "📅",
  "Fitness Add-On": "💪",
  "Blog": "📰",
  "Man Up Resources": "🔗",
  "Your Profile": "👤",
};

export function AppTour() {
  const { isTourActive, tourStep, nextStep, prevStep, closeTour } = useTour();

  if (!isTourActive) return null;

  const step = TOUR_STEPS[tourStep];
  const isLast = tourStep === TOUR_STEPS.length - 1;
  const isFirst = tourStep === 0;
  const progress = ((tourStep + 1) / TOUR_STEPS.length) * 100;
  const icon = STEP_ICONS[step?.title] ?? "📌";

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-[9999] pointer-events-none"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto overflow-hidden"
        style={{
          background: "#0d0d0d",
          border: "2px solid #FCD000",
          borderRadius: "2px",
          boxShadow: "4px 4px 0px 0px rgba(252,208,0,0.4)",
        }}
      >
        {/* Gold header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: "#FCD000" }}
        >
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-black flex-shrink-0" />
            <span className="text-black font-black text-xs uppercase tracking-[0.18em]">
              App Tour
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-black/60 font-bold text-xs">
              {tourStep + 1} of {TOUR_STEPS.length}
            </span>
            <button
              onClick={closeTour}
              className="w-5 h-5 flex items-center justify-center rounded-sm bg-black/15 hover:bg-black/25 transition-colors"
              aria-label="Skip tour"
            >
              <X className="w-3 h-3 text-black" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 w-full">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#FCD000" }}
          />
        </div>

        {/* Content */}
        <div className="px-4 pt-3.5 pb-3">
          {/* Icon + title */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-xl leading-none">{icon}</span>
            <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">
              {step?.title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-sm text-white/85 leading-relaxed mb-3">
            {step?.description}
          </p>

          {/* Navigation row */}
          <div className="flex items-center justify-between gap-3">
            {isFirst ? (
              <button
                onClick={closeTour}
                className="text-xs text-white/40 hover:text-white/70 font-bold uppercase tracking-wide transition-colors"
              >
                Skip Tour
              </button>
            ) : (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 font-bold uppercase tracking-wide transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-5 h-8 text-black font-black uppercase tracking-wide text-xs rounded-sm transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "#FCD000",
                border: "2px solid #000",
                boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              }}
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1 pb-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === tourStep ? "14px" : "5px",
                height: "5px",
                background: i === tourStep ? "#FCD000" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
