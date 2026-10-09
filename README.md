# MusicWave

An original music streaming web app whose flagship feature is **word-by-word synchronized lyrics**, including a karaoke mode and a tap-to-sync Lyrics Studio.

Built with React 18, TypeScript, Tailwind CSS and Vite. Every song, lyric, artist, cover and logo was made for this project:

- The 16 demo tracks are composed as data and **synthesized in your browser** (in a Web Worker), then played through a real HTML5 `<audio>` element.
- The 5 vocal songs ship with original LRC lyrics, and their guide vocal "sings" each syllable at its exact timestamp.

| Now Playing + synced lyrics | Karaoke mode |
| --- | --- |
| ![Now Playing](docs/screenshots/now-playing-lyrics.jpg) | ![Karaoke](docs/screenshots/karaoke-mode.jpg) |
| **Home (dark)** | **Lyrics Studio** |
| ![Home](docs/screenshots/home-dark.jpg) | ![Studio](docs/screenshots/lyrics-studio.jpg) |
| **Search inside lyrics** | **Light theme** |
| ![Search](docs/screenshots/search-lyrics.jpg) | ![Album, light theme](docs/screenshots/album-light.jpg) |

<p align="center"><img src="docs/screenshots/mobile-lyrics.jpg" width="300" alt="Mobile lyrics view"></p>

---

## Quick start

