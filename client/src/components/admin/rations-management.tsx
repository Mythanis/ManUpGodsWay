import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { Coins, Edit, Save, Search, User, Loader2, Plus, Minus } from "lucide-react";

interface ContentWithReward {
  id: string;
  title: string;
  category?: string;
  topic?: string;
  date?: string;
  dayNumber?: number;
  studyId?: string;
  rationReward: number;
}

interface UserWithRations {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  rations: number;
  rationRank: string;
}

interface ContentData {
  studies?: ContentWithReward[];
  lessons?: ContentWithReward[];
  videos?: ContentWithReward[];
  podcasts?: ContentWithReward[];
  devotionals?: ContentWithReward[];
  challenges?: ContentWithReward[];
}

export default function RationsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("studies");
  const [editingItem, setEditingItem] = useState<{ type: string; id: string; rationReward: number } | null>(null);
  const [bulkReward, setBulkReward] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<{ user: UserWithRations; open: boolean } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data: contentData, isLoading: contentLoading, error: contentError } = useQuery<ContentData>({
    queryKey: ['/api/admin/rations/content'],
  });

  // Debug: log any errors
  if (contentError) {
    console.error('Rations content error:', contentError);
  }

  const { data: usersData, isLoading: usersLoading } = useQuery<{
    users: UserWithRations[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['/api/admin/rations/users', userSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userSearch) params.set('search', userSearch);
      const res = await fetch(`/api/admin/rations/users?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: async ({ type, id, rationReward }: { type: string; id: string; rationReward: number }) => {
      const res = await apiRequest('PATCH', `/api/admin/rations/content/${type}/${id}`, { rationReward });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rations/content'] });
      toast({ title: "Reward updated successfully" });
      setEditingItem(null);
    },
    onError: () => {
      toast({ title: "Failed to update reward", variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ type, rationReward }: { type: string; rationReward: number }) => {
      const res = await apiRequest('PATCH', `/api/admin/rations/bulk/${type}`, { rationReward });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rations/content'] });
      toast({ title: `Updated ${data.count || 0} items` });
      setBulkReward("");
    },
    onError: () => {
      toast({ title: "Failed to bulk update", variant: "destructive" });
    },
  });

  const adjustRationsMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const res = await apiRequest('POST', '/api/admin/rations/adjust', { userId, amount, reason });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rations/users'] });
      toast({ title: "Rations adjusted successfully" });
      setAdjustDialog(null);
      setAdjustAmount("");
      setAdjustReason("");
    },
    onError: () => {
      toast({ title: "Failed to adjust rations", variant: "destructive" });
    },
  });

  const handleSaveReward = () => {
    if (!editingItem) return;
    updateRewardMutation.mutate(editingItem);
  };

  const handleBulkUpdate = () => {
    const reward = parseInt(bulkReward);
    if (isNaN(reward) || reward < 0) {
      toast({ title: "Please enter a valid reward amount", variant: "destructive" });
      return;
    }
    bulkUpdateMutation.mutate({ type: activeTab, rationReward: reward });
  };

  const handleAdjustRations = () => {
    if (!adjustDialog) return;
    const amount = parseInt(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      toast({ title: "Please enter a valid amount (positive or negative)", variant: "destructive" });
      return;
    }
    if (!adjustReason.trim()) {
      toast({ title: "Please enter a reason", variant: "destructive" });
      return;
    }
    adjustRationsMutation.mutate({
      userId: adjustDialog.user.id,
      amount,
      reason: adjustReason,
    });
  };

  const renderContentTable = (items: ContentWithReward[] | undefined, type: string, displayLabel: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No {displayLabel.toLowerCase()} found
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700">
              <TableHead className="text-gray-400">Title</TableHead>
              <TableHead className="text-gray-400">Category</TableHead>
              <TableHead className="text-gray-400 text-right">Ration Reward</TableHead>
              <TableHead className="text-gray-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="border-gray-700 hover:bg-gray-800/50">
                <TableCell className="font-medium text-white">
                  {type === 'lesson' && item.dayNumber ? `Day ${item.dayNumber}: ` : ''}
                  {item.title}
                </TableCell>
                <TableCell className="text-gray-400">
                  {item.category || item.topic || (item.date ? new Date(item.date).toLocaleDateString() : '-')}
                </TableCell>
                <TableCell className="text-right">
                  {editingItem?.id === item.id && editingItem?.type === type ? (
                    <Input
                      type="number"
                      value={editingItem.rationReward}
                      onChange={(e) => setEditingItem({ ...editingItem, rationReward: parseInt(e.target.value) || 0 })}
                      className="w-24 ml-auto bg-gray-800 border-gray-600 text-white"
                      data-testid={`input-ration-reward-${item.id}`}
                    />
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Coins className="w-3 h-3 mr-1" />
                      {item.rationReward}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingItem?.id === item.id && editingItem?.type === type ? (
                    <Button
                      size="sm"
                      onClick={handleSaveReward}
                      disabled={updateRewardMutation.isPending}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                      data-testid={`btn-save-reward-${item.id}`}
                    >
                      {updateRewardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingItem({ type, id: item.id, rationReward: item.rationReward })}
                      className="text-gray-400 hover:text-white"
                      data-testid={`btn-edit-reward-${item.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  };

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case 'elder': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'watchman': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'shepherd': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'warrior': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (contentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (contentError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <p className="font-bold mb-2">Failed to load content</p>
        <p className="text-sm">{(contentError as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            Content Ration Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-800 border-gray-700 mb-4 flex-wrap h-auto">
              <TabsTrigger value="studies" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Studies ({contentData?.studies?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="lessons" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Lessons ({contentData?.lessons?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Videos ({contentData?.videos?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="podcasts" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Podcasts ({contentData?.podcasts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="devotionals" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Devotionals ({contentData?.devotionals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="challenges" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Challenges ({contentData?.challenges?.length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4 mb-4 p-4 bg-gray-800 rounded-lg">
              <Label className="text-white whitespace-nowrap">Bulk Update All {activeTab}:</Label>
              <Input
                type="number"
                placeholder="Enter reward amount"
                value={bulkReward}
                onChange={(e) => setBulkReward(e.target.value)}
                className="w-40 bg-gray-700 border-gray-600 text-white"
                data-testid="input-bulk-reward"
              />
              <Button
                onClick={handleBulkUpdate}
                disabled={bulkUpdateMutation.isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                data-testid="btn-bulk-update"
              >
                {bulkUpdateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update All
              </Button>
            </div>

            <TabsContent value="studies">
              {renderContentTable(contentData?.studies, 'study', 'Studies')}
            </TabsContent>
            <TabsContent value="lessons">
              {renderContentTable(contentData?.lessons, 'lesson', 'Lessons')}
            </TabsContent>
            <TabsContent value="videos">
              {renderContentTable(contentData?.videos, 'video', 'Videos')}
            </TabsContent>
            <TabsContent value="podcasts">
              {renderContentTable(contentData?.podcasts, 'podcast', 'Podcasts')}
            </TabsContent>
            <TabsContent value="devotionals">
              {renderContentTable(contentData?.devotionals, 'devotional', 'Devotionals')}
            </TabsContent>
            <TabsContent value="challenges">
              {renderContentTable(contentData?.challenges, 'challenge', 'Challenges')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-yellow-500" />
            User Ration Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-600 text-white"
                data-testid="input-user-search"
              />
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">User</TableHead>
                    <TableHead className="text-gray-400">Rank</TableHead>
                    <TableHead className="text-gray-400 text-right">Rations</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users?.map((user) => (
                    <TableRow key={user.id} className="border-gray-700 hover:bg-gray-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profileImageUrl || undefined} />
                            <AvatarFallback className="bg-gray-700 text-gray-300">
                              {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRankBadgeColor(user.rationRank)}>
                          {user.rationRank?.charAt(0).toUpperCase() + user.rationRank?.slice(1) || 'Recruit'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <Coins className="w-3 h-3 mr-1" />
                          {user.rations || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustDialog({ user, open: true })}
                          className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                          data-testid={`btn-adjust-rations-${user.id}`}
                        >
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={adjustDialog?.open || false} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Adjust Rations for {adjustDialog?.user.firstName} {adjustDialog?.user.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Current Balance</div>
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-2">
                <Coins className="w-4 h-4 mr-2" />
                {adjustDialog?.user.rations || 0}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Amount (positive to add, negative to deduct)</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount(prev => String((parseInt(prev) || 0) - 100))}
                  className="border-gray-600"
                  data-testid="btn-decrease-100"
                >
                  <Minus className="w-4 h-4" /> 100
                </Button>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="bg-gray-800 border-gray-600 text-white text-center"
                  data-testid="input-adjust-amount"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount(prev => String((parseInt(prev) || 0) + 100))}
                  className="border-gray-600"
                  data-testid="btn-increase-100"
                >
                  <Plus className="w-4 h-4" /> 100
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Reason</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Enter reason for adjustment"
                className="bg-gray-800 border-gray-600 text-white"
                data-testid="input-adjust-reason"
              />
            </div>
            <Button
              onClick={handleAdjustRations}
              disabled={adjustRationsMutation.isPending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
              data-testid="btn-confirm-adjust"
            >
              {adjustRationsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
