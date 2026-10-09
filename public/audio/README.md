# Your audio files

Drop MP3 / M4A / OGG / WAV / FLAC files in this folder and reference them from
`src/data/catalog.ts` with `source: { kind: 'url', url: '/audio/<file name>' }`.
Files here are served as-is by Vite (dev) and copied into `dist/audio` on build.

See the main README → "Use your own music and lyrics" for a complete example.
