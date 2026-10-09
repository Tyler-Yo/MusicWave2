/** Display formatting helpers. */

/** 83.4 → "1:23"; 3725 → "1:02:05". Negative values are prefixed with "−". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const sign = seconds < 0 ? '−' : '';
  const s = Math.floor(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}:${sec}` : `${sign}${m}:${sec}`;
}

/** Spoken-friendly duration for aria labels: "3 minutes 21 seconds". */
export function speakTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  parts.push(`${r} second${r === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Total length of a list: "12 min" / "1 hr 4 min". */
export function formatTotal(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = Math.round((now - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 60) return 'just now';
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

/** Signed seconds for offsets: "+0.25s", "−0.50s", "0.00s". */
export function formatOffset(s: number): string {
  if (Math.abs(s) < 0.005) return '0.00s';
  return `${s > 0 ? '+' : '−'}${Math.abs(s).toFixed(2)}s`;
}
