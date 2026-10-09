/** Mix constants shared by the JS stem mixer and the Web Audio renderer. */
import type { Instrument } from './types';

export type Bus = 'drums' | 'bass' | 'pad' | 'keys' | 'pluck' | 'arp' | 'lead' | 'bell' | 'vocal';

export const ALL_BUSES: Bus[] = ['drums', 'bass', 'pad', 'keys', 'pluck', 'arp', 'lead', 'bell', 'vocal'];

export const INST_BUS: Record<Instrument, Bus> = {
  kick: 'drums',
  snare: 'drums',
  clap: 'drums',
  hat: 'drums',
  openhat: 'drums',
  shaker: 'drums',
  rim: 'drums',
  tom: 'drums',
  crash: 'drums',
  bass: 'bass',
  pad: 'pad',
  keys: 'keys',
  pluck: 'pluck',
  arp: 'arp',
  lead: 'lead',
  bell: 'bell',
};

export const REVERB_SEND: Record<Bus, number> = {
  drums: 0.1,
  bass: 0,
  pad: 0.55,
  keys: 0.35,
  pluck: 0.3,
  arp: 0.35,
  lead: 0.35,
  bell: 0.6,
  vocal: 0.38,
};

export const DELAY_SEND: Record<Bus, number> = {
  drums: 0,
  bass: 0,
  pad: 0,
  keys: 0.12,
  pluck: 0.1,
  arp: 0.25,
  lead: 0.4,
  bell: 0.35,
  vocal: 0.28,
};

export const BUS_PAN: Record<Bus, number> = {
  drums: 0,
  bass: 0,
  pad: 0,
  keys: 0.12,
  pluck: -0.22,
  arp: 0.28,
  lead: -0.08,
  bell: 0.32,
  vocal: 0,
};

export const DRUM_LEVEL: Partial<Record<Instrument, number>> = {
  kick: 1,
  snare: 0.72,
  clap: 0.6,
  hat: 0.3,
  openhat: 0.22,
  shaker: 0.2,
  rim: 0.42,
  tom: 0.6,
  crash: 0.24,
};

export const DRUM_PAN: Partial<Record<Instrument, number>> = {
  hat: 0.22,
  openhat: 0.25,
  shaker: -0.3,
  rim: -0.12,
  tom: -0.15,
  crash: -0.2,
};

/** Buses that duck on every kick in styles with `pump`. */
export const PUMPED_BUSES: Bus[] = ['pad', 'keys', 'arp', 'pluck'];
