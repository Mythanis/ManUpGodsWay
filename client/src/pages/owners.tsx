import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Crown, Users, Database, Activity, Trash2, CreditCard,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, BookOpen, Video,
  Newspaper, Swords, Calendar, Mic, Book, ArrowLeft, FlaskConical,
  Ban, Loader2, DollarSign, Repeat, Lock, Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'landing' | 'overview' | 'stripe' | 'system';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-[#FDD000]">
      <button
        onClick={onBack}
        className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4 flex items-center justify-center"
      >
        <ArrowLeft className="h-5 w-5 text-[#FDD000]" />
      </button>
      <h1 className="text-4xl font-black tracking-tighter uppercase">
        {title.split(' ')[0]} <span className="text-[#FDD000]">{title.split(' ').slice(1).join(' ')}</span>
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
      <span className="text-[#FDD000] font-black text-lg">{value ?? 0}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(253,208,0,0.4)]" style={{ background: "#111" }}>
      <div className="px-4 py-2.5 border-b-2 border-black" style={{ background: "#FDD000" }}>
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

// ─── Stripe checkout form (embedded inside Elements provider) ─────────────────

interface PendingSubInfo {
  subscriptionId: string;
  customerId: string;
  amount: number;
  interval: string;
  intervalCount: number;
}

function TestSubCheckoutForm({ pendingInfo, onSuccess, onCancel }: {
  pendingInfo: PendingSubInfo;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    setIsConfirming(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error) {
        toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        return;
      }
      if (paymentIntent?.status === 'succeeded') {
        // Save the subscription to DB
        await apiRequest('POST', '/api/owner/stripe/test-subscription/save', pendingInfo);
        toast({ title: "Test Subscription Active!", description: "Stripe is charging on the configured schedule." });
        queryClient.invalidateQueries({ queryKey: ['/api/owner/stripe/test-subscription'] });
        onSuccess();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Payment confirmation failed", variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  const intervalLabel = (interval: string, count: number) => {
    const labels: Record<string, string> = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return count > 1 ? `${count} ${labels[interval] || interval}s` : labels[interval] || interval;
  };

  return (
    <div className="space-y-5">
      <div className="p-3 bg-white/5 border border-white/10 rounded-sm text-center">
        <p className="text-white/50 text-xs uppercase tracking-wide font-bold">Charging</p>
        <p className="text-[#FDD000] text-2xl font-black mt-1">${(pendingInfo.amount / 100).toFixed(2)}</p>
        <p className="text-white/50 text-xs mt-0.5">every {intervalLabel(pendingInfo.interval, pendingInfo.intervalCount)}</p>
        <p className="text-green-400 text-xs mt-2 font-semibold">⚡ Test mode — no real money charged</p>
        <p className="text-white/30 text-xs mt-1">Use test card: 4242 4242 4242 4242</p>
      </div>
      <PaymentElement options={{ layout: 'tabs' }} />
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" className="flex-1 border-white/20 text-white/60 rounded-sm text-xs font-bold" disabled={isConfirming}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={isConfirming || !stripe || !elements}
          className="flex-1 bg-[#FDD000] text-black font-black text-xs uppercase rounded-sm border-2 border-black">
          {isConfirming ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Processing...</> : <><Lock className="w-3 h-3 mr-1" /> Confirm Payment</>}
        </Button>
      </div>
    </div>
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

  // Test subscription form state
  const [testAmount, setTestAmount] = useState('4.99');
  const [testInterval, setTestInterval] = useState('month');
  const [testIntervalCount, setTestIntervalCount] = useState('1');

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [pendingSubInfo, setPendingSubInfo] = useState<PendingSubInfo | null>(null);
  const [stripeTestPromise, setStripeTestPromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  const { data: stripeInfo, isLoading, refetch } = useQuery({
    queryKey: ['/api/stripe/status'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Stripe status');
      return res.json();
    },
  });

  const { data: testSub, isLoading: testSubLoading, refetch: refetchTestSub } = useQuery({
    queryKey: ['/api/owner/stripe/test-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/owner/stripe/test-subscription', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch test subscription');
      return res.json();
    },
    refetchInterval: (data: any) => (data && data?.status === 'active') ? 30000 : false,
  });

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(testAmount) * 100);
      return await apiRequest('POST', '/api/owner/stripe/test-subscription/create-intent', {
        amount: amountCents,
        interval: testInterval,
        intervalCount: parseInt(testIntervalCount) || 1,
      });
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
      setPendingSubInfo({
        subscriptionId: data.subscriptionId,
        customerId: data.customerId,
        amount: data.amount,
        interval: data.interval,
        intervalCount: data.intervalCount,
      });
      const pubKey = data.testPublicKey || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
      if (pubKey) setStripeTestPromise(loadStripe(pubKey));
      setShowCheckout(true);
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message || "Could not create payment intent", variant: "destructive" });
    },
  });

  const cancelTestSubMutation = useMutation({
    mutationFn: async () => await apiRequest('DELETE', '/api/owner/stripe/test-subscription'),
    onSuccess: () => {
      toast({ title: "Subscription Canceled", description: "The test subscription has been stopped." });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/stripe/test-subscription'] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message || "Could not cancel subscription", variant: "destructive" });
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

  const intervalLabel = (interval: string, count: number) => {
    const countStr = count > 1 ? `every ${count} ` : '';
    const labels: Record<string, string> = { day: 'day(s)', week: 'week(s)', month: 'month(s)', year: 'year(s)' };
    return `${countStr}${labels[interval] || interval}`;
  };

  const paymentStatusColor = (s: string | null) => {
    if (s === 'succeeded' || s === 'paid') return 'text-green-400';
    if (s === 'failed') return 'text-red-400';
    return 'text-yellow-400';
  };

  const subStatusBadge = (s: string) => {
    if (s === 'active') return <Badge className="bg-green-600 text-white text-xs font-black rounded-sm">Active</Badge>;
    if (s === 'canceled') return <Badge className="bg-gray-600 text-white text-xs font-black rounded-sm">Canceled</Badge>;
    if (s === 'past_due') return <Badge className="bg-red-700 text-white text-xs font-black rounded-sm">Past Due</Badge>;
    if (s === 'incomplete') return <Badge className="bg-yellow-600 text-black text-xs font-black rounded-sm">Incomplete</Badge>;
    return <Badge className="bg-gray-700 text-white text-xs font-black rounded-sm">{s}</Badge>;
  };

  const isSubActive = testSub?.status === 'active';

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="Stripe Configuration" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDD000]" />
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
                    className="w-full bg-[#FDD000] text-black font-black text-xs uppercase tracking-widest rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
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
                    className="bg-[#FDD000] text-black font-black text-xs uppercase rounded-sm border-2 border-black">
                    {isTestingConnection ? "Testing..." : "Test"}
                  </Button>
                </div>
              </SectionCard>
            )}

            {/* ── Subscription Tester ── */}
            <SectionCard title="Subscription Tester">
              <div className="p-4 space-y-4">
                <p className="text-white/50 text-xs">
                  Create a live test subscription to verify that recurring billing, renewals, and webhook status updates all work correctly. Uses a Stripe test card — no real money charged.
                </p>

                {/* Current subscription status */}
                {testSubLoading ? (
                  <div className="flex items-center gap-2 text-white/40 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading status...
                  </div>
                ) : testSub && testSub.status !== 'inactive' ? (
                  <div className="border-2 border-white/10 rounded-sm overflow-hidden">
                    <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-[#FDD000]" />
                        <span className="text-white font-black text-xs uppercase tracking-wide">Current Test Subscription</span>
                      </div>
                      {subStatusBadge(testSub.status)}
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs uppercase tracking-wide font-bold">Amount</span>
                        <span className="text-[#FDD000] font-black text-sm">${(testSub.amount / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs uppercase tracking-wide font-bold">Billing</span>
                        <span className="text-white text-xs font-bold capitalize flex items-center gap-1">
                          <Repeat className="w-3 h-3 text-white/40" />
                          Every {testSub.intervalCount > 1 ? testSub.intervalCount + ' ' : ''}{testSub.interval}{testSub.intervalCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs uppercase tracking-wide font-bold">Last Payment</span>
                        <span className={`text-xs font-black uppercase ${paymentStatusColor(testSub.lastPaymentStatus)}`}>
                          {testSub.lastPaymentStatus === 'succeeded' || testSub.lastPaymentStatus === 'paid'
                            ? '✓ Succeeded'
                            : testSub.lastPaymentStatus === 'failed'
                            ? '✗ Failed'
                            : testSub.lastPaymentStatus
                            ? testSub.lastPaymentStatus
                            : '—'}
                        </span>
                      </div>
                      {testSub.lastPaymentAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/50 text-xs uppercase tracking-wide font-bold">Paid At</span>
                          <span className="text-white/60 text-xs">
                            {new Date(testSub.lastPaymentAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {testSub.stripeSubscriptionId && (
                        <div className="pt-1 border-t border-white/10">
                          <span className="text-white/30 text-xs font-mono break-all">{testSub.stripeSubscriptionId}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 pb-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refetchTestSub()}
                        className="flex-1 border-white/20 text-white/60 hover:text-white text-xs font-bold rounded-sm"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Refresh Status
                      </Button>
                      {isSubActive && (
                        <Button
                          size="sm"
                          onClick={() => cancelTestSubMutation.mutate()}
                          disabled={cancelTestSubMutation.isPending}
                          className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase rounded-sm border-2 border-black"
                        >
                          {cancelTestSubMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                          Cancel Subscription
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Create new test subscription form */}
                {(!testSub || testSub.status === 'canceled' || testSub.status === 'inactive') && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-white/60 text-xs uppercase tracking-wide font-bold">Price (USD)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                          <Input
                            type="number"
                            min="0.50"
                            step="0.01"
                            value={testAmount}
                            onChange={(e) => setTestAmount(e.target.value)}
                            className="bg-black border-2 border-white/20 text-white rounded-sm pl-7"
                            placeholder="1.00"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60 text-xs uppercase tracking-wide font-bold">Every</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={testIntervalCount}
                          onChange={(e) => setTestIntervalCount(e.target.value)}
                          className="bg-black border-2 border-white/20 text-white rounded-sm"
                          placeholder="1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs uppercase tracking-wide font-bold">Frequency</Label>
                      <Select value={testInterval} onValueChange={setTestInterval}>
                        <SelectTrigger className="bg-black border-2 border-white/20 text-white rounded-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-2 border-white/20">
                          <SelectItem value="day" className="text-white">Day</SelectItem>
                          <SelectItem value="week" className="text-white">Week</SelectItem>
                          <SelectItem value="month" className="text-white">Month</SelectItem>
                          <SelectItem value="year" className="text-white">Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-2.5 bg-white/5 rounded-sm border border-white/10">
                      <p className="text-white/50 text-xs">
                        Will charge <span className="text-[#FDD000] font-black">${parseFloat(testAmount || '0').toFixed(2)}</span> every{' '}
                        <span className="text-[#FDD000] font-black">{intervalLabel(testInterval, parseInt(testIntervalCount) || 1)}</span>
                      </p>
                    </div>
                    <Button
                      onClick={() => createIntentMutation.mutate()}
                      disabled={createIntentMutation.isPending || !testAmount || parseFloat(testAmount) < 0.50}
                      className="w-full bg-[#FDD000] text-black font-black text-xs uppercase tracking-widest rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {createIntentMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparing...</>
                        : <><CreditCard className="w-4 h-4 mr-2" /> Enter Card Details</>}
                    </Button>
                  </div>
                )}
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* Stripe Elements checkout dialog */}
      <Dialog open={showCheckout} onOpenChange={(open) => { if (!open) { setShowCheckout(false); setClientSecret(''); setPendingSubInfo(null); } }}>
        <DialogContent className="max-w-sm" style={{ background: '#111', border: '2px solid #FDD000' }}>
          <DialogHeader>
            <DialogTitle className="text-white font-black text-base uppercase tracking-wide flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#FDD000]" /> Test Subscription Payment
            </DialogTitle>
          </DialogHeader>
          {clientSecret && pendingSubInfo && stripeTestPromise ? (
            <Elements
              stripe={stripeTestPromise}
              options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#FDD000', colorBackground: '#111', borderRadius: '2px' } } }}
            >
              <TestSubCheckoutForm
                pendingInfo={pendingSubInfo}
                onSuccess={() => { setShowCheckout(false); setClientSecret(''); setPendingSubInfo(null); refetchTestSub(); }}
                onCancel={() => { setShowCheckout(false); setClientSecret(''); setPendingSubInfo(null); }}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#FDD000]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Overview sub-page ────────────────────────────────────────────────────────

function OverviewPage({ onBack, users, stats, contentStats }: { onBack: () => void; users: any[]; stats: any; contentStats: any }) {
  const periodLabel = contentStats?.periodStart
    ? `Since ${new Date(contentStats.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
    : 'This billing period';

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      <SubHeader title="Platform Overview" onBack={onBack} />
      <div className="px-6 py-6 space-y-4">
        <SectionCard title="Platform">
          <StatRow label="Total Members"           value={stats?.totalUsers} />
          <StatRow label="Active Today"             value={stats?.activeToday} />
          <StatRow label="New Posts Today"          value={stats?.newPosts} />
          <StatRow label="Active Subscribers"       value={stats?.activeSubscribers} />
          <StatRow label="Fitness Subscribers"      value={contentStats?.fitnessSubscribers} />
        </SectionCard>

        <SectionCard title="Content">
          <div className="divide-y divide-white/10">
            {[
              { icon: BookOpen,  label: "Studies (Published)", value: contentStats?.publishedStudies },
              { icon: Video,     label: "Videos",               value: contentStats?.videos },
              { icon: Newspaper, label: "Blog Posts",           value: contentStats?.blogPosts },
              { icon: Swords,    label: "Challenges",           value: contentStats?.challenges },
              { icon: Calendar,  label: "Events",               value: contentStats?.events },
              { icon: Users,     label: "War Room Posts",       value: contentStats?.warRoomPosts },
              { icon: Mic,       label: "Podcasts",             value: contentStats?.podcasts },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <row.icon className="w-4 h-4 text-white/40" />
                  <p className="text-white text-sm">{row.label}</p>
                </div>
                <span className="text-[#FDD000] font-black text-lg">{row.value ?? 0}</span>
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
              <span className="text-[#FDD000] font-black text-lg">{contentStats?.bibleApiCallsThisPeriod ?? 0}</span>
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
          <div className="px-4 py-2.5 border-b-2 border-black flex items-center justify-between" style={{ background: "#FDD000" }}>
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
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FDD000]" />
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
              className="w-full bg-black text-[#FDD000] font-black text-xs uppercase tracking-widest border-2 border-[#FDD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(253,208,0,0.4)]">
              <Trash2 className="w-4 h-4 mr-2" /> Clear Query Cache
            </Button>
            <Button onClick={() => window.location.reload()}
              className="w-full bg-[#FDD000] text-black font-black text-xs uppercase tracking-widest border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
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
  { id: 'stripe'   as View, label: 'Stripe',         icon: CreditCard, sub: 'Payment configuration' },
  { id: 'system'   as View, label: 'System Status',  icon: Database,   sub: 'Connections & actions' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Owners() {
  const [view, setView] = useState<View>('landing');
  const [showTrialConfirm, setShowTrialConfirm] = useState(false);
  const { toast } = useToast();

  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const isOwnerUser = currentUser?.role === 'owner';

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?pageSize=10000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      return data?.users ?? (Array.isArray(data) ? data : []);
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

  const { data: trialCountData, refetch: refetchTrialCount } = useQuery({
    queryKey: ['/api/owners/users/grant-trial-extension/count'],
    queryFn: async () => {
      const res = await fetch('/api/owners/users/grant-trial-extension/count', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ eligibleCount: number }>;
    },
    enabled: isOwnerUser,
  });

  const grantTrialMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/owners/users/grant-trial-extension'),
    onSuccess: (data: any) => {
      toast({
        title: 'Trial Extension Granted',
        description: `Granted ${data.trialDays}-day trial to ${data.count} member${data.count !== 1 ? 's' : ''}.`,
      });
      refetchTrialCount();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to grant trial extension.', variant: 'destructive' });
    },
  });

  // ── Sub-page routing ────────────────────────────────────────────────────────
  if (view === 'overview') return <OverviewPage onBack={() => setView('landing')} users={users as any[]} stats={stats} contentStats={contentStats} />;
  if (view === 'stripe')   return <StripePage   onBack={() => setView('landing')} />;
  if (view === 'system')   return <SystemPage   onBack={() => setView('landing')} />;

  // ── Landing page ────────────────────────────────────────────────────────────
  if (usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FDD000]" />
      </div>
    );
  }

  const eligibleCount = trialCountData?.eligibleCount ?? 0;

  return (
    <div className="pb-24 bg-ministry-light-gray min-h-screen">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-[#FDD000]">
        <button
          onClick={() => window.history.back()}
          className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4 flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 text-[#FDD000]" />
        </button>
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-[#FDD000]" />
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              Owner <span className="text-[#FDD000]">Panel</span>
            </h1>
            <p className="text-[#FDD000] text-sm font-bold uppercase tracking-wide">System Administration</p>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#FDD000] border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black">{(stats as any).totalUsers ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Total Members</p>
          </div>
          <div className="bg-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-[#FDD000]">{(stats as any).activeToday ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Active Today</p>
          </div>
          <div className="bg-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-[#FDD000]">{(stats as any).activeSubscribers ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Subscribers</p>
          </div>
          <div className="bg-[#FDD000] border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black">{contentStats?.publishedStudies ?? 0}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Studies Live</p>
          </div>
        </div>
      </div>

      {/* Trial Boost — owner-only */}
      {isOwnerUser && (
        <div className="px-6 mb-6">
          <SectionCard title="Trial Boost">
            <div className="px-4 py-4">
              <p className="text-white/70 text-sm mb-1">
                Grant a fresh 7-day trial to all expired and trial-status members.
              </p>
              <p className="text-white/40 text-xs mb-4">
                Active subscribers and cancelled-but-still-active members are never touched.
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#FDD000] font-black text-2xl">{eligibleCount}</p>
                  <p className="text-white/50 text-xs uppercase tracking-wide">Eligible members</p>
                </div>
                <Button
                  onClick={() => setShowTrialConfirm(true)}
                  disabled={grantTrialMutation.isPending || eligibleCount === 0}
                  className="bg-[#FDD000] hover:bg-[#FDD000]/90 text-black font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                >
                  {grantTrialMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Granting…</>
                  ) : (
                    <><Gift className="w-4 h-4 mr-2" /> Grant 7-Day Trial</>
                  )}
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Nav cards */}
      <div className="px-6 mb-6">
        <div className="space-y-2">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => setView(card.id)}
                className="h-16 w-full flex items-center justify-between bg-[#FDD000] border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(253,208,0,0.6)] hover:shadow-[4px_4px_0px_0px_rgba(253,208,0,0.8)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer glow-gold"
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

      {/* Trial Boost confirmation dialog */}
      <AlertDialog open={showTrialConfirm} onOpenChange={setShowTrialConfirm}>
        <AlertDialogContent className="bg-[#111] border-2 border-[#FDD000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-black uppercase">
              Grant 7-Day Trial to {eligibleCount} Member{eligibleCount !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 text-sm space-y-2">
              <span className="block">
                This will reset the trial window to <strong className="text-white">7 days from now</strong> for every member currently in expired or trial status.
              </span>
              <span className="block mt-2 text-green-400 font-semibold">
                ✓ Active subscribers — untouched
              </span>
              <span className="block text-green-400 font-semibold">
                ✓ Cancelled (still in billing period) — untouched
              </span>
              <span className="block text-yellow-400 font-semibold">
                → Expired &amp; trial members — get fresh 7-day access
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white bg-transparent hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowTrialConfirm(false);
                grantTrialMutation.mutate();
              }}
              className="bg-[#FDD000] text-black font-black hover:bg-[#FDD000]/90 border-2 border-black"
            >
              Yes, Grant Trial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
