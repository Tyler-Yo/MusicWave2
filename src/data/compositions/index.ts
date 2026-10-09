import type { Composition } from '@/audio/synth/types';
import { paperLanterns } from './paperLanterns';
import { overclocked } from './overclocked';
import { goldenHourRadio } from './goldenHourRadio';
import { nightDriveProtocol } from './nightDriveProtocol';
import { harborLights } from './harborLights';
import {
  blueHourWalk,
  cartridgeHearts,
  coastlineArcade,
  glassAurora,
  lanternReprise,
  morningKettle,
  rainyWindowStudy,
  staticBloom,
  theLongMeridian,
  tidalMemory,
  undercurrent,
} from './instrumentals';

/** Every procedural composition, keyed by id. */
export const COMPOSITIONS: Record<string, Composition> = Object.fromEntries(
  [
    paperLanterns,
    overclocked,
    goldenHourRadio,
    nightDriveProtocol,
    harborLights,
    rainyWindowStudy,
    tidalMemory,
    staticBloom,
    cartridgeHearts,
    theLongMeridian,
    blueHourWalk,
    undercurrent,
    morningKettle,
    glassAurora,
    coastlineArcade,
    lanternReprise,
  ].map((c) => [c.id, c]),
);

/** Compositions that have lyrics (and therefore a generated .lrc file). */
export const LYRIC_COMPOSITIONS = Object.values(COMPOSITIONS).filter((c) => c.vocal);