Requires Node 18.18 or newer (developed on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suites (82 tests) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run generate:lrc` | Regenerate the demo `.lrc` files from the song compositions |

> The first time you play a demo track it is synthesized in the background, which takes about 1–3 s on a typical laptop (a progress ring shows in the play button). While a song plays, the next one is pre-rendered, and the last 6 renders are cached in IndexedDB so replays start instantly.

`dist/` is a static single-page app. Deploy it to any static host with an SPA fallback to `index.html` (Netlify, Vercel, Cloudflare Pages, nginx `try_files`).

---

## Features

### Lyrics (the flagship)
- **Standard and enhanced LRC.** Supports `[mm:ss.xx]` lines, repeated timestamps (`[t1][t2]chorus`), `<mm:ss.xx>` word and syllable stamps, empty-line break markers, `[offset:]`, and ID tags. Plain untimed lyrics also work.
- **Word-by-word fill.** Each word fills with a soft-edged gradient as it is sung. If the file only has line timestamps, progress is **interpolated across the line**, weighted by syllable count.
- **Line states.** The active line is highlighted, past lines are dimmed, and the next line is previewed. Each line becomes active **0.32 s before it is sung**, so your eyes arrive first, but never while the previous line is still being sung.
- **Instrumental breaks** show animated interlude dots. Karaoke mode adds a **3-2-1 countdown** before the next line.
- **Auto-scroll** keeps the active line centered with a spring animation. Scrolling manually pauses it (with a "Back to live lyrics" button), and it resumes after 5 s.
- **Click any line to seek** there; the sync offset is taken into account.
- **Sync offset** in ±0.25 s steps (buttons, or the `[` / `]` keys), saved per song. A separate global **audio-latency compensation** setting handles Bluetooth headphones.
- **Karaoke mode:** large centered text, glowing sung words, a **bouncing ball** that hops from word to word, and countdowns.
- **Lyric search:** find text within the open song (highlighted matches you can step through), or search across all songs from Browse. Global results jump to the exact moment in the song.
- **Mini-player lyrics:** the current and next lines appear in the bottom bar on wide screens.
- **Lyrics Studio:**
  1. Paste lyrics.
  2. Tap Enter, T or ↓ on every line, or on every word for enhanced LRC. Backspace undoes; B marks an instrumental break.
  3. Fine-tune with the editable timestamps (±0.05 s nudges, "Set to now", "Sync from here"), or edit the raw LRC.
  4. Import or export `.lrc`, copy to the clipboard, or **save to the track**.

  A live preview uses the same sync engine as the player. Reaction-time compensation (default 120 ms) is subtracted from every tap.
- **Stays in sync** through seeks, pauses, playback-speed changes (0.5×–2×, pitch preserved) and track switches. Every frame is computed from the current time alone, so there is no state to drift.

### Player
- A mini player that expands into a full-screen **Now Playing** view with:
  - an ambient background that breathes with the music's loudness,
  - a spinning vinyl record,
  - a waveform seek bar.
- Play/pause, next/previous (previous restarts the song after 3 s), seek, volume, mute, shuffle, repeat (off → all → one) and playback speed.
- **Queue:** Up next, Play next / Add to queue, **drag-to-reorder** (mouse, touch and keyboard), remove, clear, and "Played this session".
- **Keyboard shortcuts:**

  | Keys | Action |
  | --- | --- |
  | Space | Play / pause |
  | ← / → | Seek 5 s (Shift: 15 s) |
  | N / P | Next / previous |
  | Shift + ↑ / ↓ | Volume |
  | M | Mute |
  | S | Shuffle |
  | R | Repeat |
  | L | Lyrics |
  | K | Karaoke |
  | Q | Queue |
  | [ / ] | Lyrics offset −/+ 0.25 s |
  | F | Like |
  | / | Search |
  | ? | Shortcut help |

- **OS media controls** via the Media Session API (lock screen, hardware media keys).
- **Resumes where you left off:** queue, position, volume, speed, shuffle and repeat are persisted.
- **Graceful errors:** loading failures show a toast and auto-skip; autoplay blocks and offline tracks are explained.

### Browse, Library and the rest
- **Home:** time-of-day greeting, quick picks, a Lyrics Lab spotlight, *Made for You* mixes computed from your history and likes, Recently Played, New Releases, Top Charts, genre shelves, featured playlists and artists. Carousels snap and have arrow buttons.
- **Search:** live results with 250 ms debounce and skeletons while typing. Covers songs, artists, albums, playlists, genres and **lyrics**, with typo tolerance and accent-insensitive matching. Browse tiles and recent searches show when the box is empty.
- **Library**, all persisted to localStorage:
  - **Playlists:** create, rename, delete, add and remove songs.
  - **Liked Songs**, saved albums, followed artists and recently played.
  - **Downloads**, with an **offline-mode** simulation: rendered audio is stored in IndexedDB, and in offline mode only downloaded and uploaded songs play.
  - **Uploads:** import your own audio files and attach `.lrc` files.
- Album, artist, playlist, mix, genre, charts and new-release pages.
- **Settings:** theme (dark, light or system), name, motion, vinyl artwork, karaoke, lyric size, latency compensation, offline mode, caches and reset.

### Design and accessibility
- An original identity: deep-ink backgrounds, "tide" teal, "iris" violet and "ember" coral; a custom wave logo; and the Plus Jakarta Sans typeface.
- Every cover, avatar and genre tile is **generated SVG art** (12 styles: synthwave horizon, topographic, lanterns, pixel and more).
- Dark mode by default plus a light theme. The Now Playing view stays immersive (album-tinted dark) in both.
- Responsive from 320 px phones to wide desktops: sidebar on desktop, bottom tab bar and compact player on mobile.
- Accessibility:
  - Semantic landmarks, a skip link, and labelled icon buttons, sliders and toggles.
  - Visible focus rings and keyboard support for everything, including drag-to-reorder.
  - Focus-trapped dialogs. The app becomes `inert` behind the full-screen player.
  - A live region announces track changes.
  - Reduced-motion support (system setting or in-app).
  - Body text and controls meet WCAG AA contrast; inactive lyric lines are deliberately dimmed so the active line stands out.

---

## Architecture

```
┌────────────────────────── UI (React components / pages) ─────────────────────────────┐
│ Home · Search · Library · Album/Artist/Playlist · Lyrics Studio · Settings           │
│ PlayerBar · NowPlaying · QueuePanel · LyricsView · MiniLyrics                        │
└──────────────┬───────────────────────────────────────┬───────────────────────────────┘
               │ selectors (useSyncExternalStore)      │ per-frame time (no re-render)
┌──────────────▼───────────────┐        ┌──────────────▼───────────────────────────────┐
│ state/  (tiny stores)        │        │ hooks/useLyricsSync ─▶ services/lrc/timing   │
│ player · library · settings  │        │   binary search active line, write --p on     │
│ lyrics overrides · ui        │        │   each word <span> every animation frame      │
│ persisted → localStorage     │        └──────────────▲───────────────────────────────┘
└──────────────┬───────────────┘                       │ clock.now()
               │ initPlayer() reconciles store ⇄ element│
┌──────────────▼────────────────────────────────────────┴───────────────────────────────┐
│ services/audioEngine  HTMLAudioElement + PlaybackClock (smooth, monotonic media time) │
│ services/audioSources  url │ upload (IndexedDB) │ synth (memory LRU → IndexedDB → worker)│
└──────────────┬───────────────────────────────────────────────────────────────────────┘
               │ renderCompositionAudio()
┌──────────────▼───────────────────────────────────────────────────────────────────────┐
│ audio/synth  (Web Worker pool, pure JS DSP)                                          │
│ composition ─▶ arrangement compiler ─▶ samples + voices ─▶ reverb/delay ─▶ WAV        │
│                     └─▶ timed lyrics ─▶ scripts/generate-lrc.ts ─▶ src/data/lyrics/*.lrc│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### File tree

```
musicwave/
├── index.html
├── package.json · vite.config.ts · tailwind.config.ts · postcss.config.js · eslint.config.js · tsconfig*.json
├── public/
│   ├── favicon.svg                 # original logo mark
│   └── audio/                      # drop your own MP3s here (served at /audio/…)
├── scripts/
│   └── generate-lrc.ts             # composition → .lrc files (keeps lyrics and audio identical)
├── docs/screenshots/               # images used in this README
├── tests/                          # Vitest: parser, timing, fixtures, engine, draft, search, queue, clock
└── src/
    ├── main.tsx · App.tsx · index.css        # entry, routes, design tokens + lyric styles
    ├── types/                      # Track, Album, Artist, Playlist, Genre, LyricLine, LyricWord, PlayerState…
    ├── data/
    │   ├── catalog.ts              # artists, albums, tracks, playlists, genres, palettes
    │   ├── compositions/           # 16 original songs as data (5 with lyrics)
    │   └── lyrics/*.lrc + index.ts # generated demo LRC files (auto-discovered)
    ├── audio/synth/
    │   ├── theory.ts               # keys, modes, roman-numeral chords, voicing
    │   ├── styles.ts               # 12 genre presets: grooves, patches, mix
    │   ├── arrangement.ts          # composition → note events + guide-vocal syllables + timed lyrics
    │   ├── samples.ts              # drums, piano/e-piano, Karplus–Strong guitar, bells, arps
    │   ├── dsp.ts                  # PolyBLEP oscillators, ZDF state-variable filter, FDN reverb, delay
    │   ├── engine.ts               # mixes everything → stereo PCM → WAV + waveform/energy analysis
    │   ├── synthWorker.ts · client.ts  # Web Worker + priority pool (foreground pre-empts prefetch)
    │   └── lyricsExport.ts         # arrangement → LRC (used by the generator and tests)
    ├── services/
    │   ├── lrc/                    # parser · serializer · timing (timeline, interpolation) · syllables · draft (Studio)
    │   ├── audioEngine.ts          # <audio> wrapper + PlaybackClock
    │   ├── playbackTicker.ts       # one shared rAF loop that fans out the clock
    │   ├── audioSources.ts         # resolve/prefetch/download audio, caches
    │   ├── offlineStore.ts · storage.ts   # IndexedDB · versioned localStorage
    │   ├── catalog.ts · search.ts · recommendations.ts · lyrics.ts · uploads.ts
    ├── state/                      # createStore + player / queue / library / settings / lyrics / ui stores
    ├── hooks/                      # usePlaybackTime, useLyricsSync, useLyrics, useKeyboardShortcuts, useMediaSession…
    ├── providers/AppProviders.tsx  # theme + player binding + shortcuts + media session
    ├── components/
    │   ├── layout/                 # AppShell, Sidebar, TopBar, MobileNav, ThemeProvider
    │   ├── player/                 # PlayerBar, NowPlaying, Controls, SeekBar, VolumeControl, SpeedMenu, Queue*
    │   ├── lyrics/                 # LyricsView, LyricLine, LyricsToolbar, MiniLyrics
    │   ├── cards/ · collection/ · dialogs/ · common/ · art/
    └── pages/                      # Home, Search, Genre, Album, Artist, Playlist, Mix, Charts,
                                    # NewReleases, Library, LyricsStudio, Settings, NotFound
```

---

## How lyric sync works

1. **Parsing** (`services/lrc/parser.ts`) produces lines and segments with absolute start and end times.
   - Line ends are explicit when possible (an enhanced end tag or a break marker). Otherwise they are estimated: lines that run into the next one end at that line's start, and lines followed by long gaps get a duration based on the song's typical line length.
   - Line-only LRC gets per-word timings spread by syllable weight, so the fill sweeps naturally and wraps correctly across multi-line text.
2. **Timeline** (`services/lrc/timing.ts`) interleaves lines with *interlude* items wherever there is at least a 4.5 s gap, and gives each item an activation time (with lead-in). Finding the active item is an O(log n) binary search.
3. **Clock** (`PlaybackClock`). Browsers update `currentTime` coarsely (`timeupdate` fires about 4×/s, and Firefox and Safari step it).
   - The clock extrapolates with `performance.now()` × `playbackRate`, gently slews toward each new reading, and re-anchors instantly on seek, pause, rate change and stalls.
   - It never runs backwards during playback, which would make words flicker.
4. **Rendering** (`useLyricsSync`). Each animation frame computes `lyricTime = mediaTime + offset` and writes `--p` (0…1) directly on the active line's word `<span>`s. React re-renders only when the active line changes. The fill itself is a CSS gradient with `background-clip: text`.

**Accuracy:**
- **Sample-accurate source data.** The guide vocal is rendered from the same arrangement data as the LRC files. Tests check that every isolated sung syllable starts within 40 ms of its timestamp; the median measured offset is +6 to +8 ms, which is just the attack ramp.
- **Browser checks.** In headless Chromium, the highlighted word matched the LRC on 100% of sampled frames at 1×, 0.75× and 1.5×, after backward seeks, and after pause/resume.

### The demo songs double as sync test cases

| Song | Scenario |
| --- | --- |
| **Paper Lanterns** (70 BPM ballad) | Slow, long held notes; three identical choruses |
| **Overclocked** (94 BPM boom-bap) | Fast rap at about 6 syllables/s with back-to-back lines; a sung hook; a 4-bar instrumental break |
| **Golden Hour Radio** (118 BPM pop) | Four repeated choruses (two back to back) and a riser build |
| **Night Drive Protocol** (104 BPM synthwave) | 18 s intro and a 37 s instrumental solo (interludes and countdowns) |
| **Harbor Lights** (86 BPM folk) | **Standard (line-level) LRC** with `[t1][t2][t3]` compressed choruses, so word progress is interpolated |

### All demo tracks

| Title | Artist | Genre | BPM | Length | Lyrics |
| --- | --- | --- | --- | --- | --- |
| Paper Lanterns | Lumen Vale | Piano & Ballads | 70 | 3:21 | Enhanced LRC |
| Lantern Reprise (Piano) | Lumen Vale | Piano & Ballads | 70 | 1:52 | — |
| Overclocked | Kassi Orbit | Hip-Hop | 94 | 3:16 | Enhanced LRC |
| Golden Hour Radio | The Paper Comets | Pop | 118 | 2:41 | Enhanced LRC |
| Night Drive Protocol | Neon Cartographer | Synthwave | 104 | 2:30 | Enhanced LRC |
| Coastline Arcade | Neon Cartographer | Synthwave | 100 | 2:16 | — |
| Harbor Lights | Wren & the Lowlands | Folk & Acoustic | 86 | 3:01 | Standard LRC |
| Rainy Window Study | Mossgarden | Lo-Fi Beats | 78 | 2:30 | — |
| Morning Kettle | Mossgarden | Lo-Fi Beats | 84 | 2:19 | — |
| Tidal Memory | Halcyon Drift | Ambient | 60 | 2:10 | — |
| Glass Aurora | Halcyon Drift | Ambient | 66 | 1:58 | — |
| Static Bloom | Voltage Choir | Electronic | 124 | 2:06 | — |
| Cartridge Hearts | Pixel Saints | Chiptune | 140 | 2:05 | — |
| The Long Meridian | Atlas Meridian | Cinematic | 72 | 2:15 | — |
| Blue Hour Walk | Blue Hour Quartet | Jazz-Hop | 88 | 2:13 | — |
| Undercurrent | Subtera | Electronic | 172 | 1:54 | — |

### How the music is made

A composition (`src/data/compositions/*.ts`) contains a tempo, key and mode, a genre style, and sections. Each section has roman-numeral chords, the active layers, and (for songs) lyric lines.

1. `arrangement.ts` compiles it into drums, bass lines, voice-led chords, strums, arpeggios, motif-based lead melodies, and a **guide vocal**. Each syllable gets a note: rhythm comes from the lyric's syllables, and pitch from a contour snapped to the chord tones.
2. The engine renders it with plain JavaScript DSP in a Web Worker:
   - one-shot samples are mixed directly into stereo stems;
   - pads, bass, lead and the formant "voice" are computed only while they sound;
   - an 8-line FDN reverb runs at half the sample rate;
   - then a ping-pong delay, loudness normalization and a soft limiter.
3. A 3-minute song takes about 1–3 s of CPU and becomes a 32 kHz / 16-bit WAV.

The guide vocal is a vowel-formant synth, not a human singer: it shows *exactly* when each word lands.

---

## Use your own music and lyrics

### Option 1 — in the app (no code)
1. **Library → Uploads → Import audio.** Pick MP3, M4A, OGG, WAV or FLAC files; they are stored privately in your browser (IndexedDB). Name them `Artist - Title.mp3` and the metadata is filled in automatically.
2. Click **Attach .lrc** on an upload, or open **Lyrics Studio** to paste the lyrics and tap along. Click **Save to track**.
3. The track now plays like any demo song: queue, playlists, offline, synced lyrics and karaoke.

You can also replace the lyrics of any demo song: Studio → *Save to track* (and *Revert* to undo).

### Option 2 — in the code (ships with your build)
1. Copy `my-song.mp3` into `public/audio/`.
2. Copy `my-song.lrc` into `src/data/lyrics/`. It is picked up automatically, keyed by its file name.
3. Add the artist, album and track to `src/data/catalog.ts`:

```ts
// in ARTISTS
{ id: 'my-artist', name: 'My Artist', genreIds: ['pop'], bio: '…', monthlyListeners: 1000, palette: PALETTES.golden },

// in ALBUMS
{
  id: 'my-album', title: 'My Album', artistId: 'my-artist', trackIds: ['my-song'],
  releaseDate: '2026-10-01', genreId: 'pop', type: 'single',
  palette: PALETTES.golden, coverStyle: 'bloom', description: '…', label: 'Self-released',
},

// in TRACKS (next to the synthTrack(...) entries)
{
  id: 'my-song',
  title: 'My Song',
  artistId: 'my-artist',
  albumId: 'my-album',
  trackNumber: 1,
  duration: 214,                                  // seconds (the seek bar uses the real value once loaded)
  genreId: 'pop',
  releaseDate: '2026-10-01',
  plays: 0,
  source: { kind: 'url', url: '/audio/my-song.mp3' },
  lyricsId: 'my-song',                            // → src/data/lyrics/my-song.lrc
},
```

`source.url` can also be an absolute URL. Remote files must be served with CORS enabled. To swap the demo catalog out completely, replace `TRACKS`, `ALBUMS`, `ARTISTS` and `PLAYLISTS`. The synth compositions are only used by tracks whose source is `{ kind: 'synth' }`.

To get a release-ready LRC, open the track in **Lyrics Studio**, tap-sync it, and use **Export .lrc**: per-line taps produce standard LRC, per-word taps produce enhanced LRC.

### LRC cheat sheet

The `# …` comments below are explanations, not LRC syntax.

```text
[ti:My Song]
[ar:My Artist]
[offset:+150]                         # optional: + shows lyrics earlier (milliseconds)
[00:12.40]A line of lyrics            # standard
[00:15.10][01:20.00]A repeated chorus # one line, several timestamps
[00:18.00]<00:18.00>Word <00:18.42>by <00:18.80>word<00:19.60>   # enhanced (A2); last tag = line end
[00:19.60]                            # empty line = instrumental break starts here
```

---

## Testing

```bash
npm test
```

82 tests cover:
- LRC parsing for every supported variant, plus serialization round-trips.
- Timeline lead-in and interludes, binary search, and word interpolation.
- The five lyric fixtures: committed `.lrc` files match the generator, and word times match the sung syllables.
- The stress scenarios: slow ballad, fast rap, repeated choruses, instrumental breaks, standard LRC.
- Real audio rendering, including a syllable-onset check, plus the WAV format.
- The Studio tap model, search ranking and typo tolerance, queue operations, and the playback clock (coarse updates, playback rate, seeks, stalls).

---

## Notes and limits

- The rendered WAV for a demo song is 15–26 MB. At most 4 are kept in memory and 6 in the IndexedDB cache; downloads are kept until you remove them.
- Background tabs throttle `requestAnimationFrame`, so lyrics pause their animation, but audio keeps playing and they resync instantly when you return.
- Use the global **audio-latency compensation** setting for Bluetooth speakers or headphones.
- A development-only debug handle (`window.__musicwave`) exists for automated QA; it is not included in production builds.

## Originality and licenses

- All music, compositions, lyrics, artist names, album names, artwork and the logo are original to this project.
- Icons: [Lucide](https://lucide.dev) (ISC).
- Font: Plus Jakarta Sans via Fontsource (SIL OFL 1.1).
- Drag and drop: dnd-kit (MIT).
