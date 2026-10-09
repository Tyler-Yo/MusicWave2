/** OS-level media controls (lock screen, hardware keys, notification shade). */
import { useEffect } from 'react';
import { getAudioEngine } from '@/services/audioEngine';
import { albumTitleOf, artistNameOf, trackCover } from '@/services/catalog';
import { player } from '@/state/playerStore';
import { useCurrentTrack, usePlayer } from './usePlayer';

const pngCache = new Map<string, string>();

/** Media Session artwork must be a raster image on most platforms: rasterize our SVG covers. */
function rasterize(svgUrl: string, size = 512): Promise<string> {
  const hit = pngCache.get(svgUrl);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d')?.drawImage(img, 0, 0, size, size);
        const png = canvas.toDataURL('image/png');
        pngCache.set(svgUrl, png);
        resolve(png);
      } catch {
        resolve(svgUrl);
      }
    };
    img.onerror = () => resolve(svgUrl);
    img.src = svgUrl;
  });
}

export function useMediaSession(): void {
  const track = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    let cancelled = false;
    const cover = trackCover(track);
    void rasterize(cover).then((src) => {
      if (cancelled) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: artistNameOf(track),
        album: albumTitleOf(track),
        artwork: [{ src, sizes: '512x512', type: src.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml' }],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const engine = getAudioEngine();
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => player.play()],
      ['pause', () => player.pause()],
      ['nexttrack', () => player.next()],
      ['previoustrack', () => player.previous()],
      ['seekbackward', (d) => player.seekBy(-(d.seekOffset ?? 10))],
      ['seekforward', (d) => player.seekBy(d.seekOffset ?? 10)],
      ['seekto', (d) => d.seekTime !== undefined && player.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    }
    const updatePosition = () => {
      const a = engine.audio;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate });
      } catch {
        /* ignore */
      }
    };
    const offs = [engine.on('loadedmetadata', updatePosition), engine.on('seeked', updatePosition), engine.on('ratechange', updatePosition), engine.on('play', updatePosition)];
    return () => offs.forEach((off) => off());
  }, []);
}
