import logoUrl from "@assets/App Man Up Logo-Gods way-White-Yellow black background_1755872469606.jpeg";

/**
 * Get the default thumbnail URL - uses the app logo as fallback
 * @param customThumbnail - Optional custom thumbnail URL
 * @returns The custom thumbnail if provided, otherwise the default logo
 */
export function getDefaultThumbnail(customThumbnail?: string | null): string {
  return customThumbnail || logoUrl;
}

/**
 * Get the app logo URL for use as default thumbnail
 * @returns The default logo URL
 */
export function getDefaultLogoUrl(): string {
  return logoUrl;
}