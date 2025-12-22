import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Users, MapPin, Calendar, Crown, Trash2, Search, Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  };
  memberCount: number;
  isLicensed: boolean;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
}

interface GroupMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  };
}

export default function WarGroupsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<WarGroup | null>(null);
  const [showChangeLeaderDialog, setShowChangeLeaderDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedNewLeader, setSelectedNewLeader] = useState("");

  const { data: groups = [], isLoading: groupsLoading } = useQuery<WarGroup[]>({
    queryKey: ["/api/admin/war-groups"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: [`/api/admin/users?search=${userSearchQuery}`],
    enabled: showChangeLeaderDialog,
  });

  const { data: members = [] } = useQuery<GroupMember[]>({
    queryKey: [`/api/admin/war-groups/${selectedGroup?.id}/members`],
    enabled: showMembersDialog && !!selectedGroup,
  });

  const changeLeaderMutation = useMutation({
    mutationFn: async ({ groupId, newLeaderId }: { groupId: string; newLeaderId: string }) => {
      const response = await fetch(`/api/admin/war-groups/${groupId}/leader`, {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error('Failed to change leader');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/war-groups"] });
      setShowChangeLeaderDialog(false);
      setSelectedGroup(null);
      setSelectedNewLeader("");
      toast({
        title: "Leader Changed",
        description: "The group leader has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change group leader",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const response = await fetch(`/api/admin/war-groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/war-groups/${selectedGroup?.id}/members`] });
      toast({
        title: "Member Removed",
        description: "The member has been removed from the group.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const toggleLicenseMutation = useMutation({
    mutationFn: async ({ groupId, isLicensed }: { groupId: string; isLicensed: boolean }) => {
      const response = await fetch(`/api/admin/war-groups/${groupId}/license`, {
        method: "PATCH",
        body: JSON.stringify({ isLicensed }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error('Failed to update license status');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/war-groups"] });
      toast({
        title: variables.isLicensed ? "Group Licensed" : "License Revoked",
        description: variables.isLicensed 
          ? "The group is now licensed and visible to users." 
          : "The group license has been revoked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update license status",
        variant: "destructive",
      });
    },
  });

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${group.leader.firstName} ${group.leader.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChangeLeader = () => {
    if (!selectedGroup || !selectedNewLeader) return;
    changeLeaderMutation.mutate({
      groupId: selectedGroup.id,
      newLeaderId: selectedNewLeader,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedGroup) return;
    if (confirm("Are you sure you want to remove this member from the group?")) {
      removeMemberMutation.mutate({
        groupId: selectedGroup.id,
        userId,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-charcoal to-charcoal/95 border-gold/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-gold" />
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  War Groups Management
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Manage war group leaders and team members
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                data-testid="input-search-groups"
                placeholder="Search by group name, location, or leader..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {groupsLoading ? (
            <div className="text-center py-12 text-slate-400">
              Loading war groups...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {searchQuery ? "No groups found matching your search." : "No war groups yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-gold font-semibold">Group Name</TableHead>
                    <TableHead className="text-gold font-semibold">Location</TableHead>
                    <TableHead className="text-gold font-semibold">Leader</TableHead>
                    <TableHead className="text-gold font-semibold">Members</TableHead>
                    <TableHead className="text-gold font-semibold">Status</TableHead>
                    <TableHead className="text-gold font-semibold">Created</TableHead>
                    <TableHead className="text-gold font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map((group) => (
                    <TableRow
                      key={group.id}
                      className="border-slate-700 hover:bg-slate-800/30"
                      data-testid={`row-group-${group.id}`}
                    >
                      <TableCell className="font-medium text-white">
                        {group.name}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gold" />
                          {group.city}, {group.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-gold" />
                          {group.leader.firstName} {group.leader.lastName}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gold" />
                          {group.memberCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={group.isLicensed ? "default" : "secondary"}
                          className={group.isLicensed ? "bg-green-600" : "bg-slate-600"}
                        >
                          {group.isLicensed ? "Licensed" : "Unlicensed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gold" />
                          {format(new Date(group.createdAt), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button
                            data-testid={`button-toggle-license-${group.id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              toggleLicenseMutation.mutate({
                                groupId: group.id,
                                isLicensed: !group.isLicensed,
                              });
                            }}
                            disabled={toggleLicenseMutation.isPending}
                            className={group.isLicensed 
                              ? "bg-red-700 hover:bg-red-600 text-white border-red-600" 
                              : "bg-green-700 hover:bg-green-600 text-white border-green-600"
                            }
                          >
                            {group.isLicensed ? (
                              <>
                                <ShieldOff className="w-4 h-4 mr-2" />
                                Revoke
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4 mr-2" />
                                License
                              </>
                            )}
                          </Button>
                          <Button
                            data-testid={`button-change-leader-${group.id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowChangeLeaderDialog(true);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                          >
                            <Crown className="w-4 h-4 mr-2" />
                            Change Leader
                          </Button>
                          <Button
                            data-testid={`button-view-members-${group.id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowMembersDialog(true);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            View Members
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Leader Dialog */}
      <Dialog open={showChangeLeaderDialog} onOpenChange={setShowChangeLeaderDialog}>
        <DialogContent className="bg-charcoal border-gold/20">
          <DialogHeader>
            <DialogTitle className="text-gold">Change Group Leader</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a new leader for {selectedGroup?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                data-testid="input-search-users"
                placeholder="Search for a user..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <Select value={selectedNewLeader} onValueChange={setSelectedNewLeader}>
                <SelectTrigger
                  data-testid="select-new-leader"
                  className="bg-slate-800/50 border-slate-700 text-white"
                >
                  <SelectValue placeholder="Select new leader" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {users
                    .filter((u) =>
                      u.firstName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.lastName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .map((user) => (
                      <SelectItem
                        key={user.id}
                        value={user.id}
                        className="text-white hover:bg-slate-700"
                        data-testid={`option-user-${user.id}`}
                      >
                        {user.firstName} {user.lastName} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                data-testid="button-cancel-change-leader"
                variant="outline"
                onClick={() => {
                  setShowChangeLeaderDialog(false);
                  setSelectedNewLeader("");
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-confirm-change-leader"
                onClick={handleChangeLeader}
                disabled={!selectedNewLeader || changeLeaderMutation.isPending}
                className="bg-gold hover:bg-gold/90 text-charcoal font-bold"
              >
                {changeLeaderMutation.isPending ? "Changing..." : "Change Leader"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="bg-charcoal border-gold/20 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-gold">Group Members</DialogTitle>
            <DialogDescription className="text-slate-400">
              Manage members of {selectedGroup?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {members.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No members in this group yet.
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700"
                    data-testid={`member-${member.userId}`}
                  >
                    <div className="flex items-center gap-3">
                      {member.user.profileImageUrl ? (
                        <img
                          src={member.user.profileImageUrl}
                          alt={`${member.user.firstName} ${member.user.lastName}`}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-gold" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-slate-400">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={member.role === "leader" ? "default" : "secondary"}
                        className={member.role === "leader" ? "bg-gold text-charcoal" : "bg-slate-600"}
                      >
                        {member.role}
                      </Badge>
                      {member.role !== "leader" && (
                        <Button
                          data-testid={`button-remove-member-${member.userId}`}
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={removeMemberMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
