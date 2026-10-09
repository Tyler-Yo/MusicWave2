import { Link } from 'react-router-dom';
import { genreCover } from '@/services/catalog';
import type { Genre } from '@/types/music';

export function GenreTile({ genre }: { genre: Genre }) {
  return (
    <Link
      to={`/genre/${genre.id}`}
      className="group relative block aspect-[16/10] overflow-hidden rounded-2xl shadow-card outline-offset-4"
      style={{ background: genre.palette.base }}
    >
      <img src={genreCover(genre)} alt="" className="absolute -right-6 -top-4 h-[130%] w-auto rotate-12 rounded-xl opacity-90 transition duration-700 ease-out-expo group-hover:rotate-6 group-hover:scale-110" />
      <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <span className="absolute bottom-3 left-4 right-4">
        <span className="block text-lg font-extrabold text-white drop-shadow">{genre.name}</span>
        <span className="mt-0.5 line-clamp-1 block text-xs font-medium text-white/75">{genre.tagline}</span>
      </span>
    </Link>
  );
}
