/** Non-component helpers shared by the online-catalog cards and pages. */
import { PALETTES } from '@/data/catalog';
import type { PlayContext, RemoteCollection } from '@/types/music';
import { hashString } from '@/utils/random';

export const PROVIDER_LABEL = { audius: 'Audius', archive: 'Internet Archive' } as const;

export function collectionHref(c: RemoteCollection): string {
  return `/collection/${encodeURIComponent(c.id)}`;
}

export function collectionContext(c: RemoteCollection): PlayContext {
  return { type: c.kind === 'playlist' ? 'playlist' : 'album', id: c.id, name: c.title, href: collectionHref(c) };
}

const palettes = Object.values(PALETTES);

export function genreGradient(genre: string): string {
  const p = palettes[hashString(`genre:${genre}`) % palettes.length];
  return `linear-gradient(135deg, ${p.a} 0%, ${p.b} 60%, ${p.base} 100%)`;
}
