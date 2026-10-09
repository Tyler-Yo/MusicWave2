/**
 * Generative, original artwork. Every cover, avatar and playlist image in the
 * demo catalog is an SVG built here from a palette + seed — no external images.
 * Results are memoized data URLs so <img> elements can cache and decode them.
 */
import type { CoverStyle, Palette } from '@/types/music';
import { createRng, hashString, type Rng } from './random';

export interface CoverOptions {
  seed: string;
  palette: Palette;
  style: CoverStyle;
  /** Optional editorial title printed on the cover (playlists, mixes). */
  title?: string;
  subtitle?: string;
}

const cache = new Map<string, string>();

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);
}

function grain(id: string): string {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.09"/></feComponentTransfer></filter>`;
}

type Painter = (r: Rng, p: Palette, uid: string) => { defs: string; body: string };

const painters: Record<CoverStyle, Painter> = {
  waves(r, p, uid) {
    const defs = `<linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset="1" stop-color="${p.b}" stop-opacity="0.9"/></linearGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    const colors = [p.a, p.b, p.c, p.a, p.c, p.b];
    for (let i = 0; i < 6; i++) {
      const y = 170 + i * 70 + r.range(-20, 20);
      const amp = r.range(25, 70);
      const freq = r.range(1.2, 2.6);
      const phase = r.range(0, Math.PI * 2);
      let d = `M0 ${y}`;
      for (let x = 0; x <= 600; x += 20) d += ` L${x} ${(y + Math.sin((x / 600) * Math.PI * 2 * freq + phase) * amp).toFixed(1)}`;
      d += ' L600 600 L0 600 Z';
      body += `<path d="${d}" fill="${colors[i]}" opacity="${(0.28 + i * 0.1).toFixed(2)}"/>`;
    }
    return { defs, body };
  },
  orbits(r, p, uid) {
    const cx = r.range(240, 360);
    const cy = r.range(240, 360);
    const defs = `<radialGradient id="${uid}bg" cx="${cx / 600}" cy="${cy / 600}" r="0.9"><stop offset="0" stop-color="${p.b}"/><stop offset="0.55" stop-color="${p.base}"/><stop offset="1" stop-color="${p.base}"/></radialGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    for (let i = 1; i <= 6; i++) {
      const rx = i * 52 + r.range(-8, 8);
      const ry = rx * r.range(0.55, 0.9);
      const rot = r.range(-30, 30);
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${p.c}" stroke-opacity="${(0.55 - i * 0.06).toFixed(2)}" stroke-width="2" transform="rotate(${rot} ${cx} ${cy})"/>`;
      const a = r.range(0, Math.PI * 2);
      const px = cx + Math.cos(a) * rx * Math.cos((rot * Math.PI) / 180) - Math.sin(a) * ry * Math.sin((rot * Math.PI) / 180);
      const py = cy + Math.cos(a) * rx * Math.sin((rot * Math.PI) / 180) + Math.sin(a) * ry * Math.cos((rot * Math.PI) / 180);
      body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.range(6, 18).toFixed(1)}" fill="${r.pick([p.a, p.c, p.b])}"/>`;
    }
    body += `<circle cx="${cx}" cy="${cy}" r="${r.range(30, 46)}" fill="${p.a}"/>`;
    return { defs, body };
  },
  horizon(r, p, uid) {
    const defs = `<linearGradient id="${uid}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset="0.6" stop-color="${p.b}"/><stop offset="1" stop-color="${p.a}"/></linearGradient><linearGradient id="${uid}sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.c}"/><stop offset="1" stop-color="${p.a}"/></linearGradient><clipPath id="${uid}clip"><rect width="600" height="360"/></clipPath>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}sky)"/>`;
    const sunR = r.range(120, 160);
    let sun = `<g clip-path="url(#${uid}clip)"><circle cx="300" cy="350" r="${sunR}" fill="url(#${uid}sun)"/>`;
    for (let i = 0; i < 7; i++) {
      const y = 260 + i * 15;
      sun += `<rect x="0" y="${y}" width="600" height="${2 + i * 1.6}" fill="${p.b}"/>`;
    }
    body += sun + '</g>';
    body += `<rect y="360" width="600" height="240" fill="${p.base}"/>`;
    for (let i = 0; i < 9; i++) {
      const y = 360 + Math.pow(i / 8, 2) * 240;
      body += `<line x1="0" y1="${y.toFixed(1)}" x2="600" y2="${y.toFixed(1)}" stroke="${p.a}" stroke-opacity="0.7" stroke-width="2"/>`;
    }
    for (let i = -8; i <= 8; i++) {
      body += `<line x1="${300 + i * 22}" y1="360" x2="${300 + i * 150}" y2="600" stroke="${p.a}" stroke-opacity="0.6" stroke-width="2"/>`;
    }
    for (let i = 0; i < 26; i++) {
      body += `<circle cx="${r.range(0, 600).toFixed(0)}" cy="${r.range(0, 200).toFixed(0)}" r="${r.range(0.8, 2.2).toFixed(1)}" fill="${p.c}" opacity="${r.range(0.4, 1).toFixed(2)}"/>`;
    }
    return { defs, body };
  },
  bloom(r, p, uid) {
    const defs = `<radialGradient id="${uid}bg" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="${p.c}"/><stop offset="0.4" stop-color="${p.a}"/><stop offset="1" stop-color="${p.base}"/></radialGradient><linearGradient id="${uid}petal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.b}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.c}" stop-opacity="0.2"/></linearGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    const n = r.int(7, 12);
    const len = r.range(180, 240);
    for (let i = 0; i < n; i++) {
      const rot = (360 / n) * i + r.range(-4, 4);
      body += `<ellipse cx="${300 + len / 2}" cy="300" rx="${len / 2}" ry="${r.range(34, 56).toFixed(1)}" fill="url(#${uid}petal)" transform="rotate(${rot.toFixed(1)} 300 300)" style="mix-blend-mode:screen"/>`;
    }
    body += `<circle cx="300" cy="300" r="${r.range(40, 60).toFixed(1)}" fill="${p.base}" opacity="0.85"/><circle cx="300" cy="300" r="18" fill="${p.c}"/>`;
    return { defs, body };
  },
  stripes(r, p, uid) {
    const defs = `<clipPath id="${uid}c"><rect width="600" height="600"/></clipPath>`;
    let body = `<rect width="600" height="600" fill="${p.base}"/><g clip-path="url(#${uid}c)" transform="rotate(${r.range(-35, -15).toFixed(1)} 300 300)">`;
    let x = -300;
    const colors = [p.a, p.b, p.c, p.base];
    while (x < 900) {
      const w = r.range(30, 110);
      body += `<rect x="${x.toFixed(1)}" y="-300" width="${w.toFixed(1)}" height="1200" fill="${r.pick(colors)}" opacity="${r.range(0.55, 0.95).toFixed(2)}"/>`;
      x += w + r.range(4, 24);
    }
    body += `</g><circle cx="${r.range(180, 420).toFixed(0)}" cy="${r.range(180, 420).toFixed(0)}" r="${r.range(70, 120).toFixed(0)}" fill="${p.base}" opacity="0.9"/>`;
    return { defs, body };
  },
  shards(r, p, uid) {
    const defs = `<linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    const step = 120;
    for (let y = 0; y < 600; y += step) {
      for (let x = 0; x < 600; x += step) {
        const j = () => r.range(-30, 30);
        const a = [x + j(), y + j()];
        const b = [x + step + j(), y + j()];
        const c = [x + j(), y + step + j()];
        const d = [x + step + j(), y + step + j()];
        const col1 = r.pick([p.a, p.b, p.c, p.base]);
        const col2 = r.pick([p.a, p.b, p.c, p.base]);
        body += `<polygon points="${a} ${b} ${c}" fill="${col1}" opacity="${r.range(0.35, 0.9).toFixed(2)}"/><polygon points="${b} ${d} ${c}" fill="${col2}" opacity="${r.range(0.35, 0.9).toFixed(2)}"/>`;
      }
    }
    return { defs, body };
  },
  rings(r, p) {
    const cx = r.range(200, 400);
    const cy = r.range(200, 400);
    let body = `<rect width="600" height="600" fill="${p.base}"/>`;
    const colors = [p.a, p.b, p.c];
    for (let i = 9; i >= 1; i--) {
      body += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${i * 46}" fill="${i % 2 ? colors[i % 3] : p.base}" opacity="${(0.35 + (9 - i) * 0.07).toFixed(2)}"/>`;
    }
    return { defs: '', body };
  },
  topo(r, p, uid) {
    const defs = `<linearGradient id="${uid}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset="1" stop-color="${p.b}" stop-opacity="0.75"/></linearGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    const centers = [
      [r.range(150, 300), r.range(150, 300)],
      [r.range(320, 480), r.range(320, 480)],
    ];
    centers.forEach(([cx, cy], ci) => {
      const wob = Array.from({ length: 6 }, () => r.range(0, Math.PI * 2));
      for (let k = 1; k <= 9; k++) {
        const radius = k * 26;
        let d = '';
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const rr = radius + Math.sin(t * 3 + wob[0]) * 9 + Math.sin(t * 5 + wob[1] + k) * 6;
          d += `${a === 0 ? 'M' : 'L'}${(cx + Math.cos(t) * rr).toFixed(1)} ${(cy + Math.sin(t) * rr).toFixed(1)} `;
        }
        body += `<path d="${d}Z" fill="none" stroke="${ci ? p.c : p.a}" stroke-width="${k % 3 === 0 ? 2.6 : 1.4}" opacity="${(0.85 - k * 0.06).toFixed(2)}"/>`;
      }
    });
    return { defs, body };
  },
  mesh(r, p, uid) {
    const defs = `<filter id="${uid}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>`;
    let body = `<rect width="600" height="600" fill="${p.base}"/><g filter="url(#${uid}blur)">`;
    const cols = [p.a, p.b, p.c, p.a, p.b];
    for (let i = 0; i < 5; i++) {
      body += `<circle cx="${r.range(0, 600).toFixed(0)}" cy="${r.range(0, 600).toFixed(0)}" r="${r.range(140, 260).toFixed(0)}" fill="${cols[i]}" opacity="${r.range(0.6, 0.95).toFixed(2)}"/>`;
    }
    body += '</g>';
    return { defs, body };
  },
  pixels(r, p) {
    const n = 10;
    const s = 600 / n;
    let body = `<rect width="600" height="600" fill="${p.base}"/>`;
    const cols = [p.a, p.b, p.c];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n / 2; x++) {
        if (!r.chance(0.5)) continue;
        const c = r.pick(cols);
        body += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="${c}"/><rect x="${(n - 1 - x) * s}" y="${y * s}" width="${s}" height="${s}" fill="${c}"/>`;
      }
    }
    for (let i = 0; i <= n; i++) {
      body += `<line x1="${i * s}" y1="0" x2="${i * s}" y2="600" stroke="${p.base}" stroke-width="4"/><line x1="0" y1="${i * s}" x2="600" y2="${i * s}" stroke="${p.base}" stroke-width="4"/>`;
    }
    return { defs: '', body };
  },
  lanterns(r, p, uid) {
    const defs = `<linearGradient id="${uid}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset="1" stop-color="${p.c}" stop-opacity="0.6"/></linearGradient><radialGradient id="${uid}glow"><stop offset="0" stop-color="${p.b}"/><stop offset="0.35" stop-color="${p.a}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></radialGradient>`;
    let body = `<rect width="600" height="600" fill="url(#${uid}bg)"/>`;
    for (let i = 0; i < 14; i++) {
      const x = r.range(30, 570);
      const y = r.range(40, 420);
      const rad = r.range(14, 60) * (0.4 + y / 600);
      body += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(rad * 2.4).toFixed(1)}" fill="url(#${uid}glow)" opacity="0.8"/><rect x="${(x - rad * 0.45).toFixed(1)}" y="${(y - rad * 0.6).toFixed(1)}" width="${(rad * 0.9).toFixed(1)}" height="${(rad * 1.2).toFixed(1)}" rx="${(rad * 0.3).toFixed(1)}" fill="${p.b}" opacity="0.95"/>`;
    }
    for (let i = 0; i < 9; i++) {
      const y = 470 + i * 14;
      body += `<line x1="${r.range(40, 200).toFixed(0)}" y1="${y}" x2="${r.range(400, 560).toFixed(0)}" y2="${y}" stroke="${p.a}" stroke-width="3" stroke-linecap="round" opacity="${(0.5 - i * 0.04).toFixed(2)}"/>`;
    }
    return { defs, body };
  },
  grid(r, p, uid) {
    const defs = `<radialGradient id="${uid}g" cx="0.65" cy="0.35" r="0.6"><stop offset="0" stop-color="${p.a}" stop-opacity="0.85"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></radialGradient>`;
    let body = `<rect width="600" height="600" fill="${p.base}"/><rect width="600" height="600" fill="url(#${uid}g)"/>`;
    for (let i = 0; i <= 600; i += 40) {
      body += `<line x1="${i}" y1="0" x2="${i}" y2="600" stroke="${p.a}" stroke-opacity="0.18"/><line x1="0" y1="${i}" x2="600" y2="${i}" stroke="${p.a}" stroke-opacity="0.18"/>`;
    }
    for (let i = 0; i < 36; i++) {
      const x = r.int(0, 15) * 40;
      const y = r.int(0, 15) * 40;
      body += `<rect x="${x + 2}" y="${y + 2}" width="36" height="36" fill="${r.pick([p.a, p.b, p.c])}" opacity="${r.range(0.25, 0.9).toFixed(2)}"/>`;
    }
    body += `<path d="M90 420 L210 300 L300 360 L420 210 L510 250" fill="none" stroke="${p.c}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>`;
    return { defs, body };
  },
};

