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
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-6 h-6 text-ministry-gold" />
            <h1 className="text-2xl font-bold">My Brothers</h1>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{brothers?.length || 0} Brothers</span>
          </div>
        </div>

        {/* User Search Bar - Find new brothers */}
        {!isLoading && (
          <div className="relative mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search for users to connect with as brothers..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    setShowUserSearch(true);
                  }
                }}
                onKeyDown={handleSearchKeyPress}
                className="pl-10 pr-12 border-white dark:border-white"
                data-testid="input-search-users"
              />
              <Button
                onClick={handleSearch}
                disabled={userSearchQuery.length < 2}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                data-testid="button-search-users"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* User Search Results Dropdown */}
            {showUserSearch && userSearchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-background border border-white dark:border-white rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
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
          <Card>
            <CardContent className="text-center py-12">
              <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Brothers Yet</h2>
              <p className="text-muted-foreground mb-6">
                Start building meaningful relationships by connecting with other men in the community.
              </p>
              <Link href="/community">
                <Button className="bg-ministry-charcoal hover:bg-ministry-charcoal/90">
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
                    className="hover:shadow-md transition-shadow"
                    data-testid={`brother-card-${brother.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Link href={`/users/${brother.id}`} className="flex-shrink-0">
                          <Avatar className="w-16 h-16 cursor-pointer">
                            <AvatarFallback className="bg-ministry-gold text-black text-lg font-semibold">
                              {brother.firstName?.[0]}{brother.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/users/${brother.id}`}>
                            <h3 className="text-lg font-semibold cursor-pointer hover:text-ministry-gold transition-colors">
                              {brother.firstName} {brother.lastName}
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            @{brother.username}
                          </p>
                          
                          {/* Tag Display */}
                          {tagInfo && (
                            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${tagInfo.bgColor} ${tagInfo.color}`}>
                              <Tag className="w-3 h-3" />
                              <span>{tagInfo.label}</span>
                              <span className="text-xs opacity-75">• {tagInfo.description}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>
                                Brothers since{" "}
                                {new Date(brother.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {/* Tag Selection */}
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">Tag:</span>
                              <Select
                                value={brother.tag || ""}
                                onValueChange={(value) => {
                                  const tag = value === "" ? null : value;
                                  updateTagMutation.mutate({ 
                                    brotherhoodId: brother.brotherhoodId, 
                                    tag 
                                  });
                                }}
                                disabled={updateTagMutation.isPending}
                              >
                                <SelectTrigger className="w-32 h-7 text-xs">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
                                  <SelectItem value="Paul">Paul - Mentor</SelectItem>
                                  <SelectItem value="Timothy">Timothy - Student</SelectItem>
                                  <SelectItem value="Barnabas">Barnabas - Encourager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
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