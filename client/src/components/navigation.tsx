import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, Video, Users, MessageCircle, Settings, Headphones, Trophy, ExternalLink, Heart, UserPlus, Dumbbell, Shield, Crown, Book, Calendar, MoreHorizontal, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { id: 'home', path: '/', label: 'Home', icon: Home },
  { id: 'library', path: '/library', label: 'Studies', icon: BookOpen },
  { id: 'videos', path: '/videos', label: 'Videos', icon: Video },
  { id: 'podcasts', path: '/podcasts', label: 'Podcasts', icon: Headphones },
  { id: 'challenges', path: '/challenges', label: 'Challenges', icon: Trophy },
  { id: 'fitness', path: '/fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'events', path: '/events', label: 'Events', icon: Calendar },
  { id: 'community', path: '/community', label: 'Community', icon: Users },
  { id: 'brothers', path: '/brothers', label: 'Brothers', icon: UserPlus },
  { id: 'messages', path: '/messages', label: 'Messages', icon: MessageCircle },
  { id: 'hurdle-wall', path: '/hurdle-wall', label: 'War Room', icon: Shield },
  { id: 'war-groups', path: '/war-groups', label: 'War Groups', icon: MapPin },
  { id: 'discipleship', path: '/discipleship', label: 'Discipleship', icon: Heart },
  { id: 'bible', path: '/bible', label: 'Bible', icon: Book },
  { id: 'more-man-up', path: '/more-man-up', label: 'Man Up', icon: ExternalLink },
];

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  // Add admin/owner tabs based on user role
  let allNavItems = navItems;
  
  if ((user as any)?.role === 'admin') {
    allNavItems = [...navItems, { id: 'admin', path: '/admin', label: 'Admin', icon: Settings }];
  } else if ((user as any)?.role === 'owner') {
    allNavItems = [...navItems, 
      { id: 'admin', path: '/admin', label: 'Admin', icon: Settings },
      { id: 'owners', path: '/owners', label: 'Owners', icon: Crown }
    ];
  }

  // Define primary tabs (always visible)
  const primaryTabIds = ['home', 'library', 'community', 'hurdle-wall'];
  
  // Split items into primary and dropdown items
  const primaryItems = allNavItems.filter(item => primaryTabIds.includes(item.id));
  const dropdownItems = allNavItems.filter(item => !primaryTabIds.includes(item.id));

  const isActive = (itemPath: string) => {
    return location === itemPath || 
           (itemPath === '/' && location === '/') ||
           (itemPath !== '/' && location.startsWith(itemPath));
  };

  // Check if any dropdown item is active
  const isDropdownActive = dropdownItems.some(item => isActive(item.path));

  return (
    <nav 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-card border-t border-ministry-charcoal z-50 h-16"
      data-testid="navigation-bottom"
    >
      <div className="flex items-center justify-around h-full px-2">
        {/* Primary navigation items */}
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link key={item.id} href={item.path}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center h-full px-3 py-1 min-w-[60px] max-w-[80px] flex-shrink-0 rounded-none ${
                  active 
                    ? 'text-ministry-gold font-semibold bg-ministry-gold/10' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="w-5 h-5 mb-0.5 flex-shrink-0" />
                <span className="font-medium text-[10px] leading-tight truncate w-full text-center">
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`flex flex-col items-center justify-center h-full px-3 py-1 min-w-[60px] max-w-[80px] flex-shrink-0 rounded-none ${
                isDropdownActive
                  ? 'text-ministry-gold font-semibold bg-ministry-gold/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              data-testid="nav-more"
            >
              <MoreHorizontal className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="font-medium text-[10px] leading-tight truncate w-full text-center">
                More
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            side="top"
            className="w-48 mb-2"
            data-testid="dropdown-more-menu"
          >
            {dropdownItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => setLocation(item.path)}
                  className={`cursor-pointer ${
                    active 
                      ? 'text-ministry-gold bg-ministry-gold/10 font-semibold' 
                      : ''
                  }`}
                  data-testid={`dropdown-nav-${item.id}`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
