import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Users, User } from "lucide-react";

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  meetingInfo: string | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

export default function WarGroups() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const { data: groups = [], isLoading } = useQuery<WarGroup[]>({
    queryKey: ['/api/war-groups', { search: searchTerm, city: cityFilter, state: stateFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (cityFilter) params.append('city', cityFilter);
      if (stateFilter) params.append('state', stateFilter);
      
      const queryString = params.toString();
      const url = queryString ? `/api/war-groups?${queryString}` : '/api/war-groups';
      
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch war groups');
      return res.json();
    },
  });

  const { data: myGroups = [] } = useQuery<WarGroup[]>({
    queryKey: ['/api/user/war-groups'],
  });

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-black mb-2 tracking-tight">War Groups</h1>
            <p className="text-ministry-gold-exact text-sm font-semibold">Local discipleship groups across the USA</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-ministry-gold-exact rounded"></div>
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tight">War Groups</h1>
          <p className="text-ministry-gold-exact text-sm font-semibold">Local discipleship groups across the USA</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* My Groups Section */}
        {myGroups.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">My Groups</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {myGroups.map((group) => (
                <Link key={group.id} href={`/war-groups/${group.id}`}>
                  <Card className="bg-ministry-gold-exact border-2 border-black hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-black">{group.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-black">
                        <MapPin className="h-4 w-4" />
                        {group.city}, {group.state}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-black" />
                          <span className="text-sm text-black font-semibold">{group.memberCount} members</span>
                        </div>
                        <Badge className="bg-black text-white">Member</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Search Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Discover Groups</h2>
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ministry-slate" />
                  <Input
                    type="text"
                    placeholder="Search groups by name or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                    data-testid="input-search-groups"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="text"
                    placeholder="City"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-white"
                    data-testid="input-filter-city"
                  />
                  <Input
                    type="text"
                    placeholder="State"
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="bg-white"
                    data-testid="input-filter-state"
                  />
                </div>
                {isLoading && (
                  <p className="text-xs text-black text-center">Searching...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Groups List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">
            Available Groups {!isLoading && groups.length > 0 && `(${groups.length})`}
          </h2>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-ministry-gold-exact border-2 border-black">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-ministry-steel" />
                    <Skeleton className="h-4 w-1/2 bg-ministry-steel" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full bg-ministry-steel mb-2" />
                    <Skeleton className="h-4 w-1/3 bg-ministry-steel" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <Card className="bg-ministry-gold-exact border-2 border-black">
              <CardContent className="text-center py-12">
                <MapPin className="h-12 w-12 text-ministry-steel mx-auto mb-4" />
                <p className="text-black font-semibold">No groups found in your area</p>
                <p className="text-sm text-black mt-2">Try adjusting your search filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <Link key={group.id} href={`/war-groups/${group.id}`}>
                  <Card className="bg-ministry-gold-exact border-2 border-black hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-black">{group.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-black">
                        <MapPin className="h-4 w-4" />
                        {group.city}, {group.state}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {group.description && (
                        <p className="text-sm text-black mb-4 line-clamp-2">{group.description}</p>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-black" />
                          <span className="text-sm text-black font-semibold">{group.memberCount} members</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-black" />
                          <span className="text-sm text-black">
                            Led by {group.leader.firstName} {group.leader.lastName}
                          </span>
                        </div>
                        {group.meetingInfo && (
                          <p className="text-xs text-black mt-2 line-clamp-1">
                            <strong>Meets:</strong> {group.meetingInfo}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
