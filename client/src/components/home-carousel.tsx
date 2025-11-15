import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";

interface CarouselItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkType: string;
  linkId: string | null;
  externalUrl: string | null;
  position: number;
  isActive: boolean;
  displayOrder: number;
}

export default function HomeCarousel() {
  const { data: carouselItems = [] } = useQuery<CarouselItem[]>({
    queryKey: ['/api/carousel'],
  });

  if (!carouselItems || carouselItems.length === 0) {
    return null;
  }

  const getLink = (item: CarouselItem) => {
    if (item.linkType === "external" && item.externalUrl) {
      return item.externalUrl;
    }
    
    // Link to content based on type
    switch (item.linkType) {
      case "study":
        // Studies have detail pages, link directly to the study
        return item.linkId ? `/studies/${item.linkId}` : "/library";
      case "video":
        // Videos: link to specific video if ID provided, otherwise videos page
        return item.linkId ? `/videos?id=${item.linkId}` : "/videos";
      case "podcast":
        // Podcasts: link to specific podcast if ID provided, otherwise podcasts page
        return item.linkId ? `/podcasts?id=${item.linkId}` : "/podcasts";
      case "devotional":
        // Devotionals: link to specific devotional if ID provided, otherwise home
        return item.linkId ? `/home?devotional=${item.linkId}` : "/home";
      case "challenge":
        // Challenges: link to specific challenge if ID provided, otherwise challenges page
        return item.linkId ? `/challenges?id=${item.linkId}` : "/challenges";
      default:
        return "/home";
    }
  };

  const renderCarouselItem = (item: CarouselItem, isLarge: boolean) => {
    const link = getLink(item);
    const isExternal = item.linkType === "external";

    const content = (
      <Card 
        className={`overflow-hidden group cursor-pointer transition-all hover:shadow-xl ${
          isLarge ? 'h-64' : 'h-48'
        }`}
        style={{ border: '3px solid rgb(252, 208, 0)' }}
        data-testid={`carousel-item-${item.position}`}
      >
        <div className="relative w-full h-full">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
            <div>
              <h3 className={`text-white font-bold ${isLarge ? 'text-xl' : 'text-base'}`}>
                {item.title}
              </h3>
              {item.description && isLarge && (
                <p className="text-white/90 text-sm mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    );

    if (isExternal) {
      return (
        <a 
          href={link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
        >
          {content}
        </a>
      );
    }

    return (
      <Link href={link}>
        <span className="block">
          {content}
        </span>
      </Link>
    );
  };

  // Sort items by display order and position
  const sortedItems = [...carouselItems].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.position - b.position;
  });

  // Get items by position
  const largeItem = sortedItems.find(item => item.position === 1);
  const smallItems = sortedItems.filter(item => item.position === 2 || item.position === 3);

  return (
    <div className="space-y-3">
      {/* Large top image */}
      {largeItem && renderCarouselItem(largeItem, true)}

      {/* Two smaller images at bottom */}
      {smallItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {smallItems.map(item => (
            <div key={item.id}>
              {renderCarouselItem(item, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
