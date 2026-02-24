import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Users, User, Map, List, Mail, Plus, Shield, BookOpen, Award, Headphones, CheckCircle, ShoppingBag, Play } from "lucide-react";
import { BackButton } from "@/components/BackButton";

interface SystemSettings {
  warGroupsVideoUrl: string | null;
  warGroupsVideoTitle: string | null;
}

const WarGroupsMap = lazy(() => import("@/components/WarGroupsMap"));

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  meetingInfo: string | null;
  latitude: number | null;
  longitude: number | null;
  isHeadquarters: boolean | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

function getGroupDisplayName(group: WarGroup): string {
  if (group.isHeadquarters) {
    return "War Group HQ";
  }
  return `Outpost: ${group.city}`;
}

export default function WarGroups() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [distanceFilter, setDistanceFilter] = useState(25);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [activeTab, setActiveTab] = useState<'find' | 'about'>('find');
  
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [debouncedState, setDebouncedState] = useState("");
  const [debouncedDistance, setDebouncedDistance] = useState(25);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedCity(cityFilter);
      setDebouncedState(stateFilter);
      setDebouncedDistance(distanceFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, cityFilter, stateFilter, distanceFilter]);

  const { data: groups = [], isLoading, isFetching } = useQuery<WarGroup[]>({
    queryKey: ['/api/war-groups', { search: debouncedSearch, city: debouncedCity, state: debouncedState, distance: debouncedDistance }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (debouncedCity) params.append('city', debouncedCity);
      if (debouncedState) params.append('state', debouncedState);
      if (debouncedCity) params.append('distance', debouncedDistance.toString());
      
      const queryString = params.toString();
      const url = queryString ? `/api/war-groups?${queryString}` : '/api/war-groups';
      
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch war groups');
      return res.json();
    },
  });

  const { data: myGroups = [], isLoading: myGroupsLoading } = useQuery<WarGroup[]>({
    queryKey: ['/api/user/war-groups'],
  });

  // Fetch system settings for video
  const { data: systemSettings } = useQuery<SystemSettings>({
    queryKey: ['/api/system-settings'],
  });

  // Helper to extract YouTube/Vimeo embed URL
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  const initialLoading = isLoading && myGroupsLoading && groups.length === 0;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-4">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase">War Groups</h1>
              <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase">Local Discipleship Groups Across The USA</p>
            </div>
            <Button
              onClick={() => navigate('/war-groups/register')}
              className="bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black tracking-tight uppercase text-xs whitespace-nowrap rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              data-testid="button-register-war-group"
            >
              <Plus className="h-4 w-4 mr-2" />
              Register Group
            </Button>
          </div>
          
          {/* Tabs in Header */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('find')}
              className={`px-5 py-2.5 font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'find' 
                  ? 'bg-ministry-gold-exact text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'bg-white/10 text-white border-2 border-white/30 hover:bg-white/20'
              }`}
              data-testid="tab-find-groups"
            >
              Find Groups
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-5 py-2.5 font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'about' 
                  ? 'bg-ministry-gold-exact text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'bg-white/10 text-white border-2 border-white/30 hover:bg-white/20'
              }`}
              data-testid="tab-about-war-groups"
            >
              What are War Groups?
            </button>
          </div>
        </div>
      </div>

      {/* My Groups Section - Full Width */}
      {myGroups.length > 0 && (
        <div className="px-4 py-3 max-w-4xl mx-auto">
          <h2 className="text-lg font-black mb-3 tracking-tight uppercase flex items-center gap-2">
            <Shield className="h-5 w-5 text-ministry-gold-exact" />
            My War Group
          </h2>
          <div className="space-y-2">
            {myGroups.map((group) => (
              <Link key={group.id} href={`/war-groups/${group.id}`}>
                <Card className="border-2 border-black rounded-sm hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Gold section with icon */}
                      <div className="flex-1 bg-ministry-gold-exact p-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-black rounded-sm flex items-center justify-center flex-shrink-0 border-2 border-black">
                          <Shield className="h-6 w-6 text-ministry-gold-exact" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-black text-sm tracking-tight truncate">{getGroupDisplayName(group)}</span>
                          <span className="text-xs text-black/70 flex items-center gap-1 font-medium">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {group.city}, {group.state}
                          </span>
                        </div>
                      </div>
                      {/* Black section with stats */}
                      <div className="bg-black p-4 flex flex-col items-center justify-center gap-1 min-w-[100px]">
                        <div className="flex items-center gap-1 text-white">
                          <Users className="h-4 w-4 text-ministry-gold-exact" />
                          <span className="font-black text-lg">{group.memberCount}</span>
                        </div>
                        <Badge className="bg-ministry-gold-exact text-black text-xs py-0.5 rounded-sm font-bold uppercase tracking-wide border-2 border-black">Member</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* About War Groups Content */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Explainer Video Section */}
            {systemSettings?.warGroupsVideoUrl && getEmbedUrl(systemSettings.warGroupsVideoUrl) && (
              <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-ministry-gold-exact w-12 h-12 flex items-center justify-center border-2 border-black">
                      <Play className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-xl text-white font-black tracking-tight uppercase">
                      {systemSettings.warGroupsVideoTitle || "Watch This First"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 relative z-10">
                  <div className="aspect-video bg-black border-2 border-ministry-gold-exact overflow-hidden">
                    <iframe
                      src={getEmbedUrl(systemSettings.warGroupsVideoUrl) || ""}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={systemSettings.warGroupsVideoTitle || "War Groups Explainer Video"}
                      data-testid="video-war-groups-explainer"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
              <CardHeader className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-8 w-8 text-ministry-gold-exact" />
                  <CardTitle className="text-2xl text-white font-black tracking-tight uppercase">Welcome to War Groups</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 text-gray-300 relative z-10">
                <p className="text-white leading-relaxed">
                  War Groups are small, brotherhood-driven discipleship groups designed to help men grow strong in their faith, sharpen their character, and live out biblical manhood in everyday life. This is not a casual gathering or a surface-level Bible study. War Groups are about commitment, accountability, and real spiritual transformation through the Word of God.
                </p>
                <p className="leading-relaxed">
                  In a War Group, men meet regularly with a clear purpose: to pursue Christ together, speak truth in love, and walk shoulder to shoulder through life's battles. You will be challenged to grow spiritually, lead your home with integrity, and stand firm in a culture that constantly pulls men away from God's design.
                </p>

                <div className="border-t border-ministry-gold-exact/30 pt-6">
                  <h3 className="text-xl font-black text-ministry-gold-exact mb-4 tracking-tight uppercase">Benefits of Starting or Joining a War Group</h3>
                  <p className="mb-4">When you join or launch a War Group, you gain access to a complete discipleship ecosystem built to equip and sustain men for the long haul.</p>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <BookOpen className="h-6 w-6 text-ministry-gold-exact flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Unlimited Bible Studies</h4>
                        <p className="text-sm">You will have unlimited access to biblically grounded Bible studies that walk men through foundational faith, spiritual discipline, leadership, and perseverance. These studies are designed to be practical, Scripture-centered, and easy to lead, whether you are a seasoned leader or stepping into leadership for the first time.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Award className="h-6 w-6 text-ministry-gold-exact flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Leadership Training</h4>
                        <p className="text-sm">You will receive ongoing leadership training to help you grow as a man, husband, father, and disciple-maker. This includes guidance on leading groups, discipling others, and building strong, accountable brotherhoods.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Headphones className="h-6 w-6 text-ministry-gold-exact flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Monthly Prayer Calls</h4>
                        <p className="text-sm">War Group members are invited to monthly prayer calls that unite men across the country. These calls focus on prayer, encouragement, biblical teaching, and standing together in spiritual warfare.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle className="h-6 w-6 text-ministry-gold-exact flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Official Recognition</h4>
                        <p className="text-sm">As a licensed War Group, you are officially recognized as part of the War Groups network. Your group can be listed and pinned on the app, helping men in your area find biblical brotherhood and accountability.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <ShoppingBag className="h-6 w-6 text-ministry-gold-exact flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Licensed Merchandise</h4>
                        <p className="text-sm">You also gain access to licensed War Groups merchandise, including apparel and materials that represent commitment, identity, and mission. These resources help build unity within your group and visibility in your community.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-ministry-gold-exact/30 pt-6">
                  <p className="text-white leading-relaxed">
                    War Groups provide structure without control, accountability without shame, and brotherhood without isolation. This is not about hype or personality. It is about men standing together under the authority of God's Word.
                  </p>
                  <p className="text-ministry-gold-exact font-semibold mt-4">
                    If you are ready to stop walking alone and start building something that lasts, War Groups are where the fight becomes family.
                  </p>
                </div>

                <div className="border-t border-ministry-gold-exact/30 pt-6">
                  <h3 className="text-xl font-black text-ministry-gold-exact mb-4 tracking-tight uppercase">War Groups HQ</h3>
                  <p className="leading-relaxed mb-4">
                    War Groups HQ is the central hub for the War Groups movement, equipping men to live out biblical manhood through discipleship, accountability, and brotherhood. Our mission is simple and uncompromising: to raise up men who are grounded in the Word of God, committed to prayer, and willing to lead with courage in their homes, churches, and communities.
                  </p>
                  <p className="leading-relaxed mb-4">
                    War Groups HQ provides the structure, resources, and support needed to start and sustain strong discipleship groups. Through biblically sound studies, leadership training, and ongoing prayer support, we help men move from passive faith to active obedience. Everything we do is rooted in Scripture and designed for real life, real struggles, and real growth.
                  </p>
                  <p className="leading-relaxed mb-4">
                    As the headquarters for the War Groups network, we connect leaders and groups across the country, offering guidance, encouragement, and shared vision. From monthly prayer calls to leadership development and licensed resources, War Groups HQ exists to ensure no man fights alone.
                  </p>
                  <p className="text-white font-medium">
                    We believe men are called to stand firm, to sharpen one another, and to lead with integrity. War Groups HQ is where the mission is fueled, the leaders are equipped, and the brotherhood is strengthened.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => navigate('/war-groups/register')}
                    className="w-full bg-ministry-gold-exact text-black hover:bg-yellow-400 font-black py-4 px-4 rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wide text-sm h-auto whitespace-normal text-center leading-tight"
                    data-testid="button-register-from-about"
                  >
                    <Plus className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span>Ready to Start a War Group? Register Now</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Find Groups Content */}
        {activeTab === 'find' && (
          <>
            {/* Search Section */}
            <div className="relative z-10">
              <h2 className="text-xl font-black mb-4 tracking-tight uppercase">Discover Groups</h2>
          <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
            <CardContent className="pt-6 relative z-10">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-black pointer-events-none z-20" />
                  <Input
                    type="text"
                    placeholder="SEARCH BY NAME OR CITY..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide border-2 border-black rounded-sm font-medium"
                    data-testid="input-search-groups"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="text"
                    placeholder="CITY"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-white text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide border-2 border-black rounded-sm font-medium"
                    data-testid="input-filter-city"
                  />
                  <Input
                    type="text"
                    placeholder="STATE"
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="bg-white text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide border-2 border-black rounded-sm font-medium"
                    data-testid="input-filter-state"
                  />
                </div>
                <div className="bg-white/10 p-4 border-2 border-ministry-gold-exact rounded-sm">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-white font-black text-xs uppercase tracking-wide">
                      Search Distance
                    </label>
                    <span className="bg-ministry-gold-exact text-black px-3 py-1 font-black text-sm border-2 border-black" data-testid="text-distance-value">
                      {distanceFilter} miles
                    </span>
                  </div>
                  <Slider
                    value={[distanceFilter]}
                    onValueChange={(value) => setDistanceFilter(value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="slider-distance"
                  />
                  <div className="flex justify-between mt-2 text-white/60 text-xs font-bold uppercase">
                    <span>0 mi</span>
                    <span>50 mi</span>
                    <span>100 mi</span>
                  </div>
                </div>
                {isFetching && (
                  <p className="text-xs text-white text-center font-bold tracking-wide uppercase">Searching...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Groups List/Map */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black tracking-tight uppercase">
              Available Groups {!isLoading && groups.length > 0 && <span className="text-ministry-gold-exact">({groups.length})</span>}
            </h2>
            {groups.length > 0 && (
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`rounded-sm text-xs font-black uppercase tracking-wide ${viewMode === 'list' ? 'bg-black text-white border-2 border-black' : 'bg-white border-2 border-black text-black hover:bg-gray-100'}`}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                  className={`rounded-sm text-xs font-black uppercase tracking-wide ${viewMode === 'map' ? 'bg-black text-white border-2 border-black' : 'bg-white border-2 border-black text-black hover:bg-gray-100'}`}
                  data-testid="button-view-map"
                >
                  <Map className="h-4 w-4 mr-1" />
                  Map
                </Button>
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-ministry-gold-exact border border-black">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-32 bg-ministry-steel" />
                        <Skeleton className="h-3 w-24 bg-ministry-steel" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-3 w-20 bg-ministry-steel" />
                        <Skeleton className="h-3 w-8 bg-ministry-steel" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="space-y-4">
              <Card className="liquid-gold-card border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="text-center py-12">
                  <MapPin className="h-12 w-12 text-black mx-auto mb-4 relative z-10" />
                  <p className="text-black font-black text-lg mb-2 uppercase tracking-tight relative z-10">No groups found in your area</p>
                  <p className="text-sm text-black font-medium relative z-10">Try adjusting your search filters</p>
                </CardContent>
              </Card>
              
              {/* Start a Group Section */}
              <Card className="liquid-black border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]">
                <CardContent className="py-8">
                  <div className="text-center">
                    <h3 className="text-ministry-gold-exact text-2xl font-black mb-3 uppercase tracking-tight">
                      Want to Start a Group in Your Area?
                    </h3>
                    <p className="text-white mb-6 max-w-2xl mx-auto">
                      Be a leader in your community. Bring biblical masculinity and discipleship to the men in your area. 
                      Licensed groups get exclusive rights to use the Man Up God's Way brand and merchandise in their city.
                    </p>
                    <a
                      href="mailto:info@manupgodsway.org?subject=Start a War Group&body=I'm interested in starting a licensed Man Up God's Way war group in my area.%0D%0A%0D%0ACity:%0D%0AState:%0D%0AName:%0D%0APhone:%0D%0A%0D%0APlease send me more information about licensing requirements and getting started."
                      className="inline-flex items-center gap-2 bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black py-3 px-6 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-wide text-sm"
                      data-testid="link-start-group"
                    >
                      <Mail className="h-5 w-5" />
                      Get More Information
                    </a>
                    <p className="text-ministry-gold-exact text-xs mt-4 font-bold tracking-wide uppercase">
                      Contact: info@manupgodsway.org
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : viewMode === 'map' ? (
            <Suspense fallback={
              <div className="h-[500px] w-full rounded-sm overflow-hidden border-2 border-black bg-ministry-gold-exact flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                  <p className="text-black font-black uppercase tracking-wide text-sm">Loading Map...</p>
                </div>
              </div>
            }>
              <WarGroupsMap groups={groups} />
            </Suspense>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <Link key={group.id} href={`/war-groups/${group.id}`}>
                  <Card className="liquid-gold-card border-2 border-black rounded-sm hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-black text-black text-sm tracking-tight relative z-10">{getGroupDisplayName(group)}</span>
                            <span className="text-xs text-black/70 flex items-center gap-1 font-medium relative z-10">
                              <MapPin className="h-3 w-3" />
                              {group.city}, {group.state}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                          <span className="text-xs text-black flex items-center gap-1 font-semibold">
                            <User className="h-3 w-3" />
                            {group.leader.firstName} {group.leader.lastName}
                          </span>
                          <span className="text-xs text-black flex items-center gap-1 font-bold bg-black/10 px-2 py-0.5">
                            <Users className="h-3 w-3" />
                            {group.memberCount}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
