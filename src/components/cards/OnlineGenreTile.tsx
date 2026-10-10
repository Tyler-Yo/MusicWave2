/** Genre tile for the online catalog (opens /browse/:genre). */
import { Link } from 'react-router-dom';
import { genreGradient } from './remoteHelpers';

export function OnlineGenreTile({ genre }: { genre: string }) {
  return (
    <Link
      to={`/browse/${encodeURIComponent(genre)}`}
      className="group relative block aspect-[16/9] overflow-hidden rounded-2xl shadow-card outline-offset-4"
      style={{ background: genreGradient(genre) }}
    >
      <span className="absolute -bottom-6 -right-4 select-none text-[5.5rem] font-black leading-none text-white/15 transition duration-700 ease-out-expo group-hover:-translate-x-2 group-hover:text-white/25" aria-hidden="true">
        {genre.slice(0, 2)}
      </span>
      <span className="absolute inset-0 bg-gradient-to-tr from-black/45 to-transparent" />
      <span className="absolute bottom-3 left-4 right-4 text-lg font-extrabold text-white drop-shadow">{genre}</span>
    </Link>
  );
}
