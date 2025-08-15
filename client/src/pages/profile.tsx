import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NotificationPanel } from "@/components/notification-panel";
import { 
  User, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut,
  Settings,
  Crown,
  Flame
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  const { data: progress = [] } = useQuery({
    queryKey: ["/api/progress"],
    retry: false,
  });

  const completedStudies = progress.filter((p: any) => p.isCompleted);
  const currentStudies = progress.filter((p: any) => !p.isCompleted);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-ministry-steel/20 text-ministry-steel">Premium Member</Badge>;
      case 'vip':
        return <Badge className="bg-ministry-gold/20 text-ministry-gold">VIP Member</Badge>;
      default:
        return <Badge variant="outline">Free Member</Badge>;
    }
  };

  const getStreakBadge = (days: number) => {
    if (days >= 30) {
      return <Badge className="bg-ministry-success/20 text-ministry-success">{days}-Day Streak</Badge>;
    }
    return <Badge variant="outline">{days}-Day Streak</Badge>;
  };

  return (
    <div className="pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-8">
        <div className="text-center">
          <img 
            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4A90B8&color=fff`}
            alt="Profile"
            className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/20 object-cover"
            data-testid="img-profile"
          />
          <h1 className="text-xl font-bold mb-1" data-testid="text-user-name">
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-blue-200 text-sm mb-4" data-testid="text-member-since">
            Member since {new Date(user?.createdAt || '').toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-completed-count">
                {completedStudies.length}
              </p>
              <p className="text-xs text-blue-200">Studies Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-streak-days">
                {user?.streakDays || 0}
              </p>
              <p className="text-xs text-blue-200">Days Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-forum-posts">
                0
              </p>
              <p className="text-xs text-blue-200">Forum Posts</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-2">
            {getTierBadge(user?.subscriptionTier || 'free')}
            {getStreakBadge(user?.streakDays || 0)}
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="px-6 -mt-6 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-account">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Account & Subscription</h2>
            
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${
                user?.subscriptionTier === 'free' 
                  ? 'bg-ministry-gold/10 border-ministry-gold/20' 
                  : 'bg-ministry-steel/10 border-ministry-steel/20'
              }`}>
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-ministry-gold" />
                  <div>
                    <h3 className="font-semibold text-ministry-charcoal">
                      {user?.subscriptionTier === 'free' ? 'Free Plan' : 
                       user?.subscriptionTier === 'premium' ? 'Premium Plan' : 'VIP Plan'}
                    </h3>
                    <p className="text-sm text-ministry-slate">
                      {user?.subscriptionTier === 'free' 
                        ? 'Limited access to studies and features'
                        : 'Full access to all studies and community features'
                      }
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost"
                  className="text-ministry-steel font-medium text-sm hover:text-ministry-navy"
                  data-testid="button-manage-subscription"
                >
                  {user?.subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                </Button>
              </div>
              
              <Button 
                variant="outline"
                className="w-full justify-between p-4 h-auto border-gray-100 hover:bg-gray-50"
                data-testid="button-edit-profile"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-ministry-steel/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-ministry-steel" />
                  </div>
                  <span className="font-medium text-ministry-charcoal">Edit Profile</span>
                </div>
                <svg className="w-5 h-5 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Menu */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Settings</h2>
        
        <Card className="border-gray-100 overflow-hidden" data-testid="card-settings">
          <CardContent className="p-0">
            <NotificationPanel variant="button" />
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-50 border-b border-gray-100"
              data-testid="button-privacy"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-steel/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-ministry-steel" />
                </div>
                <span className="font-medium text-ministry-charcoal">Privacy & Security</span>
              </div>
              <svg className="w-5 h-5 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-50 border-b border-gray-100"
              data-testid="button-help"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-gold/20 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-ministry-gold" />
                </div>
                <span className="font-medium text-ministry-charcoal">Help & Support</span>
              </div>
              <svg className="w-5 h-5 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <Button 
              variant="ghost"
              onClick={() => window.location.href = '/api/logout'}
              className="w-full justify-between p-4 h-auto hover:bg-gray-50"
              data-testid="button-logout"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium text-red-600">Sign Out</span>
              </div>
              <svg className="w-5 h-5 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress Summary */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Your Journey</h2>
        
        <Card className="border-gray-100" data-testid="card-progress">
          <CardContent className="p-6">
            {currentStudies.length === 0 && completedStudies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ministry-slate mb-4">You haven't started any studies yet</p>
                <Button 
                  className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                  data-testid="button-start-journey"
                >
                  Start Your Journey
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {currentStudies.map((item: any) => {
                  const progressPercent = (item.completedLessons / (item.study?.lessonCount || 1)) * 100;
                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ministry-charcoal">
                          {item.study?.title || 'Study'}
                        </span>
                        <span className="text-sm text-ministry-steel font-bold">
                          {item.completedLessons}/{item.study?.lessonCount || 0}
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  );
                })}
                
                {completedStudies.map((item: any) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ministry-charcoal">
                        {item.study?.title || 'Study'}
                      </span>
                      <span className="text-sm text-ministry-success font-bold flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                        </svg>
                        Complete
                      </span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
