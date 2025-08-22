import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Heart, Tag } from "lucide-react";
import { Link } from "wouter";

interface UserWithTestimony {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  testimonyTags: string[];
  faithJourneyStage: string | null;
  tier: string;
}

interface TestimonyTag {
  tag: string;
  count: number;
}

export default function Discipleship() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedFaithStage, setSelectedFaithStage] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserWithTestimony[]>([]);

  // Fetch all available testimony tags
  const { data: tags = [], isLoading: tagsLoading } = useQuery<TestimonyTag[]>({
    queryKey: ['/api/testimony-tags'],
  });

  // Fetch users with testimonies and tags
  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithTestimony[]>({
    queryKey: ['/api/users-with-testimonies'],
  });

  // Filter users based on search query, selected tag, and faith journey stage
  useEffect(() => {
    let filtered = users;

    // Filter by selected tag
    if (selectedTag) {
      filtered = filtered.filter(user => 
        user.testimonyTags.some(tag => 
          tag.toLowerCase() === selectedTag.toLowerCase()
        )
      );
    }

    // Filter by faith journey stage
    if (selectedFaithStage) {
      filtered = filtered.filter(user => 
        user.faithJourneyStage === selectedFaithStage
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.testimonyTags.some(tag => 
          tag.toLowerCase().includes(query)
        ) ||
        user.displayName?.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, selectedTag, selectedFaithStage]);

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    setSearchQuery(tag); // Also update search to show what's selected
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTag("");
    setSelectedFaithStage("");
  };

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen pb-20">
      {/* Header */}
      <div className="bg-ministry-navy text-white p-6 pb-8">
        <div className="flex items-center space-x-3 mb-4">
          <Heart className="w-6 h-6 text-ministry-gold" />
          <h1 className="text-2xl font-bold">Discipleship</h1>
        </div>
        <p className="text-ministry-gold/90 text-sm">
          Connect with others through shared testimony tags and discover fellow believers' faith journeys
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Search and Filter Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-ministry-gold" />
              <span>Find People by Tags</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <Label htmlFor="tag-search" className="text-white">Search by tag or name</Label>
              <Input
                id="tag-search"
                placeholder="Type a testimony tag or user name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                data-testid="input-tag-search"
              />
            </div>

            {/* Tag Dropdown */}
            <div className="space-y-2">
              <Label className="text-white">Browse all tags</Label>
              {tagsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <Select value={selectedTag} onValueChange={handleTagSelect}>
                  <SelectTrigger data-testid="select-tag-dropdown">
                    <SelectValue placeholder="Select a tag to explore" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tagData) => (
                      <SelectItem key={tagData.tag} value={tagData.tag}>
                        <div className="flex items-center justify-between w-full">
                          <span>{tagData.tag}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {tagData.count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Faith Journey Stage Filter */}
            <div className="space-y-2">
              <Label className="text-white">Filter by faith journey stage</Label>
              <Select value={selectedFaithStage} onValueChange={setSelectedFaithStage}>
                <SelectTrigger data-testid="select-faith-stage-filter">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All stages</SelectItem>
                  <SelectItem value="beginning">Just beginning their walk in faith</SelectItem>
                  <SelectItem value="middle">In the middle of their faith, still transforming</SelectItem>
                  <SelectItem value="mature">Mature in their faith, steady in God's love</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters and Clear */}
            {(searchQuery || selectedTag || selectedFaithStage) && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-white">Active filters:</span>
                  {selectedTag && (
                    <Badge className="bg-ministry-gold-exact text-black">
                      {selectedTag}
                    </Badge>
                  )}
                  {selectedFaithStage && (
                    <Badge className="bg-ministry-navy text-white">
                      {selectedFaithStage === 'beginning' ? 'Beginning' : 
                       selectedFaithStage === 'middle' ? 'Middle' : 'Mature'}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="text-ministry-gold hover:text-ministry-gold/80"
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-ministry-gold" />
                <span>Community Members</span>
              </div>
              <Badge variant="outline" className="text-ministry-gold border-ministry-gold">
                {filteredUsers.length} found
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 mx-auto mb-4 text-ministry-slate/50" />
                <h3 className="text-lg font-semibold text-white mb-2">No members found</h3>
                <p className="text-white/70 text-sm">
                  {searchQuery || selectedTag || selectedFaithStage
                    ? "Try adjusting your search filters or browse different options" 
                    : "No community members have shared testimonies with tags yet"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <Link key={user.id} href={`/users/${user.id}`}>
                    <Card className="hover:bg-ministry-gold/5 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback className="bg-ministry-navy text-white font-semibold">
                              {(user.displayName || user.username).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-white truncate">
                                  {user.displayName || user.username}
                                </h3>
                                {user.displayName && (
                                  <p className="text-xs text-white/70">@{user.username}</p>
                                )}
                              </div>
                              <Badge 
                                className={`text-xs ${
                                  user.tier === 'vip' 
                                    ? 'bg-ministry-gold-exact text-black' 
                                    : user.tier === 'premium'
                                    ? 'bg-ministry-steel text-white'
                                    : 'bg-ministry-slate text-white'
                                }`}
                              >
                                {user.tier.toUpperCase()}
                              </Badge>
                            </div>
                            
                            {user.testimonyTags.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-1">
                                  <Tag className="w-3 h-3 text-ministry-gold" />
                                  <span className="text-xs text-white/70">Testimony tags:</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {user.testimonyTags.slice(0, 3).map((tag, index) => (
                                    <Badge 
                                      key={index}
                                      variant="outline" 
                                      className="text-xs bg-ministry-gold-exact/20 text-black border-ministry-gold"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                  {user.testimonyTags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{user.testimonyTags.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Faith Journey Stage */}
                            {user.faithJourneyStage && (
                              <div className="mt-2">
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-ministry-navy/20 text-ministry-gold border-ministry-navy"
                                >
                                  {user.faithJourneyStage === 'beginning' ? 'Beginning Faith Journey' : 
                                   user.faithJourneyStage === 'middle' ? 'Faith Journey in Progress' : 
                                   'Mature Faith Journey'}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card className="bg-ministry-navy/20">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Heart className="w-5 h-5 text-ministry-gold flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-ministry-gold mb-2">How it works</h4>
                <ul className="text-sm text-white/80 space-y-1">
                  <li>• Search for specific testimony tags or user names</li>
                  <li>• Browse the dropdown to see all available tags</li>
                  <li>• Click on any member to view their full profile</li>
                  <li>• Connect with others who share similar faith experiences</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}