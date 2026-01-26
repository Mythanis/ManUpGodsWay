import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Calendar, Search, Tag, Send } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { BackButton } from "@/components/BackButton";

interface Brother {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  createdAt: string;
  tag?: string;
  brotherhoodId: string;
}

interface SearchUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export default function Brothers() {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Initialize WebSocket for real-time notifications
  useWebSocket(user?.id);
  
  const { data: brothers, isLoading } = useQuery<Brother[]>({
    queryKey: ['/api/brothers'],
  });

  // User search query - only search when user types at least 2 characters
  const { data: searchUsers, isLoading: isSearchingUsers } = useQuery<SearchUser[]>({
    queryKey: ['/api/users/search', userSearchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(userSearchQuery)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to search users');
      }
      return response.json();
    },
    enabled: userSearchQuery.length >= 2,
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ brotherhoodId, tag }: { brotherhoodId: string; tag: string | null }) => {
      const response = await fetch(`/api/brothers/${brotherhoodId}/tag`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tag }),
      });
      if (!response.ok) {
        throw new Error('Failed to update tag');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tag Updated",
        description: "Brotherhood tag has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  // Handle keyboard events for search
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Return') {
      handleSearch();
    }
  };

  const handleSearch = () => {
    if (userSearchQuery.trim().length >= 2) {
      setShowUserSearch(true);
    }
  };

  // Hide user search results when clicking outside or clearing search
  useEffect(() => {
    if (userSearchQuery.length < 2) {
      setShowUserSearch(false);
    }
  }, [userSearchQuery]);

  // No need to filter brothers since we removed the search functionality

  const getTagInfo = (tag?: string) => {
    switch (tag) {
      case 'Paul':
        return { label: 'Paul', color: 'text-purple-600', bgColor: 'bg-purple-50', description: 'Mentor & Leader' };
      case 'Timothy':
        return { label: 'Timothy', color: 'text-blue-600', bgColor: 'bg-blue-50', description: 'Student & Learner' };
      case 'Barnabas':
        return { label: 'Barnabas', color: 'text-green-600', bgColor: 'bg-green-50', description: 'Encourager & Friend' };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-2 mb-6">
            <UserPlus className="w-6 h-6 text-ministry-gold" />
            <h1 className="text-2xl font-bold">My Brothers</h1>
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 mb-6">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserPlus className="w-8 h-8 text-ministry-gold" />
              <h1 className="text-4xl font-black tracking-tighter uppercase">My Brothers</h1>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold bg-ministry-gold-exact text-black px-3 py-1 rounded-sm uppercase tracking-wide">
              <Users className="w-4 h-4" />
              <span>{brothers?.length || 0} Brothers</span>
            </div>
          </div>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase mt-2">Your Brotherhood Connections</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4">

        {/* User Search Bar - Find new brothers */}
        {!isLoading && (
          <div className="relative mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-5 h-5" />
              <Input
                type="text"
                placeholder="SEARCH FOR BROTHERS..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    setShowUserSearch(true);
                  }
                }}
                onKeyDown={handleSearchKeyPress}
                className="pl-10 pr-12 border-2 border-black bg-ministry-gold-exact text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide rounded-sm font-medium"
                data-testid="input-search-users"
              />
              <Button
                onClick={handleSearch}
                disabled={userSearchQuery.length < 2}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-black hover:bg-gray-900 text-white rounded-sm"
                data-testid="button-search-users"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* User Search Results Dropdown */}
            {showUserSearch && userSearchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-ministry-gold-exact border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-1 max-h-60 overflow-y-auto">
                {isSearchingUsers ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Searching users...
                  </div>
                ) : searchUsers && searchUsers.length > 0 ? (
                  <div className="py-2">
                    {searchUsers.map((user) => {
                      // Check if user is already a brother
                      const isAlreadyBrother = brothers?.some(brother => brother.id === user.id);
                      
                      return (
                        <Link key={user.id} href={`/users/${user.id}`}>
                          <div 
                            className="flex items-center space-x-3 px-4 py-3 hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => {
                              setShowUserSearch(false);
                              setUserSearchQuery("");
                            }}
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-ministry-gold text-black text-sm font-semibold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                            {isAlreadyBrother && (
                              <div className="flex items-center space-x-1 text-xs text-ministry-gold">
                                <Users className="w-3 h-3" />
                                <span>Brother</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No users found matching "{userSearchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!brothers || brothers.length === 0 ? (
          <Card className="border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-ministry-gold-exact">
            <CardContent className="text-center py-12">
              <UserPlus className="w-16 h-16 text-black mx-auto mb-4" />
              <h2 className="text-xl font-black mb-2 text-black tracking-tight">No Brothers Yet</h2>
              <p className="text-black mb-6">
                Start building meaningful relationships by connecting with other men in the community.
              </p>
              <Link href="/community">
                <Button className="bg-black hover:bg-gray-900 text-white rounded-sm font-black uppercase tracking-wide">
                  <Users className="w-4 h-4 mr-2" />
                  Explore Community
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {brothers.map((brother) => {
                const tagInfo = getTagInfo(brother.tag);
                
                return (
                  <Card
                    key={brother.id}
                    className="hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all border-2 border-black rounded-sm bg-ministry-gold-exact"
                    data-testid={`brother-card-${brother.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <Link href={`/users/${brother.id}`} className="flex-shrink-0">
                          <Avatar className="w-10 h-10 cursor-pointer rounded-sm">
                            <AvatarFallback className="bg-black text-white text-sm font-black rounded-sm">
                              {brother.firstName?.[0]}{brother.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/users/${brother.id}`}>
                              <h3 className="text-sm font-black cursor-pointer hover:text-ministry-charcoal transition-colors text-black tracking-tight">
                                {brother.firstName} {brother.lastName}
                              </h3>
                            </Link>
                            <span className="text-xs text-muted-foreground">@{brother.username}</span>
                            {tagInfo && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold uppercase ${tagInfo.bgColor} ${tagInfo.color}`}>
                                <Tag className="w-3 h-3" />
                                {tagInfo.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center space-x-2 text-xs text-white">
                              <Calendar className="w-3 h-3" />
                              <span>Since {new Date(brother.createdAt).toLocaleDateString()}</span>
                            </div>
                            <Select
                              value={brother.tag || "none"}
                              onValueChange={(value) => {
                                const tag = value === "none" ? null : value;
                                updateTagMutation.mutate({ 
                                  brotherhoodId: brother.brotherhoodId, 
                                  tag 
                                });
                              }}
                              disabled={updateTagMutation.isPending}
                            >
                              <SelectTrigger className="w-28 h-6 text-xs">
                                <SelectValue placeholder="Tag" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="Paul">Paul</SelectItem>
                                <SelectItem value="Timothy">Timothy</SelectItem>
                                <SelectItem value="Barnabas">Barnabas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            

          </>
        )}
      </div>
    </div>
  );
}