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
            <div className="w-10 h-10 rounded-none bg-ministry-gold-exact flex items-center justify-center">
              <Scale className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Terms of Use
            </h1>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-none shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardContent className="p-6 text-white space-y-6">
            <div>
              <p className="text-gray-400 text-sm">Effective Date: 1/9/2026</p>
            </div>
            
            <p className="text-gray-300 text-sm leading-relaxed">
              By using this App, you agree to these Terms.
            </p>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">1. Purpose</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                This App exists to support the Man Up God's Way ministry.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">2. User Content</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                You retain ownership of your submissions but grant us permission to store, display, and manage them within the App.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                You agree not to submit unlawful, abusive, or inappropriate content.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">3. Account & Access</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We may suspend or remove content or access that violates these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">4. No Warranties</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                The App is provided "as-is" without warranties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">5. Limitation of Liability</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We are not liable for damages arising from use of the App.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">6. Termination</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                We may terminate access at any time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-2">7. Governing Law</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Governed by laws of the United States.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
