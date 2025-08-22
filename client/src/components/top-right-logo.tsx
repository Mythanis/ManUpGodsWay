import { useQuery } from '@tanstack/react-query';
import logoUrl from "@assets/App Man Up Logo-Gods way-White-Yellow black background_1755872469606.jpeg";

export function TopRightLogo() {
  const { data: logoSettings } = useQuery<any>({
    queryKey: ['/api/logo'],
  });

  // Use custom logo if available, otherwise use the default attached logo
  const displayLogo = logoSettings?.logoUrl || logoUrl;

  return (
    <div className="fixed top-4 right-14 z-40">
      <img 
        src={displayLogo}
        alt="Man Up God's Way Logo"
        className="h-10 w-auto object-contain rounded-md shadow-sm bg-black/10 backdrop-blur-sm"
        data-testid="top-right-logo"
      />
    </div>
  );
}