function textBlock(title?: string, subtitle?: string): string {
  if (!title) return '';
  const size = title.length > 16 ? 50 : title.length > 11 ? 60 : 72;
  return `<g font-family="Plus Jakarta Sans Variable, ui-sans-serif, system-ui, sans-serif"><rect y="400" width="600" height="200" fill="url(#shade)"/>${
    subtitle ? `<text x="40" y="${520 - size}" fill="#ffffff" fill-opacity="0.8" font-size="26" font-weight="600" letter-spacing="3">${esc(subtitle.toUpperCase())}</text>` : ''
  }<text x="40" y="548" fill="#ffffff" font-size="${size}" font-weight="800" letter-spacing="-1">${esc(title)}</text></g>`;
}

export function coverSvg(opts: CoverOptions): string {
  const rng = createRng(`${opts.seed}:${opts.style}`);
  const uid = `c${hashString(opts.seed).toString(36)}`;
  const { defs, body } = painters[opts.style](rng, opts.palette, uid);
  const shade = opts.title
    ? `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs>${defs}${shade}${grain(`${uid}n`)}</defs>${body}<rect width="600" height="600" filter="url(#${uid}n)"/>${textBlock(opts.title, opts.subtitle)}</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function coverDataUrl(opts: CoverOptions): string {
  const key = `${opts.seed}|${opts.style}|${opts.palette.a}${opts.palette.b}|${opts.title ?? ''}|${opts.subtitle ?? ''}`;
  let url = cache.get(key);
  if (!url) {
    url = svgToDataUrl(coverSvg(opts));
    cache.set(key, url);
  }
  return url;
}

/** Abstract artist portrait: a duotone head-and-shoulders silhouette over a gradient. */
export function artistDataUrl(seed: string, palette: Palette): string {
  const key = `artist|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = createRng(`artist:${seed}`);
  const uid = `a${hashString(seed).toString(36)}`;
  const tilt = r.range(-6, 6);
  const headY = r.range(230, 260);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs><linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.a}"/><stop offset="1" stop-color="${palette.b}"/></linearGradient><linearGradient id="${uid}fig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.base}" stop-opacity="0.95"/><stop offset="1" stop-color="${palette.base}" stop-opacity="0.75"/></linearGradient><radialGradient id="${uid}rim" cx="0.3" cy="0.3" r="0.7"><stop offset="0" stop-color="${palette.c}" stop-opacity="0.65"/><stop offset="1" stop-color="${palette.c}" stop-opacity="0"/></radialGradient>${grain(`${uid}n`)}</defs><rect width="600" height="600" fill="url(#${uid}bg)"/><circle cx="${r.range(380, 480).toFixed(0)}" cy="${r.range(110, 200).toFixed(0)}" r="${r.range(70, 130).toFixed(0)}" fill="${palette.c}" opacity="0.35"/><g transform="rotate(${tilt.toFixed(1)} 300 400)"><path d="M90 640 C110 470 200 410 300 410 C400 410 490 470 510 640 Z" fill="url(#${uid}fig)"/><rect x="262" y="${(headY + 70).toFixed(0)}" width="76" height="90" rx="30" fill="url(#${uid}fig)"/><ellipse cx="300" cy="${headY.toFixed(0)}" rx="${r.range(78, 92).toFixed(0)}" ry="${r.range(96, 108).toFixed(0)}" fill="url(#${uid}fig)"/><ellipse cx="300" cy="${headY.toFixed(0)}" rx="90" ry="104" fill="url(#${uid}rim)"/></g><rect width="600" height="600" filter="url(#${uid}n)"/></svg>`;
  const url = svgToDataUrl(svg);
  cache.set(key, url);
  return url;
}
