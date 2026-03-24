import { X, ChevronRight, Map } from "lucide-react";
import { useTour, TOUR_STEPS } from "@/contexts/TourContext";
import { Button } from "@/components/ui/button";

export function AppTour() {
  const { isTourActive, tourStep, nextStep, closeTour } = useTour();

  if (!isTourActive) return null;

  const step = TOUR_STEPS[tourStep];
  const isLast = tourStep === TOUR_STEPS.length - 1;
  const progress = ((tourStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-[9999] pointer-events-none"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto border-2 border-[#FCD000] rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,1),4px_4px_0px_0px_rgba(252,208,0,0.5)] overflow-hidden"
        style={{ background: "#0d0d0d" }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10 w-full">
          <div
            className="h-full bg-[#FCD000] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Map className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FCD000]">
                App Tour — {tourStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button
              onClick={closeTour}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-sm border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step title */}
          <h3 className="text-base font-black text-white uppercase tracking-tight mb-1">
            {step.title}
          </h3>

          {/* Step description */}
          <p className="text-xs text-white/70 leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={closeTour}
              className="text-xs text-white/40 hover:text-white/70 font-bold uppercase tracking-wide transition-colors"
            >
              Skip Tour
            </button>

            <Button
              onClick={nextStep}
              className="bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase tracking-wide rounded-sm text-xs px-5 h-9 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex items-center gap-1.5"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
