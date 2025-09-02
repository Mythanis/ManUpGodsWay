import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, Video, Users, MessageCircle, Settings, Headphones, Trophy, ChevronLeft, ChevronRight, ExternalLink, Heart, UserPlus, Dumbbell, Shield, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useRef, useState, useEffect } from "react";

const navItems = [
  { id: 'home', path: '/', label: 'Home', icon: Home },
  { id: 'library', path: '/library', label: 'Studies', icon: BookOpen },
  { id: 'videos', path: '/videos', label: 'Videos', icon: Video },
  { id: 'podcasts', path: '/podcasts', label: 'Podcasts', icon: Headphones },
  { id: 'challenges', path: '/challenges', label: 'Challenges', icon: Trophy },
  { id: 'fitness', path: '/fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'community', path: '/community', label: 'Community', icon: Users },
  { id: 'brothers', path: '/brothers', label: 'Brothers', icon: UserPlus },
  { id: 'messages', path: '/messages', label: 'Messages', icon: MessageCircle },
  { id: 'hurdle-wall', path: '/hurdle-wall', label: 'Hurdle Wall', icon: Shield },
  { id: 'discipleship', path: '/discipleship', label: 'Discipleship', icon: Heart },
  { id: 'more-man-up', path: '/more-man-up', label: 'More', icon: ExternalLink },
];

export default function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const maxVisibleItems = 5;
  const shouldShowScrollControls = allNavItems.length > maxVisibleItems;

  // Check scroll position and update arrow visibility
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Handle horizontal scroll with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollContainerRef.current) return;
    
    e.preventDefault();
    const scrollAmount = e.deltaY > 0 ? 100 : -100;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Scroll to direction
  const scrollToDirection = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const scrollAmount = direction === 'left' ? -100 : 100;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Update scroll buttons on mount and scroll
  useEffect(() => {
    updateScrollButtons();
    
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, [allNavItems]);

  return (
    <nav 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-50 h-16"
      data-testid="navigation-bottom"
    >
      <div className="relative flex items-center h-full">
        {/* Left Arrow */}
        {shouldShowScrollControls && canScrollLeft && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-0 z-10 h-full w-6 p-0 bg-card/90 backdrop-blur-sm border-r border-border rounded-none"
            onClick={() => scrollToDirection('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Scrollable container */}
        <div 
          ref={scrollContainerRef}
          className={`flex items-center h-full overflow-x-auto scrollbar-hide ${
            shouldShowScrollControls ? 'mx-6' : 'mx-2'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onWheel={handleWheel}
        >
          <div className="flex items-center h-full">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || 
                              (item.path === '/' && location === '/') ||
                              (item.path !== '/' && location.startsWith(item.path));
              
              return (
                <Link key={item.id} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`flex flex-col items-center justify-center h-full px-3 py-1 min-w-[60px] max-w-[70px] flex-shrink-0 rounded-none ${
                      isActive 
                        ? 'text-ministry-gold font-semibold bg-ministry-gold/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon className="w-4 h-4 mb-0.5 flex-shrink-0" />
                    <span className="font-medium text-[10px] leading-tight truncate w-full text-center">
                      {item.label}
                    </span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
        {shouldShowScrollControls && canScrollRight && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 z-10 h-full w-6 p-0 bg-card/90 backdrop-blur-sm border-l border-border rounded-none"
            onClick={() => scrollToDirection('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
