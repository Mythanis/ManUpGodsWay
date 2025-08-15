import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Plus, Users, Send, ArrowLeft } from "lucide-react";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profileImageUrl?: string;
}

interface ConversationParticipant {
  id: string;
  userId: string;
  role: string;
  user: User;
}

interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  description?: string;
  participants: ConversationParticipant[];
  lastMessageAt?: string;
}

interface Message {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  messageType: string;
  createdAt: string;
  user: User;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    retry: false,
  });

  // Fetch all users for direct messaging and group creation
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    retry: false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      return await apiRequest("POST", `/api/conversations/${selectedConversation.id}/messages`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Create direct conversation mutation
  const createDirectConversationMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return await apiRequest("POST", "/api/conversations/direct", { targetUserId });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      response.json().then((data) => setSelectedConversation(data));
      setShowUserListDialog(false);
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
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      response.json().then((data) => setSelectedConversation(data));
      setShowNewGroupDialog(false);
      setGroupName("");
      setGroupDescription("");
      setSelectedUsers([]);
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({ content: newMessage.trim() });
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    createGroupConversationMutation.mutate({
      name: groupName.trim(),
      description: groupDescription.trim(),
      participantIds: selectedUsers,
    });
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }
    
    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants.find(p => p.userId !== (user as any)?.id);
    if (otherParticipant?.user) {
      return `${otherParticipant.user.firstName || ""} ${otherParticipant.user.lastName || ""}`.trim() || 
             otherParticipant.user.email;
    }
    return "Direct Message";
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (conversationsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-md mx-auto bg-white">
      {/* Conversations List */}
      {!selectedConversation ? (
        <div className="w-full">
          <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-6">
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
                      <ScrollArea className="h-60">
                        {(allUsers as User[]).filter(u => u.id !== (user as any)?.id).map((targetUser) => (
                          <div
                            key={targetUser.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                            data-testid={`user-item-${targetUser.id}`}
                          >
                            <div>
                              <p className="font-medium">
                                {targetUser.firstName} {targetUser.lastName}
                              </p>
                              <p className="text-sm text-gray-500">{targetUser.email}</p>
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
                        ))}
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
                        <ScrollArea className="h-40 border rounded p-2">
                          {(allUsers as User[]).filter(u => u.id !== (user as any)?.id).map((targetUser) => (
                            <div key={targetUser.id} className="flex items-center space-x-2 py-1">
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
                              <Label htmlFor={`user-${targetUser.id}`} className="text-sm">
                                {targetUser.firstName} {targetUser.lastName} ({targetUser.email})
                              </Label>
                            </div>
                          ))}
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
                <MessageCircle className="w-12 h-12 text-ministry-slate mx-auto mb-4" />
                <p className="text-ministry-slate">No conversations yet</p>
                <p className="text-sm text-ministry-slate">Start a new conversation above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedConversation(conversation)}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-ministry-navy truncate">
                            {getConversationTitle(conversation)}
                          </h3>
                          <p className="text-sm text-ministry-slate">
                            {conversation.type === "group" 
                              ? `${conversation.participants.length} members`
                              : "Direct message"
                            }
                          </p>
                        </div>
                        {conversation.lastMessageAt && (
                          <p className="text-xs text-ministry-slate">
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
        <div className="w-full flex flex-col">
          {/* Chat Header */}
          <div className="bg-ministry-navy text-white px-6 py-4 flex items-center">
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
              <p className="text-sm text-gray-200">
                {selectedConversation.type === "group" 
                  ? `${selectedConversation.participants.length} members`
                  : "Direct message"
                }
              </p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-6 py-4">
            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ministry-slate">No messages yet</p>
                <p className="text-sm text-ministry-slate">Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.reverse().map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.userId === (user as any)?.id ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.userId === (user as any)?.id
                        ? 'bg-ministry-navy text-white'
                        : 'bg-gray-100 text-ministry-charcoal'
                    }`}>
                      {selectedConversation.type === "group" && message.userId !== (user as any)?.id && (
                        <p className="text-xs opacity-75 mb-1">
                          {message.user.firstName} {message.user.lastName}
                        </p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.userId === (user as any)?.id ? 'text-gray-200' : 'text-ministry-slate'
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

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="px-6 py-4 border-t bg-gray-50">
            <div className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                disabled={sendMessageMutation.isPending}
                data-testid="input-new-message"
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="bg-ministry-navy hover:bg-ministry-charcoal"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}