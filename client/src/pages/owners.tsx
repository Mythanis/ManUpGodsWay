import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Crown, Users, Database, Shield, Activity, Trash2, CreditCard,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, BookOpen, Video,
  Newspaper, Swords, Calendar, Mic, Book, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'landing' | 'overview' | 'users' | 'security' | 'stripe' | 'system';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-[#FCD000]">
      <button
        onClick={onBack}
        className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4 flex items-center justify-center"
      >
        <ArrowLeft className="h-5 w-5 text-[#FCD000]" />
      </button>
      <h1 className="text-4xl font-black tracking-tighter uppercase">
        {title.split(' ')[0]} <span className="text-[#FCD000]">{title.split(' ').slice(1).join(' ')}</span>
      </h1>
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 last:border-0">
      <div>
        <p className="text-white text-sm font-semibold">{label}</p>
        {sub && <p className="text-white/40 text-xs mt-0.5">{sub}</p>}
      </div>
      <span className="text-[#FCD000] font-black text-lg">{value ?? 0}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.4)]" style={{ background: "#111" }}>
      <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
        <p className="text-black font-black text-xs uppercase tracking-widest">{title}</p>
      </div>
      {children}
    </div>
  );
}

function ServiceBadge({ status }: { status: 'ok' | 'degraded' | 'error' }) {
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-green-400 text-xs font-bold uppercase">
      <CheckCircle2 className="w-3.5 h-3.5" /> OK
    </span>
  );
  if (status === 'degraded') return (
    <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold uppercase">
      <AlertCircle className="w-3.5 h-3.5" /> Degraded
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase">
      <XCircle className="w-3.5 h-3.5" /> Error
    </span>
  );
}

// ─── Stripe sub-page ──────────────────────────────────────────────────────────

