import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, type User } from "@/hooks/useAuth";
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
import { MessageCircle, Plus, Users, Send, ArrowLeft, Search, X, UserPlus, Trash2, LogOut, MoreVertical } from "lucide-react";

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

  // Filter users based on search query and privacy preferences
  const filteredUsers = allUsers.filter(targetUser => 
    targetUser.id !== (user as any)?.id &&
    targetUser.allowDirectMessages !== false && // Only show users who allow direct messages
    (targetUser.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     targetUser.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter users for group creation (must allow group invites)
  const filteredUsersForGroup = allUsers.filter(targetUser => 
    targetUser.id !== (user as any)?.id &&
    targetUser.allowGroupInvites !== false && // Only show users who allow group invites
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }



  return (
    <div className="flex h-screen max-w-md mx-auto bg-background pb-16">
      {/* Conversations List */}
      {!selectedConversation ? (
        <div className="w-full">
          <div className="bg-gradient-to-r from-ministry-charcoal to-ministry-steel dark:from-header-dark dark:to-ministry-charcoal text-white px-6 pt-12 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold" data-testid="text-messages-title">Messages</h1>
              <div className="flex space-x-2">
                <Dialog open={showUserListDialog} onOpenChange={setShowUserListDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" data-testid="button-new-direct-message">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start Direct Message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
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
                              className="flex items-center justify-between p-2 hover:bg-muted/50 rounded"
                              data-testid={`user-item-${targetUser.id}`}
                            >
                              <div className="flex items-center space-x-3">
                                <img
                                  src={targetUser.profileImageUrl || `https://ui-avatars.com/api/?name=${targetUser.firstName}+${targetUser.lastName}&background=4A90B8&color=fff`}
                                  alt={`${targetUser.firstName} ${targetUser.lastName}`}
                                  className={`w-10 h-10 rounded-full object-cover ${
                                    targetUser.allowDirectMessages !== false 
                                      ? 'cursor-pointer hover:ring-2 hover:ring-ministry-navy' 
                                      : 'cursor-default opacity-60'
                                  }`}
                                  onClick={(e) => {
                                    if (targetUser.allowDirectMessages !== false) {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setShowProfileMenu({
                                        userId: targetUser.id,
                                        x: rect.right,
                                        y: rect.top
                                      });
                                    }
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
                    <Button size="sm" variant="secondary" data-testid="button-new-group">
                      <Users className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Group Chat</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input
                          id="groupName"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Enter group name"
                          data-testid="input-group-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="groupDescription">Description (Optional)</Label>
                        <Textarea
                          id="groupDescription"
                          value={groupDescription}
                          onChange={(e) => setGroupDescription(e.target.value)}
                          placeholder="Enter group description"
                          data-testid="input-group-description"
                        />
                      </div>
                      <div>
                        <Label>Select Members</Label>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                            data-testid="input-search-group-users"
                          />
                        </div>
                        
                        {/* Selected users display */}
                        {selectedUsers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm text-muted-foreground mb-2">Selected Members ({selectedUsers.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedUsers.map(userId => {
                                const selectedUser = allUsers.find(u => u.id === userId);
                                return selectedUser ? (
                                  <Badge
                                    key={userId}
                                    variant="secondary"
                                    className="flex items-center space-x-1"
                                  >
                                    <span className="text-xs">
                                      {selectedUser.firstName} {selectedUser.lastName}
                                    </span>
                                    <X
                                      className="w-3 h-3 cursor-pointer hover:text-red-500"
                                      onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                                    />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                        
                        <ScrollArea className="h-40 border rounded p-2">
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
                                  className={`w-8 h-8 rounded-full object-cover ${
                                    (targetUser.allowDirectMessages !== false || targetUser.allowGroupInvites !== false) 
                                      ? 'cursor-pointer hover:ring-2 hover:ring-ministry-navy' 
                                      : 'cursor-default opacity-60'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (targetUser.allowDirectMessages !== false || targetUser.allowGroupInvites !== false) {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setShowProfileMenu({
                                        userId: targetUser.id,
                                        x: rect.right,
                                        y: rect.top
                                      });
                                    }
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
                        className="w-full"
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
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No conversations yet</p>
                <p className="text-sm text-muted-foreground">Start a new conversation above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedConversation(conversation)}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">
                            {getConversationTitle(conversation)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {conversation.type === "group" 
                              ? `${conversation.participants?.length || 0} members`
                              : "Direct message"
                            }
                          </p>
                        </div>
                        {conversation.lastMessageAt && (
                          <p className="text-xs text-muted-foreground">
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
        <div className="w-full h-screen flex flex-col pb-16">
          {/* Chat Header */}
          <div className="bg-ministry-charcoal text-white px-6 py-4 flex items-center flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedConversation(null)}
              className="text-white hover:bg-ministry-charcoal mr-3"
              data-testid="button-back-to-conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="font-bold">{getConversationTitle(selectedConversation)}</h2>
              <p className="text-sm text-white/70">
                {selectedConversation.type === "group" 
                  ? `${selectedConversation.participants?.length || 0} members`
                  : "Direct message"
                }
              </p>
            </div>

            {/* Conversation options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-ministry-charcoal">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
                          className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${
                            (message.user.allowDirectMessages !== false || message.user.allowGroupInvites !== false) 
                              ? 'cursor-pointer hover:ring-2 hover:ring-ministry-navy' 
                              : 'cursor-default opacity-60'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (message.user.allowDirectMessages !== false || message.user.allowGroupInvites !== false) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setShowProfileMenu({
                                userId: message.userId,
                                x: rect.right,
                                y: rect.top
                              });
                            }
                          }}
                        />
                      )}
                      
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.userId === (user as any)?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}>
                        {selectedConversation.type === "group" && message.userId !== (user as any)?.id && (
                          <p className="text-xs opacity-75 mb-1">
                            {message.user.firstName} {message.user.lastName}
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.userId === (user as any)?.id ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
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
          <div className="flex-shrink-0 border-t bg-background mb-16">
            <div className="px-6 py-4">
              <form onSubmit={handleSendMessage}>
                <div className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-new-message"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
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
          className="fixed bg-background border border-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]"
          style={{
            left: showMessageMenu.x,
            top: showMessageMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-left text-red-600 hover:text-red-600 hover:bg-red-50"
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
            className="fixed bg-background border border-border rounded-lg shadow-lg p-2 z-50 min-w-[160px]"
            style={{
              left: showProfileMenu.x + 10,
              top: showProfileMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {targetUser?.allowDirectMessages !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left"
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
                  className="w-full justify-start text-left"
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
              {targetUser?.allowDirectMessages === false && targetUser?.allowGroupInvites === false && (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  This user has disabled messaging
                </div>
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