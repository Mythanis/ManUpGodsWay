import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserX, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SilencedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
}

export function SilencedUsersButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [silencedDialogOpen, setSilencedDialogOpen] = useState(false);
  const [silencedToRemove, setSilencedToRemove] = useState<Set<string>>(new Set());

  // Fetch silenced users
  const { data: silencedData } = useQuery<{ silencedUserIds: string[] }>({
    queryKey: ["/api/users/silenced"],
    retry: false,
  });

  // Fetch user details for silenced users
  const { data: allUsers = [] } = useQuery<SilencedUser[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const silencedUsers = silencedData?.silencedUserIds 
    ? allUsers.filter(user => silencedData.silencedUserIds.includes(user.id))
    : [];

  // Unsilence users mutation
  const unsilenceUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await Promise.all(
        userIds.map(userId => apiRequest("DELETE", `/api/users/${userId}/silence`))
      );
    },
    onSuccess: () => {
      toast({
        title: "Users Unsilenced",
        description: "Selected users have been unsilenced successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/silenced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSilencedToRemove(new Set());
      setSilencedDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unsilence users. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleSilencedUser = (userId: string) => {
    const newSet = new Set(silencedToRemove);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSilencedToRemove(newSet);
  };

  const handleSaveSilencedChanges = () => {
    if (silencedToRemove.size > 0) {
      unsilenceUsersMutation.mutate(Array.from(silencedToRemove));
    } else {
      setSilencedDialogOpen(false);
    }
  };

  return (
    <Dialog open={silencedDialogOpen} onOpenChange={setSilencedDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-muted border-b border-border"
          onClick={() => {
            setSilencedToRemove(new Set());
            setSilencedDialogOpen(true);
          }}
          data-testid="button-silenced-users"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-ministry-steel/20 flex items-center justify-center">
              <UserX className="w-4 h-4 text-ministry-steel" />
            </div>
            <div className="text-left">
              <span className="font-medium text-foreground">Silenced Users</span>
              <p className="text-xs text-muted-foreground">
                Manage users you have silenced ({silencedUsers.length} users)
              </p>
            </div>
          </div>
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Silenced Users</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {silencedUsers.length === 0 ? (
            <p className="text-center text-ministry-slate py-8">
              No silenced users
            </p>
          ) : (
            <div className="space-y-2">
              {silencedUsers.map((user) => (
                <div 
                  key={user.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    silencedToRemove.has(user.id) 
                      ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950' 
                      : 'border-ministry-steel hover:bg-ministry-steel/5'
                  }`}
                  onClick={() => handleToggleSilencedUser(user.id)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatar || ''} alt={user.firstName || ''} />
                    <AvatarFallback className="bg-ministry-gold/20 text-ministry-gold">
                      {user.firstName?.[0] || user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ministry-charcoal dark:text-white truncate">
                      {user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email}
                    </p>
                    <p className="text-xs text-ministry-slate truncate">
                      {user.email}
                    </p>
                  </div>
                  {silencedToRemove.has(user.id) && (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {silencedUsers.length > 0 && (
          <div className="flex justify-between pt-4">
            <p className="text-xs text-ministry-slate self-center">
              {silencedToRemove.size > 0 ? `${silencedToRemove.size} selected to unsilence` : 'Click users to unsilence them'}
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setSilencedDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSilencedChanges}
                disabled={unsilenceUsersMutation.isPending}
                className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              >
                {unsilenceUsersMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}