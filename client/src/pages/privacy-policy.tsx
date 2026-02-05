import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen liquid-black pb-24">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent"></div>
        
        <div className="relative z-10 px-6 pt-6 pb-8">
          <Link href="/privacy-security">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4"
            >
              <ArrowLeft className="h-5 w-5 text-[#FCD000]" />
            </Button>
          </Link>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
              <FileText className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Privacy Policy
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Effective Date: 1/9/2026
          </p>
        </div>
      </div>
      
      <div className="px-6 py-6 space-y-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardContent className="p-6 space-y-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">App Name: ManUp God's Way</p>
              <p className="text-gray-400 text-sm">Operated By: ManUp God's Way</p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">1. Introduction</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                ManUp God's Way ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our mobile application or related services ("the App").
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">2. Information We Collect</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                We collect only information you voluntarily provide:
              </p>
              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                <li>First name</li>
                <li>Last name</li>
                <li>Email address</li>
                <li>Testimony content (text)</li>
                <li>Uploaded pictures/images</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">3. How We Use Your Information</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                We use your information solely to:
              </p>
              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                <li>Operate and support the App</li>
                <li>Display or manage submitted testimonies and content</li>
                <li>Communicate with you</li>
                <li>Send ministry-related emails</li>
                <li>Maintain safety, integrity, and functionality of the App</li>
              </ul>
              <p className="text-gray-300 text-sm leading-relaxed mt-2">
                We do not use your data for advertising, tracking, or profiling.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">4. Third-Party Services</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                We do not sell or share your data. We use the following service providers:
              </p>
              
              <div className="mb-3">
                <h3 className="font-bold text-white text-sm mb-1">Mailchimp</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Used only for sending ManUp God's Way emails.
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-1">
                  <li>Only your email address is shared.</li>
                  <li>You may unsubscribe using the link in any email or by emailing info@manupgodsway.org.</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Replit</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Used for hosting and backend infrastructure.
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-1">
                  <li>Your data may be stored on Replit-managed infrastructure.</li>
                  <li>Replit acts only as a technical service provider.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">5. Data Retention</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We retain your data only as long as needed for ministry and app operations unless legally required otherwise.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">6. Security</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We use commercially reasonable administrative, technical, and organizational safeguards. No system is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">7. Your Rights & Data Deletion</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                You may request:
              </p>
              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                <li>A copy of your data</li>
                <li>Full deletion of your data</li>
              </ul>
              <p className="text-gray-300 text-sm leading-relaxed mt-2">
                Email: info@manupgodsway.org
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">8. Children's Privacy</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Not intended for children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">9. No Tracking</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We do not track users across apps or websites.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">10. Changes</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We may update this policy. Continued use means acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">11. Contact</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                info@manupgodsway.org
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
