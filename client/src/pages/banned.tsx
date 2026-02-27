import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Banned() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md w-full">
        <div className="mb-6 flex justify-center">
          <div className="bg-red-600 rounded-full p-4 border-4 border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.4)]">
            <Shield className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
          Account Suspended
        </h1>
        <div className="w-16 h-1 bg-red-600 mx-auto mb-6" />

        <p className="text-white/70 text-base leading-relaxed mb-4">
          Your account has been suspended by an administrator and you no longer have access to Man Up God's Way.
        </p>
        <p className="text-white/50 text-sm leading-relaxed mb-8">
          If you believe this was done in error, please reach out to the ministry leadership directly for assistance.
        </p>

        <Button
          onClick={() => { window.location.href = "/api/logout"; }}
          className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wide px-8 py-3 rounded-sm border-2 border-red-400 shadow-[3px_3px_0px_0px_rgba(220,38,38,0.5)] transition-all"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
