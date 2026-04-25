import { type MusicProvider, MUSIC_PROVIDER_HOSTS, normalizeMusicUrl } from "@shared/schema";

export type { MusicProvider };
export { normalizeMusicUrl as normalizeUrl };

export const PROVIDER_LABELS: Record<MusicProvider, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  iheart: 'iHeartRadio',
  soundcloud: 'SoundCloud',
};

export const PROVIDER_PLACEHOLDERS: Record<MusicProvider, string> = {
  spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX...',
  apple: 'https://music.apple.com/us/playlist/...',
  iheart: 'https://www.iheart.com/live/station-id/',
  soundcloud: 'https://soundcloud.com/artist/track-name',
};

export function detectProvider(url: string): MusicProvider | null {
  try {
    const { hostname } = new URL(normalizeMusicUrl(url));
    for (const [provider, hosts] of Object.entries(MUSIC_PROVIDER_HOSTS) as [MusicProvider, string[]][]) {
      if (hosts.includes(hostname)) return provider;
    }
  } catch {
    // invalid URL
  }
  return null;
}

export function validateProviderUrl(provider: MusicProvider, url: string): boolean {
  const detected = detectProvider(url);
  return detected === provider;
}

export function buildEmbedUrl(provider: MusicProvider, userUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMusicUrl(userUrl));

    if (provider === 'spotify') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return `https://open.spotify.com/embed/${parts.join('/')}?utm_source=generator`;
    }

    if (provider === 'apple') {
      return `https://embed.music.apple.com${parsed.pathname}`;
    }

    if (provider === 'iheart') {
      const sep = parsed.search ? '&' : '?';
      return `${parsed.origin}${parsed.pathname}${parsed.search}${sep}embed=true`;
    }

    if (provider === 'soundcloud') {
      // Strip tracking params (?si=, utm_*, etc.) that break the widget resolver
      const cleanUrl = `${parsed.origin}${parsed.pathname}`;
      const encoded = encodeURIComponent(cleanUrl);
      // Private/secret playlists have a "/s-XXXXX" segment in the path; the widget
      // also needs that token forwarded as a separate `secret_token` query param.
      const secretMatch = parsed.pathname.match(/\/(s-[A-Za-z0-9]+)(?:\/?$)/);
      const secretParam = secretMatch ? `&secret_token=${encodeURIComponent(secretMatch[1])}` : '';
      return `https://w.soundcloud.com/player/?url=${encoded}${secretParam}&color=%23FCD000&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
    }
  } catch {
    // bad URL
  }
  return null;
}
