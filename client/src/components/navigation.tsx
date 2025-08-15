import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, Users, MessageCircle, User, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

const navItems = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: Home },
  { id: 'library', path: '/library', label: 'Studies', icon: BookOpen },
  { id: 'community', path: '/community', label: 'Community', icon: Users },
  { id: 'messages', path: '/messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', path: '/profile', label: 'Profile', icon: User },
];

export default function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Add admin tab if user is admin
  const allNavItems = (user as any)?.role === 'admin' 
    ? [...navItems, { id: 'admin', path: '/admin', label: 'Admin', icon: Settings }]
    : navItems;

  return (
    <nav 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-2 z-50"
      data-testid="navigation-bottom"
    >
      <div className={`flex justify-around items-center ${allNavItems.length === 5 ? 'space-x-1' : ''}`}>
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || 
                          (item.path === '/' && location === '/') ||
                          (item.path !== '/' && location.startsWith(item.path));
          
          return (
            <Link key={item.id} href={item.path}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center p-2 min-w-0 ${
                  isActive 
                    ? 'text-ministry-navy' 
                    : 'text-ministry-slate hover:text-ministry-navy'
                } ${allNavItems.length === 5 ? 'px-1' : 'px-2'}`}
                data-testid={`nav-${item.id}`}
              >
                <Icon className={`w-6 h-6 mb-1 ${allNavItems.length === 5 ? 'w-5 h-5' : ''}`} />
                <span className={`font-medium ${allNavItems.length === 5 ? 'text-xs' : 'text-xs'}`}>
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
