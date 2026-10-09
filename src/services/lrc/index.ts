export { parseLrc, lyricsFromLines } from './parser';
export { serializeLrc, type SerializeOptions } from './serializer';
export {
  buildTimeline,
  findActiveIndex,
  findLineAt,
  segmentProgress,
  interpolateWords,
  DEFAULT_TIMELINE,
} from './timing';
export { formatLrcTime, parseLooseTime } from './time';
export { countSyllables, splitSyllables } from './syllables';