function StripePage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: stripeInfo, isLoading, refetch } = useQuery({
    queryKey: ['/api/stripe/status'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Stripe status');
      return res.json();
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      setIsTestingConnection(true);
      const res = await fetch('/api/stripe/test-connection', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Connected", description: `Stripe account: ${data.accountId}` });
      setConnectionRetries(0);
      refetch();
    },
    onError: (e: any) => {
      const retries = connectionRetries + 1;
      setConnectionRetries(retries);
      if (retries < 3) {
        toast({ title: `Retrying (${retries}/3)`, description: e.message, variant: "destructive" });
        setTimeout(() => testConnectionMutation.mutate(), 3000);
      } else {
        toast({ title: "Connection Failed", description: e.message, variant: "destructive" });
      }
    },
    onSettled: () => setIsTestingConnection(false),
  });

  useEffect(() => {
    if (stripeInfo?.configured && !stripeInfo?.connected && !isRetrying) {
      setIsRetrying(true);
      const t = setTimeout(() => { testConnectionMutation.mutate(); setIsRetrying(false); }, 2000);
      return () => clearTimeout(t);
    }
  }, [stripeInfo]);

  const handleSave = async () => {
    if (!publishableKey.startsWith('pk_')) {
      toast({ title: "Invalid Key", description: "Publishable key must start with pk_", variant: "destructive" }); return;
    }
    if (!secretKey.startsWith('sk_')) {
      toast({ title: "Invalid Key", description: "Secret key must start with sk_", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/stripe/configure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ publishableKey, secretKey }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Configuration Saved" });
      setPublishableKey(''); setSecretKey(''); refetch();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="Stripe Configuration" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]" />
          </div>
        ) : (
          <>
            <SectionCard title="Connection Status">
              <div className="p-4 flex items-center justify-between">
                <div>
                  {stripeInfo?.connected && <p className="text-green-400 text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Connected to Stripe</p>}
                  {stripeInfo?.configured && !stripeInfo?.connected && <p className="text-yellow-400 text-sm">Establishing connection...</p>}
                  {!stripeInfo?.configured && <p className="text-white/60 text-sm">Not configured</p>}
                  {stripeInfo?.accountId && <p className="text-white/50 text-xs mt-1">Account: {stripeInfo.accountId}</p>}
                </div>
                <Badge className={stripeInfo?.connected ? "bg-green-600 text-white" : stripeInfo?.configured ? "bg-yellow-600 text-white" : "bg-red-700 text-white"}>
                  {stripeInfo?.connected ? "Live" : stripeInfo?.configured ? "Connecting" : "Not Set"}
                </Badge>
              </div>
            </SectionCard>

            {!stripeInfo?.configured ? (
              <SectionCard title="Stripe API Keys">
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs uppercase tracking-wide">Publishable Key</Label>
                    <Input placeholder="pk_live_... or pk_test_..." value={publishableKey}
                      onChange={(e) => setPublishableKey(e.target.value)}
                      className="bg-black border-2 border-white/20 text-white rounded-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs uppercase tracking-wide">Secret Key</Label>
                    <Input type="password" placeholder="sk_live_... or sk_test_..." value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="bg-black border-2 border-white/20 text-white rounded-sm" />
                  </div>
                  <Button onClick={handleSave} disabled={isSaving || !publishableKey || !secretKey}
                    className="w-full bg-[#FCD000] text-black font-black text-xs uppercase tracking-widest rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    {isSaving ? "Saving..." : "Save Configuration"}
                  </Button>
                  <div className="p-3 bg-blue-950/40 border border-blue-700/50 rounded-sm">
                    <p className="text-blue-300 text-xs font-bold uppercase tracking-wide mb-2">Setup</p>
                    <ol className="text-blue-200/80 text-xs space-y-1 list-decimal list-inside">
                      <li>Go to your <a href="https://dashboard.stripe.com/apikeys" target="_blank" className="text-blue-400 underline">Stripe Dashboard</a></li>
                      <li>Copy your Publishable key (starts with pk_)</li>
                      <li>Copy your Secret key (starts with sk_)</li>
                      <li>Paste both keys above and click Save</li>
                    </ol>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <SectionCard title="Connection Management">
                <div className="p-4 flex items-center justify-between">
                  <p className="text-white/60 text-sm">Test that payment processing is working.</p>
                  <Button onClick={() => testConnectionMutation.mutate()} disabled={isTestingConnection} size="sm"
                    className="bg-[#FCD000] text-black font-black text-xs uppercase rounded-sm border-2 border-black">
                    {isTestingConnection ? "Testing..." : "Test"}
                  </Button>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Overview sub-page ────────────────────────────────────────────────────────

function OverviewPage({ onBack, users, stats, contentStats }: { onBack: () => void; users: any[]; stats: any; contentStats: any }) {
  const periodLabel = contentStats?.periodStart
    ? `Since ${new Date(contentStats.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'This billing period';

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="Platform Overview" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        <SectionCard title="Platform">
          <StatRow label="Total Members" value={stats?.totalUsers} />
          <StatRow label="Active Today" value={stats?.activeToday} />
          <StatRow label="New Posts Today" value={stats?.newPosts} />
          <StatRow label="Active Subscribers" value={stats?.activeSubscribers} />
        </SectionCard>

        <SectionCard title="Content">
          <div className="divide-y divide-white/10">
            {[
              { icon: BookOpen, label: "Studies (Published)", value: contentStats?.publishedStudies },
              { icon: Video,    label: "Videos",               value: contentStats?.videos },
              { icon: Newspaper,label: "Blog Posts",           value: contentStats?.blogPosts },
              { icon: Swords,   label: "Challenges",           value: contentStats?.challenges },
              { icon: Calendar, label: "Events",               value: contentStats?.events },
              { icon: Users,    label: "War Room Posts",       value: contentStats?.warRoomPosts },
              { icon: Mic,      label: "Podcasts",             value: contentStats?.podcasts },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <row.icon className="w-4 h-4 text-white/40" />
                  <p className="text-white text-sm">{row.label}</p>
                </div>
                <span className="text-[#FCD000] font-black text-lg">{row.value ?? 0}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Book className="w-4 h-4 text-white/40" />
                <div>
                  <p className="text-white text-sm">Bible API Calls</p>
                  <p className="text-white/40 text-xs">{periodLabel}</p>
                </div>
              </div>
              <span className="text-[#FCD000] font-black text-lg">{contentStats?.bibleApiCallsThisPeriod ?? 0}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Roles">
          <StatRow label="Owners"     value={users.filter(u => u.role === 'owner').length} />
          <StatRow label="Admins"     value={users.filter(u => u.role === 'admin').length} />
          <StatRow label="Moderators" value={users.filter(u => u.role === 'moderator').length} />
          <StatRow label="Members"    value={users.filter(u => u.role === 'user').length} />
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Users sub-page ───────────────────────────────────────────────────────────

function UsersPage({ onBack, users }: { onBack: () => void; users: any[] }) {
  const { toast } = useToast();
  const [userSearch, setUserSearch] = useState('');

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }); toast({ title: "Role updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update role", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => { await apiRequest('DELETE', `/api/admin/users/${userId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: "User deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete user", variant: "destructive" }),
  });

  const filtered = users.filter((u: any) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="User Management" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        <Input placeholder="Search by name or email..."
          value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
          className="bg-black border-2 border-white/20 text-white rounded-sm" />

        <SectionCard title={`All Users (${filtered.length})`}>
          <div className="divide-y divide-white/10 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 && <p className="text-white/40 text-sm text-center py-8">No users found</p>}
            {filtered.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-white/40 text-xs truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={
                    u.role === 'owner'     ? 'bg-purple-700 text-white text-[10px] font-black uppercase' :
                    u.role === 'admin'     ? 'bg-blue-700 text-white text-[10px] font-black uppercase' :
                    u.role === 'moderator' ? 'bg-green-700 text-white text-[10px] font-black uppercase' :
                    'bg-white/10 text-white/60 text-[10px] font-black uppercase'
                  }>{u.role}</Badge>
                  {u.isBanned && <Badge className="bg-red-700 text-white text-[10px] font-black uppercase">Banned</Badge>}
                  {u.role !== 'owner' && (
                    <select value={u.role}
                      onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                      className="bg-black border border-white/20 text-white text-xs rounded-sm px-1.5 py-1">
                      <option value="user">User</option>
                      <option value="moderator">Mod</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  )}
                  {u.role !== 'owner' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"
                          className="border-red-700 text-red-400 hover:bg-red-700 hover:text-white rounded-sm h-7 w-7 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#111] border-2 border-black">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
                          <AlertDialogDescription className="text-white/50">
                            Permanently delete {u.firstName} {u.lastName}? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/10 text-white border-0">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-700 text-white hover:bg-red-800"
                            onClick={() => deleteUserMutation.mutate(u.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Security sub-page ────────────────────────────────────────────────────────

function SecurityPage({ onBack, users }: { onBack: () => void; users: any[] }) {
  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="Security Overview" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        <SectionCard title="Role Distribution">
          <StatRow label="Owners"     value={users.filter(u => u.role === 'owner').length} />
          <StatRow label="Admins"     value={users.filter(u => u.role === 'admin').length} />
          <StatRow label="Moderators" value={users.filter(u => u.role === 'moderator').length} />
          <StatRow label="Members"    value={users.filter(u => u.role === 'user').length} />
        </SectionCard>
        <SectionCard title="Account Flags">
          <StatRow label="Banned Accounts" value={users.filter(u => u.isBanned).length} />
          <div className="flex items-center justify-between px-4 py-3.5">
            <p className="text-white text-sm font-semibold">Authentication</p>
            <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Active</Badge>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── System sub-page ──────────────────────────────────────────────────────────

function SystemPage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/owner/system-health', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      setHealthData(await res.json());
    } catch {
      toast({ title: "Health check failed", variant: "destructive" });
    } finally { setHealthLoading(false); }
  };

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="System Status" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        {/* External Connections */}
        <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
          <div className="px-4 py-2.5 border-b-2 border-black flex items-center justify-between" style={{ background: "#FCD000" }}>
            <p className="text-black font-black text-xs uppercase tracking-widest">External Connections</p>
            <button onClick={runHealthCheck} disabled={healthLoading}
              className="flex items-center gap-1 text-black text-[10px] font-black uppercase">
              <RefreshCw className={`w-3 h-3 ${healthLoading ? 'animate-spin' : ''}`} />
              {healthLoading ? 'Checking...' : 'Check Now'}
            </button>
          </div>
          {!healthData && !healthLoading && (
            <div className="px-4 py-6 text-center">
              <p className="text-white/40 text-sm">Press "Check Now" to test all external connections.</p>
            </div>
          )}
          {healthLoading && (
            <div className="px-4 py-6 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FCD000]" />
              <p className="text-white/60 text-sm">Checking connections...</p>
            </div>
          )}
          {healthData && !healthLoading && (
            <div className="divide-y divide-white/10">
              {Object.values(healthData.services as Record<string, any>).map((svc: any) => (
                <div key={svc.name} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-white text-sm">{svc.name}</p>
                    {svc.detail && <p className="text-white/40 text-xs mt-0.5">{svc.detail}</p>}
                  </div>
                  <ServiceBadge status={svc.status} />
                </div>
              ))}
              <div className="px-4 py-2.5 text-center">
                <p className="text-white/30 text-[10px]">Checked {new Date(healthData.checkedAt).toLocaleTimeString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* System Actions */}
        <SectionCard title="System Actions">
          <div className="p-4 space-y-3">
            <Button onClick={() => { queryClient.clear(); toast({ title: "Cache cleared" }); }}
              className="w-full bg-black text-[#FCD000] font-black text-xs uppercase tracking-widest border-2 border-[#FCD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.4)]">
              <Trash2 className="w-4 h-4 mr-2" /> Clear Query Cache
            </Button>
            <Button onClick={() => window.location.reload()}
              className="w-full bg-[#FCD000] text-black font-black text-xs uppercase tracking-widest border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              Force Reload Interface
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Nav card definitions ─────────────────────────────────────────────────────

const navCards = [
  { id: 'overview' as View, label: 'Overview',      icon: Activity,   sub: 'Platform stats & content' },
  { id: 'users'    as View, label: 'Users',          icon: Users,      sub: 'Manage members & roles' },
  { id: 'security' as View, label: 'Security',       icon: Shield,     sub: 'Roles & account flags' },
  { id: 'stripe'   as View, label: 'Stripe',         icon: CreditCard, sub: 'Payment configuration' },
  { id: 'system'   as View, label: 'System Status',  icon: Database,   sub: 'Connections & actions' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Owners() {
  const [view, setView] = useState<View>('landing');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: stats = {} } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: contentStats } = useQuery({
    queryKey: ['/api/owner/content-stats'],
    queryFn: async () => {
      const res = await fetch('/api/owner/content-stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // ── Sub-page routing ────────────────────────────────────────────────────────
  if (view === 'overview') return <OverviewPage onBack={() => setView('landing')} users={users as any[]} stats={stats} contentStats={contentStats} />;
  if (view === 'users')    return <UsersPage    onBack={() => setView('landing')} users={users as any[]} />;
  if (view === 'security') return <SecurityPage onBack={() => setView('landing')} users={users as any[]} />;
  if (view === 'stripe')   return <StripePage   onBack={() => setView('landing')} />;
  if (view === 'system')   return <SystemPage   onBack={() => setView('landing')} />;

  // ── Landing page ────────────────────────────────────────────────────────────
  if (usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FCD000]" />
      </div>
    );
  }

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-[#FCD000]">
        <button
          onClick={() => window.history.back()}
          className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4 flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 text-[#FCD000]" />
        </button>
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-[#FCD000]" />
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              Owner <span className="text-[#FCD000]">Panel</span>
            </h1>
            <p className="text-[#FCD000] text-sm font-bold uppercase tracking-wide">System Administration</p>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#FCD000] border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black">{(stats as any).totalUsers ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Total Members</p>
          </div>
          <div className="bg-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-[#FCD000]">{(stats as any).activeToday ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Active Today</p>
          </div>
          <div className="bg-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-[#FCD000]">{(stats as any).activeSubscribers ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Subscribers</p>
          </div>
          <div className="bg-[#FCD000] border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black">{contentStats?.publishedStudies ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Studies Live</p>
          </div>
        </div>
      </div>

      {/* Nav cards — exactly like admin */}
      <div className="px-6 mb-6">
        <div className="space-y-2">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => setView(card.id)}
                className="h-16 w-full flex items-center justify-between bg-[#FCD000] border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.6)] hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.8)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer glow-gold"
              >
                <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-white relative z-10" />
                </div>
                <div className="flex-1 text-left px-4">
                  <p className="font-black text-sm uppercase tracking-wide text-black">{card.label}</p>
                  <p className="text-black/60 text-xs">{card.sub}</p>
                </div>
                <div className="pr-4">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
