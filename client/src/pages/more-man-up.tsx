import { ExternalLink } from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram, FaGlobe, FaTshirt } from "react-icons/fa";
import { BackButton } from "@/components/BackButton";

export default function MoreManUp() {
  const socialLinks = [
    {
      name: "Facebook",
      url: "https://www.facebook.com/manupgodsway",
      icon: FaFacebook,
      iconColor: "text-blue-600"
    },
    {
      name: "Twitter",
      url: "https://twitter.com/Manupgodsway1",
      icon: FaTwitter,
      iconColor: "text-blue-400"
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/manupgodsway/",
      icon: FaInstagram,
      iconColor: "text-pink-600"
    },
    {
      name: "Man Up God's Way Website",
      url: "https://manupgodsway.org/",
      icon: FaGlobe,
      iconColor: "text-black"
    },
    {
      name: "Man Up God's Way Merch",
      url: "https://kickmerch.com/collections/man-up-gods-way",
      icon: FaTshirt,
      iconColor: "text-black"
    }
  ];

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-md mx-auto">
          <BackButton />
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            More <span className="text-ministry-gold-exact">Man Up</span>
          </h1>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide">
            Connect With Us Across All Platforms
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-6">
        {/* Social Links */}
        <div className="space-y-4">
          {socialLinks.map((link) => {
            const IconComponent = link.icon;
            return (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(252,208,0,1)] transition-all duration-200 relative overflow-hidden"
              >
                <div className="flex items-center space-x-4 relative z-10">
                  <div className="w-10 h-10 bg-ministry-gold-exact rounded-sm flex items-center justify-center border-2 border-black">
                    <IconComponent className="w-5 h-5 text-black" />
                  </div>
                  <span className="font-black text-white uppercase tracking-tighter">
                    {link.name}
                  </span>
                </div>
                <ExternalLink className="w-5 h-5 text-ministry-gold-exact relative z-10" />
              </a>
            );
          })}
        </div>

        {/* Footer Message */}
        <div className="mt-8 text-center liquid-black-white border-2 border-ministry-gold-exact rounded-sm p-4 shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
          <p className="text-sm text-white font-medium relative z-10">
            Follow us for daily inspiration, updates, and community highlights!
          </p>
        </div>
      </div>
    </div>
  );
}
