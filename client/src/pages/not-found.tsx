import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
      <Card className="w-full max-w-md mx-4 bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
          <p className="text-zinc-400 mb-6">
            This page doesn't exist or you may not have access to it.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-[#FDD000] text-black hover:bg-[#e6bc00] font-semibold"
          >
            Go Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
