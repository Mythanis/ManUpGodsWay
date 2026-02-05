import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen liquid-black pb-24">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent"></div>
        
        <div className="relative z-10 px-6 pt-6 pb-8">
          <BackButton />
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
              <FileText className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Privacy Policy
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
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Information We Collect</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We collect information you provide directly to us, such as when you create an account, participate in discussions, complete challenges, or contact us for support. This may include your name, email address, profile information, and any content you submit to the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">How We Use Your Information</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We use the information we collect to provide, maintain, and improve our services, including to personalize your experience, track your spiritual growth progress, facilitate community interactions, and send you notifications about updates and new content.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Information Sharing</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We do not sell, trade, or otherwise transfer your personal information to outside parties. We may share information with trusted third parties who assist us in operating our platform, conducting our business, or serving our users, so long as those parties agree to keep this information confidential.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Data Security</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We implement a variety of security measures to maintain the safety of your personal information. Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Your Rights</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                You may access, update, or delete your account information at any time through your profile settings. You may also contact us to request access to, correction of, or deletion of any personal information you have provided to us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">Contact Us</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us through the app or email us at support@manupgodsway.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
