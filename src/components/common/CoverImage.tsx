import { useEffect, useState } from 'react';
import { generatedCover } from '@/services/catalog';
import { cn } from '@/utils/cn';

/**
 * Square artwork with a skeleton until decoded. If the image can't be loaded
 * (offline, blocked host, removed artwork) a generated cover takes its place.
 */
export function CoverImage({
  src,
  alt,
  className,
  rounded = 'rounded-xl',
  eager = false,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
  eager?: boolean;
  fallback?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);
  const shown = failed ? (fallback ?? generatedCover(src)) : src;
  return (
    <span className={cn('relative block aspect-square overflow-hidden bg-surface', rounded, className)}>
      {!loaded && <span className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
      <img
        src={shown}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) setFailed(true);
          else setLoaded(true);
        }}
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  );
}
