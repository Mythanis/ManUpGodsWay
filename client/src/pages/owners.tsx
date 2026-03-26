import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Crown, Users, Database, Shield, Activity, Trash2, UserCog, CreditCard, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/BackButton";

// ─── Stripe Configuration ─────────────────────────────────────────────────────

function StripeConfiguration() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: stripeInfo, isLoading: stripeLoading, refetch: refetchStripeInfo } = useQuery({
    queryKey: ['/api/stripe/status'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Stripe status');
      return res.json();
    },
    refetchInterval: false,
  });

  const saveKeysMutation = useMutation({
    mutationFn: async (keys: { publishableKey: string; secretKey: string }) => {
      setIsSaving(true);
      const res = await fetch('/api/stripe/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(keys),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuration Saved", description: "Stripe keys saved successfully." });
      setPublishableKey('');
      setSecretKey('');
      refetchStripeInfo();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    onSettled: () => setIsSaving(false),
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
      refetchStripeInfo();
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

  const handleSave = () => {
    if (!publishableKey.startsWith('pk_')) {
      toast({ title: "Invalid Key", description: "Publishable key must start with pk_", variant: "destructive" });
      return;
    }
    if (!secretKey.startsWith('sk_')) {
      toast({ title: "Invalid Key", description: "Secret key must start with sk_", variant: "destructive" });
      return;
    }
    saveKeysMutation.mutate({ publishableKey, secretKey });
  };

  if (stripeLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]" />
      </div>
    );
  }

  return (
    <div className="px-6 space-y-4">
      {/* Status */}
      <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
        <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
          <p className="text-black font-black text-xs uppercase tracking-widest">Connection Status</p>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            {stripeInfo?.connected && (
              <p className="text-green-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Connected to Stripe
              </p>
            )}
            {stripeInfo?.configured && !stripeInfo?.connected && (
              <p className="text-yellow-400 text-sm">Establishing connection...</p>
            )}
            {!stripeInfo?.configured && (
              <p className="text-white/60 text-sm">Not configured</p>
            )}
            {stripeInfo?.accountId && (
              <p className="text-white/50 text-xs mt-1">Account: {stripeInfo.accountId}</p>
            )}
          </div>
          <Badge className={
            stripeInfo?.connected ? "bg-green-600 text-white" :
            stripeInfo?.configured ? "bg-yellow-600 text-white" : "bg-red-700 text-white"
          }>
            {stripeInfo?.connected ? "Live" : stripeInfo?.configured ? "Connecting" : "Not Set"}
          </Badge>
        </div>
      </div>

      {/* Keys / Test Connection */}
      {!stripeInfo?.configured ? (
        <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
          <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
            <p className="text-black font-black text-xs uppercase tracking-widest">Stripe API Keys</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs uppercase tracking-wide">Publishable Key</Label>
              <Input
                placeholder="pk_live_... or pk_test_..."
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                className="bg-black border-2 border-white/20 text-white rounded-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs uppercase tracking-wide">Secret Key</Label>
              <Input
                type="password"
                placeholder="sk_live_... or sk_test_..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="bg-black border-2 border-white/20 text-white rounded-sm"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !publishableKey || !secretKey}
              className="w-full bg-[#FCD000] text-black font-black text-xs uppercase tracking-widest rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
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
        </div>
      ) : (
        <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
          <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
            <p className="text-black font-black text-xs uppercase tracking-widest">Connection Management</p>
          </div>
          <div className="p-4 flex items-center justify-between">
            <p className="text-white/60 text-sm">Test that payment processing is working.</p>
            <Button
              onClick={() => testConnectionMutation.mutate()}
              disabled={isTestingConnection}
              size="sm"
              className="bg-[#FCD000] text-black font-black text-xs uppercase rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {isTestingConnection ? "Testing..." : "Test"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const ownerTabs = [
  { id: "overview", label: "Overview",  icon: Activity },
  { id: "users",    label: "Users",     icon: Users },
  { id: "security", label: "Security",  icon: Shield },
  { id: "stripe",   label: "Stripe",    icon: CreditCard },
  { id: "system",   label: "System",    icon: Database },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Owners() {
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [userSearch, setUserSearch] = useState("");

  // Horizontal wheel scroll on the tab strip
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => { e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Role updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update role", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: "User deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete user", variant: "destructive" }),
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => { queryClient.clear(); return { success: true }; },
    onSuccess: () => toast({ title: "Cache cleared" }),
  });

  const filteredUsers = (users as any[]).filter((u: any) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const statCard = (value: any, label: string, gold = false) => (
    <div className={`border-2 border-black rounded-sm p-4 text-center ${gold ? 'bg-[#FCD000]' : 'bg-black'}`}
      style={{ boxShadow: gold ? '4px 4px 0px 0px rgba(0,0,0,1)' : '4px 4px 0px 0px rgba(252,208,0,1)' }}>
      <p className={`text-3xl font-black ${gold ? 'text-black' : 'text-[#FCD000]'}`}>{value ?? 0}</p>
      <p className={`text-xs font-bold uppercase tracking-wide ${gold ? 'text-black' : 'text-white'}`}>{label}</p>
    </div>
  );

  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return (
          <div className="px-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {statCard((stats as any).totalUsers, "Total Users", true)}
              {statCard((stats as any).activeToday, "Active Today")}
              {statCard((stats as any).totalStudies, "Studies")}
              {statCard((stats as any).totalVideos, "Videos", true)}
            </div>

            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.4)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">Role Breakdown</p>
              </div>
              <div className="divide-y divide-white/10">
                {[
                  { label: "Owners",    value: (users as any[]).filter((u: any) => u.role === 'owner').length,     color: "text-purple-400" },
                  { label: "Admins",    value: (users as any[]).filter((u: any) => u.role === 'admin').length,     color: "text-blue-400" },
                  { label: "Moderators",value: (users as any[]).filter((u: any) => u.role === 'moderator').length, color: "text-green-400" },
                  { label: "Members",   value: (users as any[]).filter((u: any) => u.role === 'user').length,      color: "text-white" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/60 text-sm">{row.label}</span>
                    <span className={`font-black text-sm ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">System Status</p>
              </div>
              <div className="divide-y divide-white/10">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Server</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Online</Badge>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Database</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Connected</Badge>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Published Studies</span>
                  <span className="text-[#FCD000] font-black text-sm">{(stats as any).publishedStudies ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="px-6 space-y-4">
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="bg-black border-2 border-white/20 text-white rounded-sm"
            />

            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">
                  All Users ({filteredUsers.length})
                </p>
              </div>

              <div className="divide-y divide-white/10 max-h-[60vh] overflow-y-auto">
                {filteredUsers.length === 0 && (
                  <p className="text-white/40 text-sm text-center py-8">No users found</p>
                )}
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-white/40 text-xs truncate">{u.email}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={
                        u.role === 'owner'     ? 'bg-purple-700 text-white text-[10px] font-black uppercase' :
                        u.role === 'admin'     ? 'bg-blue-700 text-white text-[10px] font-black uppercase' :
                        u.role === 'moderator' ? 'bg-green-700 text-white text-[10px] font-black uppercase' :
                        'bg-white/10 text-white/60 text-[10px] font-black uppercase'
                      }>
                        {u.role}
                      </Badge>

                      {u.isBanned && (
                        <Badge className="bg-red-700 text-white text-[10px] font-black uppercase">Banned</Badge>
                      )}

                      {u.role !== 'owner' && (
                        <select
                          value={u.role}
                          onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                          className="bg-black border border-white/20 text-white text-xs rounded-sm px-1.5 py-1"
                        >
                          <option value="user">User</option>
                          <option value="moderator">Mod</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                      )}

                      {u.role !== 'owner' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-700 text-red-400 hover:bg-red-700 hover:text-white rounded-sm h-7 w-7 p-0"
                            >
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
                              <AlertDialogAction
                                className="bg-red-700 text-white hover:bg-red-800"
                                onClick={() => deleteUserMutation.mutate(u.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="px-6 space-y-4">
            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">Role Distribution</p>
              </div>
              <div className="divide-y divide-white/10">
                {[
                  { label: "Owners",     value: (users as any[]).filter((u: any) => u.role === 'owner').length,     cls: "bg-purple-700" },
                  { label: "Admins",     value: (users as any[]).filter((u: any) => u.role === 'admin').length,     cls: "bg-blue-700" },
                  { label: "Moderators", value: (users as any[]).filter((u: any) => u.role === 'moderator').length, cls: "bg-green-700" },
                  { label: "Members",    value: (users as any[]).filter((u: any) => u.role === 'user').length,      cls: "bg-white/10" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/60 text-sm">{row.label}</span>
                    <Badge className={`${row.cls} text-white text-[10px] font-black uppercase`}>{row.value}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">Account Flags</p>
              </div>
              <div className="divide-y divide-white/10">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Banned Accounts</span>
                  <Badge className="bg-red-700 text-white text-[10px] font-black uppercase">
                    {(users as any[]).filter((u: any) => u.isBanned).length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Authentication</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Active</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case "stripe":
        return <StripeConfiguration />;

      case "system":
        return (
          <div className="px-6 space-y-4">
            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">System Actions</p>
              </div>
              <div className="p-4 space-y-3">
                <Button
                  onClick={() => clearCacheMutation.mutate()}
                  disabled={clearCacheMutation.isPending}
                  className="w-full bg-black text-[#FCD000] font-black text-xs uppercase tracking-widest border-2 border-[#FCD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.4)] hover:shadow-[1px_1px_0px_0px_rgba(252,208,0,0.4)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {clearCacheMutation.isPending ? "Clearing..." : "Clear Query Cache"}
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full bg-[#FCD000] text-black font-black text-xs uppercase tracking-widest border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Force Reload Interface
                </Button>
              </div>
            </div>

            <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ background: "#111" }}>
              <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FCD000" }}>
                <p className="text-black font-black text-xs uppercase tracking-widest">System Status</p>
              </div>
              <div className="divide-y divide-white/10">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Server</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Online</Badge>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Database</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Connected</Badge>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/60 text-sm">Query Cache</span>
                  <Badge className="bg-green-600 text-white text-[10px] font-black uppercase">Active</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  if (usersLoading || statsLoading) {
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
        <BackButton />
        <div className="flex items-center gap-3 mt-2">
          <Crown className="h-7 w-7 text-[#FCD000]" />
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              Owner <span className="text-[#FCD000]">Panel</span>
            </h1>
            <p className="text-[#FCD000] text-sm font-bold uppercase tracking-wide">
              System Administration
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="px-6 py-4">
        <div
          ref={scrollContainerRef}
          className="flex space-x-3 overflow-x-auto scrollbar-hide pb-1"
        >
          {ownerTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-14 min-w-[130px] flex items-center border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px transition-all flex-shrink-0 cursor-pointer ${
                  active ? 'liquid-black border-[#FCD000] shadow-[3px_3px_0px_0px_rgba(252,208,0,1)]' : 'bg-[#FCD000] text-black'
                }`}
              >
                <div className={`h-full w-12 flex items-center justify-center flex-shrink-0 ${active ? 'bg-[#FCD000]' : 'liquid-black'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : 'text-white'}`} />
                </div>
                <span className={`flex-1 font-black text-xs text-left px-2 uppercase tracking-wide ${active ? 'text-[#FCD000]' : 'text-black'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {renderTabContent()}
      </div>
    </div>
  );
}
