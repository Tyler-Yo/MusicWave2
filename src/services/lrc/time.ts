/** Time helpers shared by the LRC parser and serializer. */

/** Converts `mm`, `ss` and an optional fraction ("4" = .4s, "45" = .45s, "456" = .456s) to seconds. */
export function lrcPartsToSeconds(min: string, sec: string, frac?: string): number {
  const f = frac ? parseInt(frac, 10) / 10 ** frac.length : 0;
  return parseInt(min, 10) * 60 + parseInt(sec, 10) + f;
}

/** Formats seconds as an LRC timestamp body: `mm:ss.xx` (or `mm:ss.xxx` with precision 3). */
export function formatLrcTime(seconds: number, precision: 2 | 3 = 2): string {
  const scale = precision === 3 ? 1000 : 100;
  const total = Math.max(0, Math.round(seconds * scale));
  const minutes = Math.floor(total / (60 * scale));
  const secs = Math.floor((total % (60 * scale)) / scale);
  const frac = total % scale;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(frac).padStart(precision, '0')}`;
}

/** Parses "mm:ss.xx", "m:ss", "ss.xx" or plain seconds typed by a person. Returns NaN when invalid. */
export function parseLooseTime(input: string): number {
  const s = input.trim().replace(/^\[|\]$/g, '').replace(/^<|>$/g, '');
  if (!s) return NaN;
  const m = s.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (m) return lrcPartsToSeconds(m[1], m[2], m[3]);
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
