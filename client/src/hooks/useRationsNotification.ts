import { useToast } from "@/hooks/use-toast";

interface RationResult {
  success: boolean;
  amount: number;
  newBalance: number;
  newRank?: string;
  rankUp?: boolean;
  message?: string;
}

const RANK_LABELS: Record<string, string> = {
  recruit: "Recruit",
  warrior: "Warrior", 
  shepherd: "Shepherd",
  watchman: "Watchman",
  elder: "Elder",
};

export function useRationsNotification() {
  const { toast } = useToast();

  const showRationsEarned = (result: RationResult | null | undefined) => {
    if (!result?.success || !result.amount) return;

    if (result.rankUp && result.newRank) {
      toast({
        title: `🎖️ RANK UP! ${RANK_LABELS[result.newRank] || result.newRank}`,
        description: `You've been promoted! +${result.amount} rations earned.`,
        duration: 5000,
      });
    } else {
      toast({
        title: `+${result.amount} Rations Earned!`,
        description: `New balance: ${result.newBalance.toLocaleString()}`,
        duration: 3000,
      });
    }
  };

  const showRationsSpent = (amount: number, description: string) => {
    toast({
      title: `${amount} Rations Spent`,
      description,
      duration: 3000,
    });
  };

  const showDailyLimitReached = (missionType: string) => {
    toast({
      title: "Daily Limit Reached",
      description: `You've reached the daily limit for this mission type. Try again tomorrow!`,
      variant: "destructive",
      duration: 4000,
    });
  };

  return {
    showRationsEarned,
    showRationsSpent,
    showDailyLimitReached,
  };
}
