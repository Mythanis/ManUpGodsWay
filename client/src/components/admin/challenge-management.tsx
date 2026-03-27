import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ChallengeForm from "./challenge-form";
import { 
  Plus, Edit2, Trash2, Calendar, Trophy, Clock, Zap,
  Upload, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2, Eye
} from "lucide-react";
import { formatDistanceToNow, format, startOfWeek, addDays, nextMonday } from "date-fns";

const VALID_TOPICS = ['leadership', 'marriage', 'fatherhood', 'character', 'faith', 'discipline', 'service', 'growth'];

interface Challenge {
  id: string;
  title: string;
  description?: string;
  topic: string;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ParsedChallenge {
  title: string;
  description: string;
  topic: string;
  releaseDate: string;
}

// ─── Bulk Import Section ───────────────────────────────────────────────────────

function BulkImportSection({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const next = nextMonday(new Date());
    return format(next, 'yyyy-MM-dd');
  });
  const [defaultTopic, setDefaultTopic] = useState('faith');
  const [bulkText, setBulkText] = useState('');
  const [preview, setPreview] = useState<ParsedChallenge[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const parseChallenges = useCallback((): ParsedChallenge[] => {
    if (!bulkText.trim() || !startDate) return [];

    const blocks = bulkText.split(/\n---\n|\n\n\n/).map(b => b.trim()).filter(Boolean);
    const base = new Date(startDate + 'T12:00:00Z');

    return blocks.slice(0, 52).map((block, i) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0] || `Week ${i + 1} Challenge`;

      // Look for "Topic: <value>" line anywhere
      const topicLine = lines.find(l => l.toLowerCase().startsWith('topic:'));
      const rawTopic = topicLine?.split(':')[1]?.trim().toLowerCase() ?? '';
      const topic = VALID_TOPICS.includes(rawTopic) ? rawTopic : defaultTopic;

      // Description = everything except title and topic line
      const description = lines.filter(l => l !== lines[0] && !l.toLowerCase().startsWith('topic:')).join('\n');

      const releaseDate = new Date(base);
      releaseDate.setDate(base.getDate() + i * 7);

      return {
        title,
        description,
        topic,
        releaseDate: releaseDate.toISOString(),
      };
    });
  }, [bulkText, startDate, defaultTopic]);

  const handlePreview = () => {
    const parsed = parseChallenges();
    if (!parsed.length) {
      toast({ title: "Nothing to preview", description: "Add challenge entries first.", variant: "destructive" });
      return;
    }
    setPreview(parsed);
    setShowPreview(true);
  };

  const bulkImportMutation = useMutation({
    mutationFn: async (challenges: ParsedChallenge[]) =>
      await apiRequest('POST', '/api/admin/challenges/bulk', { challenges }),
    onSuccess: (data: any) => {
      toast({ title: `${data.created} challenges imported!`, description: "They'll release one week apart starting from your chosen date." });
      setBulkText('');
      setPreview([]);
      setShowPreview(false);
      setOpen(false);
      onSuccess();
    },
    onError: (e: any) => {
      toast({ title: "Import failed", description: e.message || "Could not import challenges", variant: "destructive" });
    },
  });

  const handleImport = () => {
    const parsed = parseChallenges();
    if (!parsed.length) {
      toast({ title: "Nothing to import", description: "Add at least one challenge.", variant: "destructive" });
      return;
    }
    bulkImportMutation.mutate(parsed);
  };

  const exampleText = `Read your Bible every day this week
Topic: faith
Open your Bible each morning before checking your phone. Read at least one chapter every day for 7 days.
---
Have a real conversation with your kids
Topic: fatherhood
Put the phone down. Sit with your kids and ask them what's going on in their lives. Listen — really listen.
---
Tell someone the truth they need to hear
Topic: character
Think of someone in your life who needs honest, loving correction or encouragement. Do it this week.`;

  return (
    <div>
      <Button
        onClick={() => setOpen(!open)}
        variant="outline"
        className="border-ministry-gold/50 text-ministry-gold hover:bg-ministry-gold/10 font-bold"
      >
        <Upload className="w-4 h-4 mr-2" />
        Bulk Import
        {open ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </Button>

      {open && (
        <div className="mt-4 border-2 border-ministry-gold/30 rounded-lg bg-ministry-gold/5 p-5 space-y-5">
          <div>
            <h3 className="font-black text-ministry-charcoal text-base uppercase tracking-wide">52-Week Bulk Import</h3>
            <p className="text-ministry-slate text-sm mt-1">
              Paste up to 52 challenges below — one per block, separated by <code className="bg-black/10 px-1 rounded text-xs">---</code> on its own line. Each challenge releases 7 days after the previous.
            </p>
          </div>

          {/* Config row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-ministry-charcoal text-xs font-bold uppercase tracking-wide">Start Date (Week 1)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-2 border-gray-200"
              />
              <p className="text-xs text-ministry-slate">Recommended: a Monday</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-ministry-charcoal text-xs font-bold uppercase tracking-wide">Default Topic</Label>
              <Select value={defaultTopic} onValueChange={setDefaultTopic}>
                <SelectTrigger className="border-2 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_TOPICS.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-ministry-slate">Used when no "Topic:" line is set</p>
            </div>
          </div>

          {/* Format guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 space-y-1">
            <p className="font-bold uppercase tracking-wide">Format per block:</p>
            <p><span className="font-mono bg-blue-100 px-1 rounded">Line 1:</span> Challenge title (required)</p>
            <p><span className="font-mono bg-blue-100 px-1 rounded">Topic: faith</span> Topic (optional — uses default if omitted)</p>
            <p><span className="font-mono bg-blue-100 px-1 rounded">Remaining lines:</span> Description (optional)</p>
            <p className="mt-2">Valid topics: {VALID_TOPICS.join(', ')}</p>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-ministry-charcoal text-xs font-bold uppercase tracking-wide">
                Challenges ({bulkText.split(/\n---\n|\n\n\n/).filter(b => b.trim()).length} entered)
              </Label>
              <button
                className="text-xs text-ministry-slate underline hover:text-ministry-charcoal"
                onClick={() => setBulkText(exampleText)}
                type="button"
              >
                Load example
              </button>
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setShowPreview(false); }}
              placeholder={`Challenge title here\nTopic: faith\nOptional description here.\n---\nNext challenge title\nTopic: discipline\n...`}
              rows={14}
              className="font-mono text-sm border-2 border-gray-200 resize-y"
            />
          </div>

          {/* Preview */}
          {showPreview && preview.length > 0 && (
            <div className="border-2 border-gray-200 rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                <span className="font-black text-sm uppercase tracking-wide text-ministry-charcoal flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Preview — {preview.length} challenges
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {preview.map((ch, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ministry-gold flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-black">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-ministry-charcoal truncate">{ch.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs capitalize py-0">{ch.topic}</Badge>
                        <span className="text-xs text-ministry-slate">{format(new Date(ch.releaseDate), 'MMM d, yyyy')}</span>
                      </div>
                      {ch.description && (
                        <p className="text-xs text-ministry-slate mt-1 line-clamp-1">{ch.description}</p>
                      )}
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!bulkText.trim()}
              className="border-2 border-gray-300 font-bold"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview ({Math.min(bulkText.split(/\n---\n|\n\n\n/).filter(b => b.trim()).length, 52)} challenges)
            </Button>
            <Button
              onClick={handleImport}
              disabled={bulkImportMutation.isPending || !bulkText.trim()}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black font-black"
            >
              {bulkImportMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</>
                : <><Upload className="w-4 h-4 mr-2" /> Import All</>}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setOpen(false); setBulkText(''); setPreview([]); setShowPreview(false); }}
              className="text-ministry-slate"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ChallengeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  const { data: allChallenges = [], isLoading } = useQuery({
    queryKey: ['admin', 'challenges'],
    queryFn: async () => {
      const response = await fetch('/api/admin/challenges', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch challenges');
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: currentWeekChallenge } = useQuery({
    queryKey: ['api', 'challenges', 'current'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/current?t=${Date.now()}`, {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  });

  const createChallengeMutation = useMutation({
    mutationFn: (challengeData: any) =>
      fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeData),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      invalidateAll();
      setShowCreateDialog(false);
      toast({ title: "Success", description: "Challenge created successfully" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create challenge", variant: "destructive" }),
  });

  const updateChallengeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/challenges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      invalidateAll();
      setShowEditDialog(false);
      setEditingChallenge(null);
      toast({ title: "Success", description: "Challenge updated successfully" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update challenge", variant: "destructive" }),
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: (challengeId: string) =>
      fetch(`/api/challenges/${challengeId}`, { method: 'DELETE', credentials: 'include' }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Success", description: "Challenge deleted successfully" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete challenge", variant: "destructive" }),
  });

  const pushToCurrentMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const response = await fetch(`/api/challenges/${challengeId}/push-to-current`, { method: 'POST', credentials: 'include' });
      return response.json();
    },
    onSuccess: (updatedChallenge) => {
      queryClient.setQueryData(['api', 'challenges', 'current'], updatedChallenge);
      queryClient.setQueryData(['admin', 'challenges'], (old: any) =>
        old?.map((c: any) => c.id === updatedChallenge.id ? { ...c, releaseDate: updatedChallenge.releaseDate } : c)
      );
      invalidateAll();
      toast({ title: "Success", description: `"${updatedChallenge.title}" is now the current week's challenge!` });
    },
    onError: () => toast({ title: "Error", description: "Failed to push challenge to current week", variant: "destructive" }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
    queryClient.invalidateQueries({ queryKey: ['api', 'challenges'] });
    queryClient.refetchQueries({ queryKey: ['admin', 'challenges'] });
    queryClient.refetchQueries({ queryKey: ['api', 'challenges', 'current'] });
  };

  const handleEdit = useCallback((challenge: Challenge) => {
    setEditingChallenge(challenge);
    setShowEditDialog(true);
  }, []);

  const handleDelete = (challengeId: string) => {
    if (confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
      deleteChallengeMutation.mutate(challengeId);
    }
  };

  const handlePushToCurrent = (challengeId: string, challengeTitle: string) => {
    if (currentWeekChallenge?.id === challengeId) {
      toast({ title: "Already Current", description: `"${challengeTitle}" is already the current week's challenge.` });
      return;
    }
    if (confirm(`Push "${challengeTitle}" to current week?`)) {
      pushToCurrentMutation.mutate(challengeId);
    }
  };

  const handleCreateSubmit = useCallback((challengeData: any) => {
    if (!challengeData.title || !challengeData.releaseDate) {
      toast({ title: "Error", description: "Please fill in required fields (title and release date)", variant: "destructive" });
      return;
    }
    createChallengeMutation.mutate(challengeData);
  }, [createChallengeMutation, toast]);

  const handleEditSubmit = useCallback((challengeData: any) => {
    if (!challengeData.title || !challengeData.releaseDate) {
      toast({ title: "Error", description: "Please fill in required fields (title and release date)", variant: "destructive" });
      return;
    }
    if (editingChallenge) {
      updateChallengeMutation.mutate({ id: editingChallenge.id, data: challengeData });
    }
  }, [editingChallenge, updateChallengeMutation, toast]);

  const challenges = [...allChallenges].sort((a: Challenge, b: Challenge) => {
    const now = new Date();
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
    const endOfThisWeek = addDays(startOfThisWeek, 6);
    const aDate = new Date(a.releaseDate);
    const bDate = new Date(b.releaseDate);

    const cat = (ch: Challenge) => {
      if (currentWeekChallenge && ch.id === currentWeekChallenge.id) return 1;
      return new Date(ch.releaseDate) > endOfThisWeek ? 0 : 2;
    };

    const aCat = cat(a), bCat = cat(b);
    if (aCat !== bCat) return aCat - bCat;
    if (aCat === 0 || aCat === 1) return aDate.getTime() - bDate.getTime();
    return bDate.getTime() - aDate.getTime();
  });

  return (
    <div>
      {/* Header + actions */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-ministry-charcoal">Challenge Management</h2>
          <p className="text-ministry-slate">Create and manage weekly challenges for the community</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-ministry-gold hover:bg-ministry-gold/90 text-black font-bold">
                <Plus className="w-4 h-4 mr-2" />
                New Challenge
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create New Challenge</DialogTitle></DialogHeader>
              <ChallengeForm challenge={null} onSubmit={handleCreateSubmit} onCancel={() => setShowCreateDialog(false)} isSubmitting={createChallengeMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk import */}
      <div className="mb-6">
        <BulkImportSection onSuccess={invalidateAll} />
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditingChallenge(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Challenge</DialogTitle></DialogHeader>
          <ChallengeForm challenge={editingChallenge} onSubmit={handleEditSubmit} onCancel={() => { setShowEditDialog(false); setEditingChallenge(null); }} isSubmitting={updateChallengeMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Challenge list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold" />
        </div>
      ) : challenges.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Challenges Yet</h3>
            <p className="text-ministry-slate mb-4">Create your first challenge or use Bulk Import to add a full 52-week schedule</p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-ministry-gold hover:bg-ministry-gold/90">
              <Plus className="w-4 h-4 mr-2" /> Create Challenge
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge: Challenge) => {
            const isCurrentWeek = currentWeekChallenge?.id === challenge.id;
            const challengeDate = new Date(challenge.releaseDate);
            const endOfThisWeek = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6);
            const isFuture = challengeDate > endOfThisWeek && !isCurrentWeek;

            return (
              <Card key={challenge.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-16 h-16 rounded-lg bg-ministry-gold-exact flex items-center justify-center shrink-0">
                        <Trophy className="w-8 h-8 text-ministry-gold" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-lg text-ministry-charcoal">{challenge.title}</h3>
                          {isCurrentWeek && <Badge className="bg-ministry-gold text-black">Current</Badge>}
                          {isFuture && <Badge className="bg-blue-100 text-blue-800 border-blue-200">Future</Badge>}
                          {!isCurrentWeek && !isFuture && <Badge variant="outline" className="text-ministry-slate">Past</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-ministry-slate mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{challenge.topic}</Badge>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Releases {format(new Date(challenge.releaseDate), 'MMM d, yyyy')}
                          </div>
                        </div>
                        {challenge.description && (
                          <p className="text-ministry-slate text-sm mb-2 line-clamp-2">{challenge.description}</p>
                        )}
                        <div className="flex items-center text-sm text-ministry-slate">
                          <Clock className="w-4 h-4 mr-1" />
                          Created {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!isCurrentWeek && (
                        <Button variant="outline" size="sm"
                          onClick={() => handlePushToCurrent(challenge.id, challenge.title)}
                          disabled={pushToCurrentMutation.isPending}
                          className="text-ministry-gold hover:text-ministry-gold/80 hover:bg-ministry-gold/10 border-ministry-gold/30"
                          title="Push to current week"
                        >
                          <Zap className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleEdit(challenge)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(challenge.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
