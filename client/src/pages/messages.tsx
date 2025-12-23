import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, type User } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { formatLocalTime } from "@/lib/utils";
import { MessageCircle, Plus, Users, Send, ArrowLeft, Search, X, UserPlus, Trash2, LogOut, MoreVertical, User as UserIcon } from "lucide-react";

interface MessageUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profileImageUrl?: string;
  allowDirectMessages?: boolean;
  allowGroupInvites?: boolean;
}

interface ConversationParticipant {
  id: string;
  userId: string;
  role: string;
  user: MessageUser;
}

interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  description?: string;
  participants: ConversationParticipant[];
  lastMessageAt?: string;
  originalParticipantNames?: string;
}

interface Message {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  messageType: string;
  createdAt: string;
  user: MessageUser;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [showUserListDialog, setShowUserListDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState<{userId: string, x: number, y: number} | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<{messageId: string, x: number, y: number} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations with real-time polling
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    retry: false,
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling when tab is not focused
    staleTime: 0, // Always consider data stale to ensure fresh fetches for new senders
    gcTime: 1000, // Keep cache for only 1 second
  });

  // Handle URL parameters to select conversation automatically
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId && conversations.length > 0) {
      const targetConversation = conversations.find(c => c.id === conversationId);
      if (targetConversation) {
        setSelectedConversation(targetConversation);
        // Clean up URL without refreshing page
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [conversations]);

  // Fetch all users for direct messaging and group creation
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<MessageUser[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  // Fetch silenced users list
  const { data: silencedData } = useQuery<{ silencedUserIds: string[] }>({
    queryKey: ["/api/users/silenced"],
    retry: false,
  });

  const silencedUserIds = silencedData?.silencedUserIds || [];

  // Filter users based on search query, privacy preferences, and silenced status
  const filteredUsers = allUsers.filter(targetUser => 
    targetUser.id !== (user as any)?.id &&
    targetUser.allowDirectMessages !== false && // Only show users who allow direct messages
    !silencedUserIds.includes(targetUser.id) && // Hide silenced users
    (targetUser.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter users for group creation (must allow group invites)
  const filteredUsersForGroup = allUsers.filter(targetUser => 
    targetUser.id !== (user as any)?.id &&
    targetUser.allowGroupInvites !== false && // Only show users who allow group invites
    !silencedUserIds.includes(targetUser.id) && // Hide silenced users
    (targetUser.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Fetch messages for selected conversation with real-time polling
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    retry: false,
    refetchInterval: 1500, // Poll every 1.5 seconds for real-time messages
    refetchIntervalInBackground: true, // Continue polling when tab is not focused
    staleTime: 0, // Always fetch fresh messages
    gcTime: 500, // Keep cache briefly
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      console.log("Sending message to:", `/api/conversations/${selectedConversation.id}/messages`);
      console.log("Message data:", data);
      return await apiRequest("POST", `/api/conversations/${selectedConversation.id}/messages`, data);
    },
    onSuccess: () => {
      console.log("Message sent successfully");
      // Immediately refetch both messages and conversations for instant updates
      queryClient.refetchQueries({ queryKey: ["/api/conversations", selectedConversation?.id, "messages"] });
      queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      console.error("Message send error:", error);
      if (error.message.includes("Unauthorized")) {
        toast({
          title: "Authentication Required",
          description: "Please log in again to send messages",
          variant: "destructive",
        });
        // Redirect will happen in apiRequest
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to send message",
          variant: "destructive",
        });
      }
    },
  });

  // Create direct conversation mutation
  const createDirectConversationMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return await apiRequest("POST", "/api/conversations/direct", { targetUserId });
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      // Immediately refetch to show new conversation for both users
      queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(conversation);
      setShowUserListDialog(false);
      setShowProfileMenu(null);
      toast({
        title: "Success",
        description: "Direct message started successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation",
        variant: "destructive",
      });
    },
  });

  // Create group conversation mutation
  const createGroupConversationMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; participantIds: string[] }) => {
      return await apiRequest("POST", "/api/conversations/group", data);
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(conversation);
      setShowNewGroupDialog(false);
      setGroupName("");
      setGroupDescription("");
      setSelectedUsers([]);
      setSearchQuery("");
      toast({
        title: "Success",
        description: "Group chat created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowProfileMenu(null);
      setShowMessageMenu(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sendMessageMutation.isPending) {
      console.log("Cannot send message:", { 
        hasMessage: !!newMessage.trim(), 
        hasConversation: !!selectedConversation,
        isPending: sendMessageMutation.isPending 
      });
      return;
    }
    console.log("Sending message:", newMessage.trim());
    sendMessageMutation.mutate({ content: newMessage.trim() });
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest("DELETE", `/api/conversations/${selectedConversation?.id}/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation?.id, "messages"] });
      setShowMessageMenu(null);
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  // Delete/leave conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (data: { conversationId: string; isAdmin?: boolean }) => {
      return await apiRequest("DELETE", `/api/conversations/${data.conversationId}`, 
        data.isAdmin ? { isAdmin: true } : undefined);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(null);
      
      const conversation = conversations.find(c => c.id === variables.conversationId);
      if (conversation?.type === "group" && !variables.isAdmin) {
        toast({
          title: "Success",
          description: "Left group chat successfully",
        });
      } else {
        toast({
          title: "Success", 
          description: "Conversation deleted successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    createGroupConversationMutation.mutate({
      name: groupName.trim(),
      description: groupDescription.trim(),
      participantIds: selectedUsers,
    });
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (!conversation) return "Unknown Conversation";
    
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }
    
    // For direct messages, try to get the other participant's name
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants.find(p => p.userId !== (user as any)?.id);
      if (otherParticipant?.user) {
        return `${otherParticipant.user.firstName || ""} ${otherParticipant.user.lastName || ""}`.trim() || 
               otherParticipant.user.email;
      }
    }
    
    // If no active participants (user deleted), try to get from original participant names
    if (conversation.originalParticipantNames) {
      try {
        const participantNames = JSON.parse(conversation.originalParticipantNames);
        const currentUserId = (user as any)?.id;
        // Find the other participant's name (not the current user)
        for (const userId in participantNames) {
          if (userId !== currentUserId) {
            return participantNames[userId];
          }
        }
      } catch (e) {
        console.error("Error parsing original participant names:", e);
      }
    }
    
    return "Direct Message";
  };

  const formatMessageTime = (dateString: string) => {
    const messageDate = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    const isToday = messageDay.getTime() === today.getTime();
    const isYesterday = messageDay.getTime() === today.getTime() - 24 * 60 * 60 * 1000;
    
    if (isToday) {
      return formatLocalTime(dateString, { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return `Yesterday ${formatLocalTime(dateString, { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return formatLocalTime(dateString, { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  if (conversationsLoading) {
    return (
      <div className="min-h-screen bg-ministry-light-gray flex items-center justify-center">
        <div className="animate-spin rounded-none h-12 w-12 border-b-4 border-black"></div>
      </div>
    );
  }



  return (
    <div className="flex h-screen max-w-md mx-auto bg-ministry-light-gray pb-16">
      {/* Conversations List */}
      {!selectedConversation ? (
        <div className="w-full">
          <div className="bg-black text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase" data-testid="text-messages-title">Messages</h1>
                <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide">Connect With Your Brothers</p>
              </div>
              <div className="flex space-x-2">
                <Dialog open={showUserListDialog} onOpenChange={setShowUserListDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-none border-2 border-black font-black" data-testid="button-new-direct-message">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-tighter text-xl">Start Direct Message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-black" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-none border-2 border-black"
                          data-testid="input-search-users"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        {filteredUsers.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">No users found</p>
                          </div>
                        ) : (
                          filteredUsers.map((targetUser) => (
                            <div
                              key={targetUser.id}
                              className="flex items-center justify-between p-2 hover:bg-ministry-gold-exact/20 rounded-none border-b border-black/10"
                              data-testid={`user-item-${targetUser.id}`}
                            >
                              <div className="flex items-center space-x-3">
                                <img
                                  src={targetUser.profileImageUrl || `https://ui-avatars.com/api/?name=${targetUser.firstName}+${targetUser.lastName}&background=4A90B8&color=fff`}
                                  alt={`${targetUser.firstName} ${targetUser.lastName}`}
                                  className="w-10 h-10 rounded-none border-2 border-black object-cover cursor-pointer hover:ring-2 hover:ring-ministry-gold-exact"
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setShowProfileMenu({
                                      userId: targetUser.id,
                                      x: rect.right,
                                      y: rect.top
                                    });
                                  }}
                                />
                                <div>
                                  <p className="font-medium">
                                    {targetUser.firstName} {targetUser.lastName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{targetUser.email}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => createDirectConversationMutation.mutate(targetUser.id)}
                                disabled={createDirectConversationMutation.isPending}
                                className="bg-black text-white hover:bg-gray-900 rounded-none border-2 border-black font-bold uppercase text-xs"
                                data-testid={`button-message-${targetUser.id}`}
                              >
                                Message
                              </Button>
                            </div>
                          ))
                        )}
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-none border-2 border-black font-black" data-testid="button-new-group">
                      <Users className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-tighter text-xl">Create Group Chat</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="groupName" className="font-bold uppercase tracking-wide text-sm">Group Name</Label>
                        <Input
                          id="groupName"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Enter group name"
                          className="rounded-none border-2 border-black mt-1"
                          data-testid="input-group-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="groupDescription" className="font-bold uppercase tracking-wide text-sm">Description (Optional)</Label>
                        <Textarea
                          id="groupDescription"
                          value={groupDescription}
                          onChange={(e) => setGroupDescription(e.target.value)}
                          placeholder="Enter group description"
                          className="rounded-none border-2 border-black mt-1"
                          data-testid="input-group-description"
                        />
                      </div>
                      <div>
                        <Label className="font-bold uppercase tracking-wide text-sm">Select Members</Label>
                        <div className="relative mb-2 mt-1">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-black" />
                          <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rounded-none border-2 border-black"
                            data-testid="input-search-group-users"
                          />
                        </div>
                        
                        {/* Selected users display */}
                        {selectedUsers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm text-black/70 mb-2 font-medium">Selected Members ({selectedUsers.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedUsers.map(userId => {
                                const selectedUser = allUsers.find(u => u.id === userId);
                                return selectedUser ? (
                                  <Badge
                                    key={userId}
                                    className="flex items-center space-x-1 bg-ministry-gold-exact text-black rounded-none border-2 border-black font-bold"
                                  >
                                    <span className="text-xs">
                                      {selectedUser.firstName} {selectedUser.lastName}
                                    </span>
                                    <X
                                      className="w-3 h-3 cursor-pointer hover:text-red-600"
                                      onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                                    />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                        
                        <ScrollArea className="h-40 border-2 border-black rounded-none p-2">
                          {filteredUsersForGroup.length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-muted-foreground text-sm">No users found</p>
                            </div>
                          ) : (
                            filteredUsersForGroup.map((targetUser) => (
                              <div key={targetUser.id} className="flex items-center space-x-2 py-2 hover:bg-muted/50 rounded px-2">
                                <Checkbox
                                  id={`user-${targetUser.id}`}
                                  checked={selectedUsers.includes(targetUser.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedUsers([...selectedUsers, targetUser.id]);
                                    } else {
                                      setSelectedUsers(selectedUsers.filter(id => id !== targetUser.id));
                                    }
                                  }}
                                  data-testid={`checkbox-user-${targetUser.id}`}
                                />
                                <img
                                  src={targetUser.profileImageUrl || `https://ui-avatars.com/api/?name=${targetUser.firstName}+${targetUser.lastName}&background=4A90B8&color=fff`}
                                  alt={`${targetUser.firstName} ${targetUser.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-ministry-navy"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setShowProfileMenu({
                                      userId: targetUser.id,
                                      x: rect.right,
                                      y: rect.top
                                    });
                                  }}
                                />
                                <label
                                  htmlFor={`user-${targetUser.id}`}
                                  className="text-sm font-medium cursor-pointer flex-1"
                                >
                                  <div>
                                    <p>{targetUser.firstName} {targetUser.lastName}</p>
                                    <p className="text-xs text-muted-foreground">{targetUser.email}</p>
                                  </div>
                                </label>
                              </div>
                            ))
                          )}
                        </ScrollArea>
                      </div>
                      <Button
                        onClick={handleCreateGroup}
                        disabled={!groupName.trim() || selectedUsers.length === 0 || createGroupConversationMutation.isPending}
                        className="w-full bg-black text-white hover:bg-gray-900 rounded-none border-2 border-black font-black uppercase tracking-wide"
                        data-testid="button-create-group"
                      >
                        {createGroupConversationMutation.isPending ? "Creating..." : "Create Group"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            {conversations.length === 0 ? (
              <div className="text-center py-8 bg-black border-2 border-ministry-gold-exact/50 rounded-none p-6">
                <MessageCircle className="w-12 h-12 text-ministry-gold-exact mx-auto mb-4" />
                <p className="text-white font-black uppercase tracking-tighter">No conversations yet</p>
                <p className="text-sm text-gray-400 font-medium">Start a new conversation above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className="cursor-pointer bg-black border-2 border-ministry-gold-exact/50 hover:border-ministry-gold-exact hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all rounded-none"
                    onClick={() => setSelectedConversation(conversation)}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-white truncate uppercase tracking-tighter">
                            {getConversationTitle(conversation)}
                          </h3>
                          <p className="text-sm text-gray-400 font-medium">
                            {conversation.type === "group" 
                              ? `${conversation.participants?.length || 0} members`
                              : "Direct message"
                            }
                          </p>
                        </div>
                        {conversation.lastMessageAt && (
                          <p className="text-xs text-ministry-gold-exact font-bold">
                            {formatMessageTime(conversation.lastMessageAt)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Chat Interface */
        <div className="w-full h-screen flex flex-col pb-16 bg-ministry-light-gray">
          {/* Chat Header */}
          <div className="bg-black text-white px-6 py-4 flex items-center flex-shrink-0 border-b-4 border-ministry-gold-exact">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedConversation(null)}
              className="text-white hover:bg-white/10 mr-3 rounded-none"
              data-testid="button-back-to-conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="font-black text-white uppercase tracking-tighter">{getConversationTitle(selectedConversation)}</h2>
              <p className="text-sm text-ministry-gold-exact font-bold uppercase tracking-wide">
                {selectedConversation.type === "group" 
                  ? `${selectedConversation.participants?.length || 0} members`
                  : "Direct message"
                }
              </p>
            </div>

            {/* Conversation options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-gray-900 rounded-none">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-none border-2 border-black">
                {selectedConversation.type === "direct" ? (
                  <DropdownMenuItem 
                    onClick={() => deleteConversationMutation.mutate({ conversationId: selectedConversation.id })}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Conversation
                  </DropdownMenuItem>
                ) : (
                  <>
                    {user && (user as any).role === "admin" && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => deleteConversationMutation.mutate({ 
                            conversationId: selectedConversation.id, 
                            isAdmin: true 
                          })}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Group Chat
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem 
                      onClick={() => deleteConversationMutation.mutate({ conversationId: selectedConversation.id })}
                      className="text-orange-600 focus:text-orange-600"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Leave Group
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-6 py-4">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-end space-x-2 ${message.userId === (user as any)?.id ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.id}`}
                      onContextMenu={(e) => {
                        if (message.userId === (user as any)?.id) {
                          e.preventDefault();
                          setShowMessageMenu({
                            messageId: message.id,
                            x: e.clientX,
                            y: e.clientY
                          });
                        }
                      }}
                    >
                      {/* Profile picture for other users */}
                      {message.userId !== (user as any)?.id && (
                        <img
                          src={message.user.profileImageUrl || `https://ui-avatars.com/api/?name=${message.user.firstName}+${message.user.lastName}&background=4A90B8&color=fff`}
                          alt={`${message.user.firstName} ${message.user.lastName}`}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-ministry-navy"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setShowProfileMenu({
                              userId: message.userId,
                              x: rect.right,
                              y: rect.top
                            });
                          }}
                        />
                      )}
                      
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-none border-2 border-black ${
                        message.userId === (user as any)?.id
                          ? 'bg-ministry-gold-exact text-black'
                          : 'bg-white text-black'
                      }`}>
                        {selectedConversation.type === "group" && message.userId !== (user as any)?.id && (
                          <p className="text-xs opacity-75 mb-1">
                            {message.user.firstName} {message.user.lastName}
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.userId === (user as any)?.id ? 'text-black/70' : 'text-black/50'
                        }`}>
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message Input - Fixed at bottom with proper spacing */}
          <div className="flex-shrink-0 border-t-2 border-black bg-white mb-16">
            <div className="px-6 py-4">
              <form onSubmit={handleSendMessage}>
                <div className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 rounded-none border-2 border-black"
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-new-message"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-black hover:bg-gray-900 text-white rounded-none border-2 border-black"
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Message Context Menu */}
      {showMessageMenu && (
        <div
          className="fixed bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 z-50 min-w-[140px]"
          style={{
            left: showMessageMenu.x,
            top: showMessageMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-left text-red-600 hover:text-red-600 hover:bg-red-50 rounded-none font-bold uppercase text-xs"
            onClick={() => {
              deleteMessageMutation.mutate(showMessageMenu.messageId);
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Message
          </Button>
        </div>
      )}

      {/* Profile Menu */}
      {showProfileMenu && (() => {
        const targetUser = allUsers.find(u => u.id === showProfileMenu.userId);
        return (
          <div
            className="fixed bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 z-50 min-w-[160px]"
            style={{
              left: showProfileMenu.x + 10,
              top: showProfileMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-left rounded-none font-bold uppercase text-xs hover:bg-ministry-gold-exact/20"
                onClick={() => {
                  setLocation(`/users/${showProfileMenu.userId}`);
                  setShowProfileMenu(null);
                }}
                data-testid={`profile-menu-view-profile-${showProfileMenu.userId}`}
              >
                <UserIcon className="w-4 h-4 mr-2" />
                View Profile
              </Button>
              {targetUser?.allowDirectMessages !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left rounded-none font-bold uppercase text-xs hover:bg-ministry-gold-exact/20"
                  onClick={() => {
                    createDirectConversationMutation.mutate(showProfileMenu.userId);
                  }}
                  data-testid={`profile-menu-dm-${showProfileMenu.userId}`}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Direct Message
                </Button>
              )}
              {targetUser?.allowGroupInvites !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left rounded-none font-bold uppercase text-xs hover:bg-ministry-gold-exact/20"
                  onClick={() => {
                    if (!selectedUsers.includes(showProfileMenu.userId)) {
                      setSelectedUsers([...selectedUsers, showProfileMenu.userId]);
                    }
                    setShowProfileMenu(null);
                    setShowNewGroupDialog(true);
                  }}
                  data-testid={`profile-menu-add-group-${showProfileMenu.userId}`}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Group Chat
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfileMenu(null)}
        />
      )}
    </div>
  );
}