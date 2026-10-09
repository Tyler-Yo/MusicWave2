import { useState } from 'react';
import { cn } from '@/utils/cn';

/** Square artwork with a skeleton until decoded. */
export function CoverImage({
  src,
  alt,
  className,
  rounded = 'rounded-xl',
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={cn('relative block aspect-square overflow-hidden bg-surface', rounded, className)}>
      {!loaded && <span className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  );
}
