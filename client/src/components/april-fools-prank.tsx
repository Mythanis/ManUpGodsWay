import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const PRANK_USER_IDS = new Set(["46399196", "46399698"]);
const STORAGE_KEY = "april_fools_2026_done";

export function AprilFoolsPrank() {
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState<"hidden" | "red" | "gold">("hidden");

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!PRANK_USER_IDS.has(user.id)) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Start the prank — show black overlay + red box
    setPhase("red");

    const timer = setTimeout(() => {
      setPhase("gold");
    }, 10000);

    return () => clearTimeout(timer);
  }, [user, isLoading]);

  const handleOkay = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setPhase("hidden");
  };

  if (phase === "hidden") return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {/* Phase 1: Red error box in upper-right */}
      {phase === "red" && (
        <div
          className="absolute top-4 right-4 max-w-sm w-full rounded-md border border-red-500 bg-[#1a0000] text-white shadow-2xl shadow-red-900/50 overflow-hidden"
          style={{ fontFamily: "monospace" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-red-700">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
            </div>
            <span className="text-xs font-bold tracking-wide uppercase text-red-100 ml-1">
              Critical Error
            </span>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl mt-0.5 flex-shrink-0">⚠</span>
              <div>
                <p className="text-sm font-bold text-red-300 mb-1">DatabaseCorruptionError</p>
                <p className="text-xs text-red-100 leading-relaxed">
                  App crashed due to database corruption, potential data loss. Do not close the app
                  as a database recovery is attempted.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-300 animate-pulse">
                    Recovery in progress…
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Ministry Gold box centered */}
      {phase === "gold" && (
        <div className="bg-ministry-gold rounded-xl border-4 border-yellow-500 shadow-2xl px-8 py-8 max-w-sm w-full mx-4 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <h2 className="text-2xl font-extrabold text-black mb-3 leading-tight">
            April Fools, God Bless and have a wonderful day!
          </h2>
          <p className="text-sm text-black font-medium mb-6">
            Click okay to continue to the app
          </p>
          <Button
            onClick={handleOkay}
            className="bg-black text-ministry-gold hover:bg-gray-900 font-bold px-8 py-2 text-base rounded-lg w-full"
          >
            Okay
          </Button>
        </div>
      )}
    </div>
  );
}
