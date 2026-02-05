import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Scale } from "lucide-react";

export default function TermsConditions() {
  return (
    <div className="min-h-screen liquid-black pb-24">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent"></div>
        
        <div className="relative z-10 px-6 pt-6 pb-8">
          <BackButton />
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
              <Scale className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Terms & Conditions
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Last updated: February 2026
          </p>
        </div>
      </div>
      
      <div className="px-6 py-6 space-y-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardContent className="p-6 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Acceptance of Terms</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                By accessing and using Man Up God's Way, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">User Accounts</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding your account and for all activities that occur under your account. You agree to notify us immediately of any unauthorized access or use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Community Guidelines</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                As a faith-based community, we expect all users to conduct themselves with respect and integrity. You agree not to post content that is offensive, harassing, defamatory, or inappropriate. We reserve the right to remove any content and suspend accounts that violate these guidelines.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Content Ownership</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                All content provided on Man Up God's Way, including studies, devotionals, videos, and other materials, is owned by Man Up God's Way or its content creators and is protected by copyright laws. You may not reproduce, distribute, or create derivative works from this content without express permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Subscription & Payments</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Premium and VIP subscriptions provide access to additional content and features. Subscriptions are billed according to the plan you select. You may cancel your subscription at any time, but refunds are subject to our refund policy. Prices are subject to change with notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Limitation of Liability</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Man Up God's Way provides spiritual and educational content for personal growth. We are not responsible for any decisions you make based on this content. The platform is provided "as is" without warranties of any kind, either express or implied.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Changes to Terms</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of significant changes through the app or via email. Your continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Contact</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                For questions about these Terms & Conditions, please contact us through the app or email us at support@manupgodsway.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
