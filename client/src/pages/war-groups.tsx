import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Users, User, Map, List, Mail, Plus } from "lucide-react";

const WarGroupsMap = lazy(() => import("@/components/WarGroupsMap"));

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
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [debouncedState, setDebouncedState] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedCity(cityFilter);
      setDebouncedState(stateFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, cityFilter, stateFilter]);

  const { data: groups = [], isLoading } = useQuery<WarGroup[]>({
    queryKey: ['/api/war-groups', { search: debouncedSearch, city: debouncedCity, state: debouncedState }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (debouncedCity) params.append('city', debouncedCity);
      if (debouncedState) params.append('state', debouncedState);
      
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
            <p className="text-ministry-gold-exact text-sm font-semibold">Local Discipleship Groups Across The USA</p>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black mb-2 tracking-tight">War Groups</h1>
              <p className="text-ministry-gold-exact text-sm font-semibold">Local Discipleship Groups Across The USA</p>
            </div>
            <Button
              onClick={() => navigate('/war-groups/register')}
              className="bg-ministry-gold-exact hover:bg-ministry-gold text-black font-semibold whitespace-nowrap"
              data-testid="button-register-war-group"
            >
              <Plus className="h-4 w-4 mr-2" />
              Register a War Group
            </Button>
          </div>
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
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-4">Discover Groups</h2>
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ministry-slate pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search groups by name or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white relative z-10"
                    data-testid="input-search-groups"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="text"
                    placeholder="City"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-white relative z-10"
                    data-testid="input-filter-city"
                  />
                  <Input
                    type="text"
                    placeholder="State"
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="bg-white relative z-10"
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

        {/* Groups List/Map */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              Available Groups {!isLoading && groups.length > 0 && `(${groups.length})`}
            </h2>
            {groups.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-black text-white' : 'border-black text-black'}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                  className={viewMode === 'map' ? 'bg-black text-white' : 'border-black text-black'}
                  data-testid="button-view-map"
                >
                  <Map className="h-4 w-4 mr-2" />
                  Map
                </Button>
              </div>
            )}
          </div>
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
            <div className="space-y-4">
              <Card className="bg-ministry-gold-exact border-2 border-black">
                <CardContent className="text-center py-12">
                  <MapPin className="h-12 w-12 text-ministry-steel mx-auto mb-4" />
                  <p className="text-black font-semibold text-lg mb-2">No groups found in your area</p>
                  <p className="text-sm text-black">Try adjusting your search filters</p>
                </CardContent>
              </Card>
              
              {/* Start a Group Section */}
              <Card className="bg-black border-2 border-ministry-gold-exact">
                <CardContent className="py-8">
                  <div className="text-center">
                    <h3 className="text-ministry-gold-exact text-2xl font-black mb-3">
                      Want to Start a Group in Your Area?
                    </h3>
                    <p className="text-white mb-6 max-w-2xl mx-auto">
                      Be a leader in your community. Bring biblical masculinity and discipleship to the men in your area. 
                      Licensed groups get exclusive rights to use the Man Up God's Way brand and merchandise in their city.
                    </p>
                    <a
                      href="mailto:info@manupgodsway.org?subject=Start a War Group&body=I'm interested in starting a licensed Man Up God's Way war group in my area.%0D%0A%0D%0ACity:%0D%0AState:%0D%0AName:%0D%0APhone:%0D%0A%0D%0APlease send me more information about licensing requirements and getting started."
                      className="inline-flex items-center gap-2 bg-ministry-gold-exact hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-colors"
                      data-testid="link-start-group"
                    >
                      <Mail className="h-5 w-5" />
                      Get More Information
                    </a>
                    <p className="text-ministry-gold-exact text-sm mt-4">
                      Contact: info@manupgodsway.org
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : viewMode === 'map' ? (
            <Suspense fallback={
              <div className="h-[500px] w-full rounded-lg overflow-hidden border-2 border-black bg-ministry-gold-exact flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                  <p className="text-black font-semibold">Loading map...</p>
                </div>
              </div>
            }>
              <WarGroupsMap groups={groups} />
            </Suspense>
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
