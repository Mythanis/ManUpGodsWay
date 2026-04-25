export type MusicProvider = 'spotify' | 'apple' | 'iheart' | 'soundcloud';

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

const PROVIDER_HOSTS: Record<MusicProvider, string[]> = {
  spotify: ['open.spotify.com'],
  apple: ['music.apple.com'],
  iheart: ['www.iheart.com', 'iheart.com'],
  soundcloud: ['soundcloud.com', 'www.soundcloud.com'],
};

export function detectProvider(url: string): MusicProvider | null {
  try {
    const { hostname } = new URL(url);
    for (const [provider, hosts] of Object.entries(PROVIDER_HOSTS) as [MusicProvider, string[]][]) {
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
    const parsed = new URL(userUrl);

    if (provider === 'spotify') {
      // open.spotify.com/playlist/ID?si=... → open.spotify.com/embed/playlist/ID?utm_source=generator
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return `https://open.spotify.com/embed/${parts.join('/')}?utm_source=generator`;
    }

    if (provider === 'apple') {
      // music.apple.com/us/playlist/... → embed.music.apple.com/us/playlist/...
      return `https://embed.music.apple.com${parsed.pathname}`;
    }

    if (provider === 'iheart') {
      // Append ?embed=true (or &embed=true) to the existing URL
      const sep = parsed.search ? '&' : '?';
      return `${parsed.origin}${parsed.pathname}${parsed.search}${sep}embed=true`;
    }

    if (provider === 'soundcloud') {
      // SoundCloud widget player wraps any soundcloud.com URL
      const encoded = encodeURIComponent(userUrl);
      return `https://w.soundcloud.com/player/?url=${encoded}&color=%23FCD000&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
    }
  } catch {
    // bad URL
  }
  return null;
}
