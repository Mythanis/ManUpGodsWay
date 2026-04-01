import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, Video, Users, MessageCircle, Settings, Headphones, Trophy, ExternalLink, FileText, UserPlus, Dumbbell, Shield, Crown, Book, Calendar, MoreHorizontal, MapPin, Flame, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LS_KEY_STUDIES = "nav_seen_studies";
const LS_KEY_COMMUNITY = "nav_seen_community";
const LS_KEY_WAR_ROOM = "nav_seen_war_room";
const LS_KEY_UNDER_FIRE = "nav_seen_under_fire";

function getSeenTs(key: string): number {
  const val = localStorage.getItem(key);
  if (val) return parseInt(val, 10);
  const now = Date.now();
  localStorage.setItem(key, String(now));
  return now;
}

function markSeen(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

const navItems = [
  { id: 'home', path: '/', label: 'Home', icon: Home },
  { id: 'library', path: '/library', label: 'Studies', icon: BookOpen },
  { id: 'notifications', path: '/notifications', label: 'Alerts', icon: Bell },
  { id: 'videos', path: '/videos', label: 'Videos', icon: Video },
  { id: 'podcasts', path: '/podcasts', label: 'Podcasts', icon: Headphones },
  { id: 'challenges', path: '/challenges', label: 'Challenges', icon: Trophy },
  { id: 'fitness', path: '/fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'events', path: '/events', label: 'Events', icon: Calendar },
  { id: 'community', path: '/community', label: 'Community', icon: Users },
  { id: 'brothers', path: '/brothers', label: 'Brothers', icon: UserPlus },
  { id: 'messages', path: '/messages', label: 'Messages', icon: MessageCircle },
  { id: 'war-groups', path: '/war-groups', label: 'War Grps', icon: MapPin },
  { id: 'war-room', path: '/hurdle-wall', label: 'War Room', icon: Shield },
  { id: 'under-fire', path: '/under-fire', label: 'Under Fire', icon: Flame },
  { id: 'blog', path: '/blog', label: 'Blog', icon: FileText },
  { id: 'bible', path: '/bible', label: 'Bible', icon: Book },
  { id: 'more-man-up', path: '/more-man-up', label: 'Man Up', icon: ExternalLink },
];

function NavBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full border-2 border-card flex items-center justify-center font-black leading-none"
      style={{
        fontSize: 9,
        minWidth: label.length > 1 ? 18 : 16,
        height: 16,
        paddingLeft: label.length > 1 ? 3 : 0,
        paddingRight: label.length > 1 ? 3 : 0,
      }}
    >
      {label}
    </span>
  );
}

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const studiesSince = getSeenTs(LS_KEY_STUDIES);
  const communitySince = getSeenTs(LS_KEY_COMMUNITY);
  const warRoomSince = getSeenTs(LS_KEY_WAR_ROOM);
  const underFireSince = getSeenTs(LS_KEY_UNDER_FIRE);

  const { data: badges, refetch: refetchBadges } = useQuery<{ studies: number; community: number; warRoom: number; underFire: number }>({
    queryKey: ['/api/nav/badges/v2', studiesSince, communitySince, warRoomSince, underFireSince],
    queryFn: async () => {
      const res = await fetch(
        `/api/nav/badges?studiesSince=${studiesSince}&communitySince=${communitySince}&warRoomSince=${warRoomSince}&underFireSince=${underFireSince}`,
        { credentials: "include" }
      );
      if (!res.ok) return { studies: 0, community: 0, warRoom: 0, underFire: 0 };
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
    retry: false,
  });

  useEffect(() => {
    const count = unreadData?.count ?? 0;
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [unreadData?.count]);

  // Clear badge immediately when app becomes visible (e.g. tapping icon from home screen)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if ('clearAppBadge' in navigator) {
          (navigator as any).clearAppBadge().catch(() => {});
        }
        // Refetch so the badge re-sets accurately if there are still unread notifications
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  const handleNavClick = useCallback((itemId: string) => {
    if (itemId === 'library') {
      markSeen(LS_KEY_STUDIES);
      refetchBadges();
    }
    if (itemId === 'community') {
      markSeen(LS_KEY_COMMUNITY);
      refetchBadges();
    }
    if (itemId === 'war-room') {
      markSeen(LS_KEY_WAR_ROOM);
      refetchBadges();
    }
    if (itemId === 'under-fire') {
      markSeen(LS_KEY_UNDER_FIRE);
      refetchBadges();
    }
  }, [refetchBadges]);

  useEffect(() => {
    if (location.startsWith('/library') || location === '/library') {
      markSeen(LS_KEY_STUDIES);
    }
    if (location.startsWith('/community') || location === '/community') {
      markSeen(LS_KEY_COMMUNITY);
    }
    if (location === '/hurdle-wall') {
      markSeen(LS_KEY_WAR_ROOM);
    }
    if (location === '/under-fire') {
      markSeen(LS_KEY_UNDER_FIRE);
    }
  }, [location]);

  let allNavItems = navItems;
  if ((user as any)?.role === 'admin') {
    allNavItems = [...navItems, { id: 'admin', path: '/admin', label: 'Admin', icon: Settings }];
  } else if ((user as any)?.role === 'owner') {
    allNavItems = [...navItems,
      { id: 'admin', path: '/admin', label: 'Admin', icon: Settings },
      { id: 'owners', path: '/owners', label: 'Owners', icon: Crown }
    ];
  }

  const primaryTabIds = ['home', 'library', 'community', 'war-groups'];
  const primaryItems = allNavItems.filter(item => primaryTabIds.includes(item.id));
  const dropdownItems = allNavItems.filter(item => !primaryTabIds.includes(item.id));

  const isActive = (itemPath: string) => {
    return location === itemPath ||
           (itemPath === '/' && location === '/') ||
           (itemPath !== '/' && location.startsWith(itemPath));
  };

  const isDropdownActive = dropdownItems.some(item => isActive(item.path));

  const getBadgeCount = (itemId: string): number => {
    if (itemId === 'notifications') {
      const n = unreadData?.count ?? 0;
      return isNaN(n) ? 0 : n;
    }
    let raw: number | undefined;
    if (itemId === 'library') raw = badges?.studies;
    else if (itemId === 'community') raw = badges?.community;
    else if (itemId === 'war-room') raw = badges?.warRoom;
    else if (itemId === 'under-fire') raw = badges?.underFire;
    if (raw === undefined || raw === null) return 0;
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-card border-t border-ministry-charcoal z-50 h-16"
      data-testid="navigation-bottom"
    >
      <div className="flex items-center justify-around h-full px-2">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const count = getBadgeCount(item.id);

          return (
            <Link key={item.id} href={item.path} onClick={() => handleNavClick(item.id)}>
              <Button
                variant="ghost"
                className={`relative flex flex-col items-center justify-center h-full px-3 py-1 min-w-[60px] max-w-[80px] flex-shrink-0 rounded-sm ${
                  active
                    ? 'text-ministry-gold font-semibold bg-ministry-gold/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                data-testid={`nav-${item.id}`}
              >
                {count > 0 && <NavBadge count={count} />}
                <Icon className="w-5 h-5 mb-0.5 flex-shrink-0" />
                <span className="font-medium text-[10px] leading-tight truncate w-full text-center">
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`relative flex flex-col items-center justify-center h-full px-3 py-1 min-w-[60px] max-w-[80px] flex-shrink-0 rounded-sm ${
                isDropdownActive
                  ? 'text-ministry-gold font-semibold bg-ministry-gold/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              data-testid="nav-more"
            >
              {(() => {
                const moreTotal = (unreadData?.count ?? 0) + (badges?.warRoom ?? 0) + (badges?.underFire ?? 0);
                return moreTotal > 0 ? <NavBadge count={moreTotal} /> : null;
              })()}
              <MoreHorizontal className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="font-medium text-[10px] leading-tight truncate w-full text-center">
                More
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-80 mb-2 bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2"
            data-testid="dropdown-more-menu"
          >
            <div className="grid grid-cols-2 gap-1">
            {dropdownItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const dropdownBadge = getBadgeCount(item.id);

              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => { handleNavClick(item.id); setLocation(item.path); }}
                  className={`relative cursor-pointer rounded-sm font-bold uppercase text-sm tracking-wide px-3 py-3 ${
                    active
                      ? 'text-black bg-ministry-gold-exact'
                      : 'text-white hover:bg-ministry-gold-exact hover:text-black'
                  }`}
                  data-testid={`dropdown-nav-${item.id}`}
                >
                  <Icon className={`w-5 h-5 mr-2 flex-shrink-0 ${active ? 'text-black' : 'text-ministry-gold-exact'}`} />
                  {item.label}
                  {dropdownBadge > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none">
                      {dropdownBadge > 99 ? '99+' : dropdownBadge}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
