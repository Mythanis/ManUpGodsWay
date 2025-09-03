import { ExternalLink } from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram, FaGlobe, FaTshirt } from "react-icons/fa";

export default function MoreManUp() {
  const socialLinks = [
    {
      name: "Facebook",
      url: "https://www.facebook.com/manupgodsway",
      icon: FaFacebook,
      color: "text-blue-600 hover:text-blue-700"
    },
    {
      name: "Twitter",
      url: "https://twitter.com/Manupgodsway1",
      icon: FaTwitter,
      color: "text-blue-400 hover:text-blue-500"
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/manupgodsway/",
      icon: FaInstagram,
      color: "text-pink-600 hover:text-pink-700"
    },
    {
      name: "Man Up God's Way Website",
      url: "https://manupgodsway.org/",
      icon: FaGlobe,
      color: "text-ministry-navy hover:text-ministry-charcoal"
    },
    {
      name: "Man Up God's Way Merch",
      url: "https://kickmerch.com/collections/man-up-gods-way",
      icon: FaTshirt,
      color: "text-black hover:text-gray-800"
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ministry-charcoal dark:text-white mb-2">
            More Man Up
          </h1>
          <p className="text-ministry-slate dark:text-gray-300">
            Connect with us across all platforms
          </p>
        </div>

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
                className="flex items-center justify-between p-4 bg-ministry-gold-exact/20 dark:bg-ministry-gold/10 rounded-lg hover:bg-ministry-gold/30 dark:hover:bg-ministry-gold-exact/20 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <IconComponent className={`w-6 h-6 ${link.color}`} />
                  <span className="font-medium text-black">
                    {link.name}
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-ministry-slate dark:text-gray-400" />
              </a>
            );
          })}
        </div>

        {/* Footer Message */}
        <div className="mt-8 text-center">
          <p className="text-sm text-ministry-slate dark:text-gray-400">
            Follow us for daily inspiration, updates, and community highlights!
          </p>
        </div>
      </div>
    </div>
  );
}