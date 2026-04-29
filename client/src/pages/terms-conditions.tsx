import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, ArrowLeft } from "lucide-react";
import { TERMS_SECTIONS, TERMS_INTRO, TERMS_CLOSING, TERMS_EFFECTIVE_DATE, CURRENT_TERMS_VERSION } from "@shared/termsContent";

export default function TermsConditions() {
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
              <ArrowLeft className="h-5 w-5 text-[#FDD000]" />
            </Button>
          </Link>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
              <Scale className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Terms & Conditions of Use
            </h1>
          </div>
          <p className="text-gray-400 text-sm">Effective Date: {TERMS_EFFECTIVE_DATE}</p>
          <p className="text-gray-500 text-xs mt-1">Version: {CURRENT_TERMS_VERSION}</p>
        </div>
      </div>
      
      <div className="px-6 py-6 space-y-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)]">
          <CardContent className="p-6 space-y-6">
            <p className="text-gray-300 text-sm leading-relaxed italic">
              {TERMS_INTRO}
            </p>

            {TERMS_SECTIONS.map((section) => (
              <section key={section.id}>
                <h2 className="text-lg font-bold text-ministry-gold-exact uppercase mb-3">{section.heading}</h2>
                {section.intro && (
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">{section.intro}</p>
                )}
                {section.body && (
                  <p className={`text-sm leading-relaxed mb-2 ${section.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}>
                    {section.body}
                  </p>
                )}
                {section.bullets && (
                  <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-2">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {section.closing && (
                  <p className="text-gray-300 text-sm leading-relaxed mt-2 whitespace-pre-line">{section.closing}</p>
                )}
                {section.subsections && (
                  <div className="space-y-4 mt-2">
                    {section.subsections.map((sub) => (
                      <div key={sub.id}>
                        <h3 className="text-base font-semibold text-ministry-gold-exact mb-2">{sub.heading}</h3>
                        {sub.body && (
                          <p className={`text-sm leading-relaxed mb-2 ${sub.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}>
                            {sub.body}
                          </p>
                        )}
                        {sub.bullets && (
                          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-2">
                            {sub.bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {sub.closing && (
                          <p className="text-gray-300 text-sm leading-relaxed mt-2 whitespace-pre-line">{sub.closing}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <div className="border-t border-ministry-gold-exact/30 pt-4">
              <p className="text-ministry-gold-exact text-sm font-semibold italic leading-relaxed">
                {TERMS_CLOSING}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
