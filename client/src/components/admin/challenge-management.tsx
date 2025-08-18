import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ChallengeForm from "./challenge-form";
import { 
  Plus, 
  Edit2, 
  Trash2,
  Calendar,
  Trophy,
  Clock
} from "lucide-react";
import { formatDistanceToNow, format, startOfWeek, addDays } from "date-fns";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  topic: string;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export default function ChallengeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);


  // Fetch all challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['admin', 'challenges'],
    queryFn: async () => {
      const response = await fetch('/api/admin/challenges', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch challenges');
      return response.json();
    },
  });

  // Create challenge mutation
  const createChallengeMutation = useMutation({
    mutationFn: (challengeData: any) =>
      fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeData),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges'] });
      setShowCreateDialog(false);
      toast({
        title: "Success",
        description: "Challenge created successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create challenge",
        variant: "destructive"
      });
    }
  });

  // Update challenge mutation
  const updateChallengeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/challenges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges'] });
      setShowEditDialog(false);
      setEditingChallenge(null);
      toast({
        title: "Success",
        description: "Challenge updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update challenge",
        variant: "destructive"
      });
    }
  });

  // Delete challenge mutation
  const deleteChallengeMutation = useMutation({
    mutationFn: (challengeId: string) =>
      fetch(`/api/challenges/${challengeId}`, {
        method: 'DELETE',
        credentials: 'include'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges'] });
      toast({
        title: "Success",
        description: "Challenge deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete challenge",
        variant: "destructive"
      });
    }
  });

  const handleEdit = useCallback((challenge: Challenge) => {
    setEditingChallenge(challenge);
    setShowEditDialog(true);
  }, []);

  const handleCreateSubmit = useCallback((challengeData: any) => {
    if (!challengeData.title || !challengeData.releaseDate) {
      toast({
        title: "Error",
        description: "Please fill in required fields (title and release date)",
        variant: "destructive"
      });
      return;
    }
    createChallengeMutation.mutate(challengeData);
  }, [createChallengeMutation, toast]);

  const handleEditSubmit = useCallback((challengeData: any) => {
    if (!challengeData.title || !challengeData.releaseDate) {
      toast({
        title: "Error",
        description: "Please fill in required fields (title and release date)",
        variant: "destructive"
      });
      return;
    }
    if (editingChallenge) {
      updateChallengeMutation.mutate({ id: editingChallenge.id, data: challengeData });
    }
  }, [editingChallenge, updateChallengeMutation, toast]);

  const handleDelete = (challengeId: string) => {
    if (confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
      deleteChallengeMutation.mutate(challengeId);
    }
  };

  // Get the Monday date for display
  const getMondayDisplay = useCallback((releaseDate: string) => {
    const date = new Date(releaseDate);
    return format(date, 'MMM d, yyyy');
  }, []);



  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-ministry-charcoal">Challenge Management</h2>
          <p className="text-ministry-slate">Create and manage weekly challenges for the community</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-ministry-gold hover:bg-ministry-gold/90 text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Challenge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Challenge</DialogTitle>
            </DialogHeader>
            <ChallengeForm
              challenge={null}
              onSubmit={handleCreateSubmit}
              onCancel={() => setShowCreateDialog(false)}
              isSubmitting={createChallengeMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingChallenge(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Challenge</DialogTitle>
            </DialogHeader>
            <ChallengeForm
              challenge={editingChallenge}
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingChallenge(null);
              }}
              isSubmitting={updateChallengeMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
        </div>
      ) : challenges.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Challenges Yet</h3>
            <p className="text-ministry-slate mb-4">Create your first challenge to get started</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-ministry-gold hover:bg-ministry-gold/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Challenge
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge: Challenge) => (
            <Card key={challenge.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-ministry-gold/20 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-ministry-gold" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg text-ministry-charcoal mb-1">
                            {challenge.title}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-ministry-slate mb-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {challenge.topic}
                            </Badge>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              Releases {getMondayDisplay(challenge.releaseDate)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {challenge.description && (
                        <p className="text-ministry-slate text-sm mb-3 line-clamp-2">
                          {challenge.description}
                        </p>
                      )}

                      <div className="flex items-center space-x-6 text-sm text-ministry-slate">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Created {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(challenge)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(challenge.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}