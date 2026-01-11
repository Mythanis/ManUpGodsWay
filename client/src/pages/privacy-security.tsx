import { Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileText, Scale } from "lucide-react";

export default function PrivacySecurity() {
  return (
    <div className="min-h-screen liquid-black pb-24">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent"></div>
        
        <div className="relative z-10 px-6 pt-6 pb-8">
          <BackButton />
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-none bg-ministry-gold-exact flex items-center justify-center">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Privacy & Security
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Review our policies and terms
          </p>
        </div>
      </div>
      
      <div className="px-6 py-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-none shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardContent className="p-0">
            <Link href="/privacy-policy">
              <div className="flex items-center justify-between p-4 border-b-2 border-ministry-gold-exact/30 hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                    <FileText className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-bold text-white uppercase tracking-wide">Privacy Policy</span>
                </div>
                <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Link>
            
            <Link href="/terms-conditions">
              <div className="flex items-center justify-between p-4 hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                    <Scale className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-bold text-white uppercase tracking-wide">Terms & Conditions</span>
                </div>
                <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
