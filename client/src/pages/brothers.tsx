import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Calendar, Search, Tag } from "lucide-react";
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

export default function Brothers() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: brothers, isLoading } = useQuery<Brother[]>({
    queryKey: ['/api/brothers'],
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ brotherhoodId, tag }: { brotherhoodId: string; tag: string | null }) => {
      return apiRequest(`/api/brothers/${brotherhoodId}/tag`, {
        method: 'PUT',
        body: JSON.stringify({ tag }),
      });
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

  // Filter brothers based on search query
  const filteredBrothers = brothers?.filter(brother => {
    const fullName = `${brother.firstName} ${brother.lastName}`.toLowerCase();
    const username = brother.username.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return fullName.includes(query) || username.includes(query);
  }) || [];

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

        {/* Search Bar - Always show when not loading */}
        {!isLoading && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search your brothers by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-white dark:border-white"
              data-testid="input-search-brothers"
            />
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
            {/* Show search results count */}
            {searchQuery && (
              <div className="mb-4 text-sm text-muted-foreground">
                {filteredBrothers.length === 0 
                  ? `No brothers found matching "${searchQuery}"`
                  : `${filteredBrothers.length} brother${filteredBrothers.length !== 1 ? 's' : ''} found`
                }
              </div>
            )}
            
            <div className="grid gap-4">
              {(searchQuery ? filteredBrothers : brothers).map((brother) => {
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
            
            {/* No search results message */}
            {searchQuery && filteredBrothers.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Brothers Found</h2>
                  <p className="text-muted-foreground mb-4">
                    No brothers match your search for "{searchQuery}"
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    Clear Search
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}