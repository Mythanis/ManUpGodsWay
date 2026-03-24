import { ExternalLink } from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram, FaGlobe, FaTshirt, FaYoutube, FaTiktok, FaLinkedin, FaEnvelope, FaPhone, FaPodcast, FaSpotify } from "react-icons/fa";
import { BackButton } from "@/components/BackButton";
import { useQuery } from "@tanstack/react-query";
import type { ManUpLink } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FaFacebook,
  twitter: FaTwitter,
  instagram: FaInstagram,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  linkedin: FaLinkedin,
  globe: FaGlobe,
  shirt: FaTshirt,
  email: FaEnvelope,
  phone: FaPhone,
  podcast: FaPodcast,
  spotify: FaSpotify,
};

export default function MoreManUp() {
  const { data: links = [], isLoading } = useQuery<ManUpLink[]>({
    queryKey: ["/api/man-up-links"],
  });

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
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
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-sm" />
            ))
          ) : links.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No links available yet.</div>
          ) : (
            links.map((link) => {
              const IconComponent = ICON_MAP[link.icon] || FaGlobe;
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(252,208,0,1)] transition-all duration-200 relative overflow-hidden"
                >
                  <div className="flex items-center space-x-4 relative z-10">
                    <div className="w-10 h-10 bg-ministry-gold-exact rounded-sm flex items-center justify-center border-2 border-black">
                      {link.imageUrl ? (
                        <img src={link.imageUrl} alt={link.name} className="w-8 h-8 rounded-sm object-cover" />
                      ) : (
                        <IconComponent className={`w-5 h-5 ${link.iconColor || 'text-black'}`} />
                      )}
                    </div>
                    <span className="text-base font-black text-white uppercase tracking-[0.18em]">
                      {link.name}
                    </span>
                  </div>
                  <ExternalLink className="w-5 h-5 text-ministry-gold-exact relative z-10" />
                </a>
              );
            })
          )}
        </div>

        <div className="mt-8 text-center liquid-black-white border-2 border-ministry-gold-exact rounded-sm p-4 shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
          <p className="text-sm text-white font-medium relative z-10">
            Follow us for daily inspiration, updates, and community highlights!
          </p>
        </div>
      </div>
    </div>
  );
}