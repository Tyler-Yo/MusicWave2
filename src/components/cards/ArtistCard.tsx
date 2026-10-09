import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { CoverImage } from '@/components/common/CoverImage';
import { artistImage } from '@/services/catalog';
import type { Artist } from '@/types/music';
import { compactNumber } from '@/utils/format';

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <div role="listitem" className="group w-36 shrink-0 snap-start sm:w-40">
      <Link to={`/artist/${artist.id}`} className="block rounded-xl text-center outline-offset-4">
        <CoverImage src={artistImage(artist)} alt="" rounded="rounded-full" className="shadow-card transition duration-500 group-hover:scale-[1.03]" />
        <p className="mt-3 flex items-center justify-center gap-1 truncate text-sm font-bold">
          {artist.name}
          {artist.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified artist" />}
        </p>
        <p className="mt-0.5 text-[13px] text-muted">{compactNumber(artist.monthlyListeners)} listeners</p>
      </Link>
    </div>
  );
}
