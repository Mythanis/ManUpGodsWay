import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Medal } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface HonorButtonProps {
  type: 'discussion' | 'reply';
  id: string;
  initialCount: number;
  isHonored?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  showText?: boolean;
}

export function HonorButton({ 
  type, 
  id, 
  initialCount, 
  isHonored = false, 
  variant = "ghost",
  size = "sm",
  showText = true 
}: HonorButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [honored, setHonored] = useState(isHonored);
  const [count, setCount] = useState(initialCount);

  const honorMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === 'discussion' 
        ? `/api/discussions/${id}/honor`
        : `/api/replies/${id}/honor`;
      return await apiRequest('POST', endpoint);
    },
    onSuccess: (data) => {
      const newHonored = data.honored;
      setHonored(newHonored);
      setCount(prev => newHonored ? prev + 1 : prev - 1);
      
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/discussions'] });
      if (type === 'discussion') {
        queryClient.invalidateQueries({ queryKey: ['/api/discussions', id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/discussions', '*', 'replies'] });
      }
    },
    onError: (error) => {
      console.error('Honor error:', error);
      toast({
        title: "Error",
        description: "Failed to update honor. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleHonor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to honor posts.",
        variant: "destructive",
      });
      return;
    }
    
    honorMutation.mutate();
  };

  return (
    <Button
      variant={honored ? "default" : variant}
      size={size}
      onClick={handleHonor}
      disabled={honorMutation.isPending}
      className={`flex items-center space-x-1 ${
        honored 
          ? 'bg-ministry-gold text-black hover:bg-ministry-gold/90' 
          : 'text-ministry-slate hover:text-ministry-gold hover:bg-ministry-gold/10'
      }`}
    >
      <Medal className={`w-4 h-4 ${honored ? 'fill-current' : ''}`} />
      {showText && (
        <span className="text-xs">
          {count > 0 ? count : ''}
          {count !== 1 ? '' : ''} Honor{count !== 1 ? 's' : ''}
        </span>
      )}
    </Button>
  );
}