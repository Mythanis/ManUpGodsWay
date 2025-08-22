import { useQuery } from '@tanstack/react-query';
import logoUrl from "@assets/App Man Up Logo-Gods way-White-Yellow black background_1755872469606.jpeg";

export function TopRightLogo() {
  const { data: headerLogoSettings } = useQuery<any>({
    queryKey: ['/api/header-logo'],
  });

  // Use custom header logo if available, otherwise use the default attached logo
  const displayLogo = headerLogoSettings?.logoUrl || logoUrl;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40">
      <img 
        src={displayLogo}
        alt="Man Up God's Way Logo"
        className="h-12 w-auto object-contain rounded-md shadow-sm bg-black/10 backdrop-blur-sm"
        data-testid="top-center-logo"
      />
    </div>
  );
}