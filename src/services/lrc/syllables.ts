/**
 * Lightweight English syllable heuristics.
 *
 * Used for three things:
 *  1. weighting interpolated word timings when an LRC only has line timestamps,
 *  2. splitting composed lyrics into sung syllables (one melody note each),
 *  3. picking a vowel for the synthesized guide vocal's formant filter.
 *
 * A `|` inside a word is an explicit syllable break (e.g. "fire|flies") and is
 * removed from the displayed text.
 */

const VOWEL_GROUP = /[aeiouyàáâäèéêëìíîïòóôöùúûü]+/g;

function letters(word: string): string {
  return word.toLowerCase().replace(/[^a-zàáâäèéêëìíîïòóôöùúûü'|]/g, '');
}

export function countSyllables(word: string): number {
  if (word.includes('|')) return word.split('|').filter((s) => letters(s).length > 0).length || 1;
  const w = letters(word).replace(/'/g, '');
  if (!w) return /\d/.test(word) ? Math.max(1, word.replace(/\D/g, '').length) : 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(VOWEL_GROUP);
  return Math.max(1, groups ? groups.length : 1);
}

/** Splits a word into approximately sung syllables. "lanterns" → ["lan", "terns"]. */
export function splitSyllables(word: string): string[] {
  if (word.includes('|')) return word.split('|').filter(Boolean);
  const n = countSyllables(word);
  if (n <= 1) return [word];
  const lower = word.toLowerCase();
  const groups: Array<{ start: number; end: number }> = [];
  for (const m of lower.matchAll(VOWEL_GROUP)) {
    groups.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  if (groups.length < 2) return [word];
  // Keep the first n vowel groups; trailing silent groups merge into the last syllable.
  const used = groups.slice(0, Math.min(n, groups.length));
  const parts: string[] = [];
  let cut = 0;
  for (let i = 0; i < used.length - 1; i++) {
    const consonants = used[i + 1].start - used[i].end;
    // V-CV split for single consonants, VC-CV for clusters.
    const split = used[i].end + (consonants <= 1 ? 0 : Math.floor(consonants / 2));
    parts.push(word.slice(cut, split));
    cut = split;
  }
  parts.push(word.slice(cut));
  return parts.filter(Boolean);
}

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** The dominant vowel sound of a syllable, used to shape the guide-vocal formants. */
export function syllableVowel(syllable: string): Vowel {
  const s = syllable.toLowerCase();
  if (/oo|ew|ue|ui/.test(s)) return 'u';
  if (/ee|ea|ie|ey/.test(s)) return 'i';
  if (/ou|ow|oa|aw|au/.test(s)) return 'o';
  const m = s.match(/[aeiouy]/);
  if (!m) return 'a';
  switch (m[0]) {
    case 'a':
      return 'a';
    case 'e':
      return 'e';
    case 'i':
    case 'y':
      return 'i';
    case 'o':
      return 'o';
    default:
      return 'u';
  }
}

/** True if the syllable starts with a noisy consonant (s, sh, t, k, ch, f, h, …). */
export function hasNoisyOnset(syllable: string): boolean {
  return /^(s|sh|ch|t|k|c(?![aeiouy]?h)|f|h|th|p|x|z)/i.test(syllable.replace(/^[^a-z]+/i, ''));
}

/** Removes the explicit syllable separator from display text. */
export function stripSyllableMarks(text: string): string {
  return text.replace(/\|/g, '');
}
