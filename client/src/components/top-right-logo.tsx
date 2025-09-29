import { useQuery } from '@tanstack/react-query';
import logoUrl from "@assets/App Man Up Logo-Gods way-White-Yellow black background_1755872469606.jpeg";

export function TopRightLogo() {
  const { data: headerLogoSettings } = useQuery<any>({
    queryKey: ['/api/header-logo'],
  });

  // Use custom header logo if available, otherwise use the default attached logo
  const displayLogo = headerLogoSettings?.logoUrl || logoUrl;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center py-4 shadow-lg opacity-100" style={{ backgroundColor: '#000000' }}>
      <img 
        src={displayLogo} 
        alt="Man Up God's Way Logo" 
        className="h-12 w-auto object-contain"
        style={{ 
          opacity: 1,
          imageRendering: 'crisp-edges',
          WebkitImageRendering: '-webkit-optimize-contrast',
          msInterpolationMode: 'nearest-neighbor'
        } as React.CSSProperties}
        loading="eager"
        decoding="sync"
        data-testid="app-logo"
      />
    </div>
  );
}