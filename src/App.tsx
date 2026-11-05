/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PRABHU'S BANANA: TROPICAL WATERCOLOR SPLAT
 * Complete Single-File React + Three.js + Web Audio Edition
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ============================================================================
// 1. PURE GAME RULES, SCORING, STREAKS, COMBOS & BANANA PEEL KINEMATICS
// ============================================================================
type GameState = 'title' | 'playing' | 'paused' | 'gameover';

type GameMode = 'arcade' | 'survival' | 'zen';

type FruitKind =
  | 'watermelon'
  | 'mango'
  | 'dragonfruit'
  | 'pineapple'
  | 'starfruit'
  | 'passionfruit'
  | 'durian_bomb';

type FlightArchetype =
  | 'parabolic_lob'
  | 'spiral_glider'
  | 'zigzag_darter'
  | 'heavy_mortar';

interface FruitSpec {
  kind: FruitKind;
  name: string;
  basePoints: number;
  radius: number;
  hitRadius: number;
  primaryColor: string;
  secondaryColor: string;
  splatRimColor: string;
  archetype: FlightArchetype;
  isHazard: boolean;
  gravityScale: number;
}

const FRUIT_SPECS: Record<FruitKind, FruitSpec> = {
  watermelon: {
    kind: 'watermelon',
    name: 'Watermelon',
    basePoints: 100,
    radius: 0.95,
    hitRadius: 1.45,
    primaryColor: '#ff2e55',
    secondaryColor: '#22c55e',
    splatRimColor: '#be123c',
    archetype: 'parabolic_lob',
    isHazard: false,
    gravityScale: 0.9,
  },
  mango: {
    kind: 'mango',
    name: 'Golden Mango',
    basePoints: 120,
    radius: 0.72,
    hitRadius: 1.25,
    primaryColor: '#ff9f1c',
    secondaryColor: '#ffbf69',
    splatRimColor: '#e05300',
    archetype: 'parabolic_lob',
    isHazard: false,
    gravityScale: 0.85,
  },
  dragonfruit: {
    kind: 'dragonfruit',
    name: 'Dragonfruit',
    basePoints: 160,
    radius: 0.78,
    hitRadius: 1.3,
    primaryColor: '#ff1f8f',
    secondaryColor: '#00f5d4',
    splatRimColor: '#9d0259',
    archetype: 'spiral_glider',
    isHazard: false,
    gravityScale: 0.72,
  },
  pineapple: {
    kind: 'pineapple',
    name: 'Royal Pineapple',
    basePoints: 200,
    radius: 0.88,
    hitRadius: 1.4,
    primaryColor: '#facc15',
    secondaryColor: '#10b981',
    splatRimColor: '#ca8a04',
    archetype: 'parabolic_lob',
    isHazard: false,
    gravityScale: 0.92,
  },
  starfruit: {
    kind: 'starfruit',
    name: 'Starfruit',
    basePoints: 250,
    radius: 0.7,
    hitRadius: 1.28,
    primaryColor: '#a3e635',
    secondaryColor: '#fef08a',
    splatRimColor: '#4d7c0f',
    archetype: 'zigzag_darter',
    isHazard: false,
    gravityScale: 0.65,
  },
  passionfruit: {
    kind: 'passionfruit',
    name: 'Passionfruit',
    basePoints: 140,
    radius: 0.68,
    hitRadius: 1.2,
    primaryColor: '#9333ea',
    secondaryColor: '#fbbf24',
    splatRimColor: '#581c87',
    archetype: 'spiral_glider',
    isHazard: false,
    gravityScale: 0.8,
  },
  durian_bomb: {
    kind: 'durian_bomb',
    name: 'Spore Durian Bomb',
    basePoints: -150,
    radius: 0.85,
    hitRadius: 1.15,
    primaryColor: '#65a30d',
    secondaryColor: '#ef4444',
    splatRimColor: '#365314',
    archetype: 'heavy_mortar',
    isHazard: true,
    gravityScale: 0.95,
  },
};

const NON_HAZARD_FRUITS: FruitKind[] = [
  'watermelon',
  'mango',
  'dragonfruit',
  'pineapple',
  'starfruit',
  'passionfruit',
];

interface ScoreState {
  score: number;
  bestScore: number;
  streak: number;
  maxStreak: number;
  combo: number;
  maxCombo: number;
  comboTimer: number; // seconds remaining before combo resets to 1
  comboMaxDuration: number;
  shotsFired: number;
  fruitsSplattered: number;
  multiSplats: number;
  lastCallout: string;
  lastPointsGained: number;
}

const COMBO_WINDOW_SECONDS = 2.8;
const MAX_COMBO_MULTIPLIER = 8;

function createInitialScoreState(bestScore = 0): ScoreState {
  return {
    score: 0,
    bestScore,
    streak: 0,
    maxStreak: 0,
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    comboMaxDuration: COMBO_WINDOW_SECONDS,
    shotsFired: 0,
    fruitsSplattered: 0,
    multiSplats: 0,
    lastCallout: '',
    lastPointsGained: 0,
  };
}

function getStreakBonusMultiplier(streak: number): number {
  if (streak >= 25) return 2.5;
  if (streak >= 15) return 2.0;
  if (streak >= 10) return 1.6;
  if (streak >= 5) return 1.3;
  if (streak >= 3) return 1.15;
  return 1.0;
}

function getComboCallout(combo: number, streak: number, multiHitCount: number): string {
  if (multiHitCount >= 3) return 'TRIPLE WATERCOLOR SUPERNOVA!';
  if (multiHitCount === 2) return 'DOUBLE PIGMENT SPLASH!';
  if (streak >= 20) return 'BANANA PICASSO!';
  if (combo >= 8) return '8X MASTERPIECE FRENZY!';
  if (combo >= 6) return '6X TROPICAL CHROMATIC!';
  if (combo >= 4) return '4X WATERCOLOR CASCADE!';
  if (combo >= 3) return '3X JUICY BRUSHSTROKE!';
  if (combo >= 2) return '2X COLOR SPLASH!';
  if (streak >= 5) return 'HOT STREAK!';
  return 'SPLAT!';
}

/**
 * Processes hitting one or more fruits with a single banana shot.
 */
function registerFruitHits(
  prev: ScoreState,
  hitKinds: FruitKind[],
): ScoreState {
  if (hitKinds.length === 0) {
    return prev;
  }

  // Check if any hit was a hazard
  const hitHazard = hitKinds.some((k) => FRUIT_SPECS[k].isHazard);
  if (hitHazard) {
    const nextScore = Math.max(0, prev.score - 150);
    return {
      ...prev,
      score: nextScore,
      bestScore: Math.max(prev.bestScore, nextScore),
      streak: 0,
      combo: 1,
      comboTimer: 0,
      lastCallout: 'DURIAN TOXIN! STREAK RESET',
      lastPointsGained: -150,
    };
  }

  let nextStreak = prev.streak;
  let nextCombo = prev.combo;
  let totalPointsGained = 0;

  // Was the combo window still active?
  const comboActive = prev.comboTimer > 0;

  for (let i = 0; i < hitKinds.length; i++) {
    const spec = FRUIT_SPECS[hitKinds[i]];
    nextStreak += 1;
    if (comboActive || i > 0 || nextStreak > 1) {
      nextCombo = Math.min(MAX_COMBO_MULTIPLIER, nextCombo + 1);
    } else {
      nextCombo = 1;
    }

    const streakMult = getStreakBonusMultiplier(nextStreak);
    const points = Math.round(spec.basePoints * nextCombo * streakMult);
    totalPointsGained += points;
  }

  // Multi-splat bonus for hitting >= 2 fruits in one banana burst
  if (hitKinds.length >= 2) {
    totalPointsGained += hitKinds.length * 75 * nextCombo;
  }

  const nextScore = prev.score + totalPointsGained;
  const nextBest = Math.max(prev.bestScore, nextScore);
  const nextMaxStreak = Math.max(prev.maxStreak, nextStreak);
  const nextMaxCombo = Math.max(prev.maxCombo, nextCombo);

  return {
    ...prev,
    score: nextScore,
    bestScore: nextBest,
    streak: nextStreak,
    maxStreak: nextMaxStreak,
    combo: nextCombo,
    maxCombo: nextMaxCombo,
    comboTimer: COMBO_WINDOW_SECONDS,
    comboMaxDuration: COMBO_WINDOW_SECONDS,
    fruitsSplattered: prev.fruitsSplattered + hitKinds.length,
    multiSplats: prev.multiSplats + (hitKinds.length >= 2 ? 1 : 0),
    lastCallout: getComboCallout(nextCombo, nextStreak, hitKinds.length),
    lastPointsGained: totalPointsGained,
  };
}

/**
 * Registers a shot that missed all mid-air targets.
 */
function registerMissedShot(prev: ScoreState): ScoreState {
  return {
    ...prev,
    streak: 0,
    combo: 1,
    comboTimer: 0,
    lastCallout: prev.streak >= 3 ? 'STREAK BROKEN' : '',
    lastPointsGained: 0,
  };
}

/**
 * Advances the combo timer by dt seconds.
 */
function stepComboTimer(prev: ScoreState, dt: number): ScoreState {
  if (prev.comboTimer <= 0) {
    if (prev.combo !== 1) {
      return { ...prev, combo: 1, comboTimer: 0 };
    }
    return prev;
  }
  const nextTimer = Math.max(0, prev.comboTimer - dt);
  if (nextTimer === 0) {
    return {
      ...prev,
      combo: 1,
      comboTimer: 0,
    };
  }
  return {
    ...prev,
    comboTimer: nextTimer,
  };
}

interface DifficultyParams {
  wave: number;
  spawnIntervalSec: number;
  burstMin: number;
  burstMax: number;
  hazardChance: number;
  speedScale: number;
  specialArchetypeWeight: number;
}

/**
 * Multi-knob difficulty ramp across play time.
 * Keeps the opening 10-15s approachable while scaling challenge smoothly.
 */
function getDifficultyParams(elapsedSec: number, mode: GameMode): DifficultyParams {
  const safeElapsed = Math.max(0, elapsedSec);
  const wave = Math.floor(safeElapsed / 18) + 1;
  const progress = Math.min(1, safeElapsed / 90); // 0 to 1 over 90s

  if (mode === 'zen') {
    return {
      wave,
      spawnIntervalSec: 1.55 - progress * 0.35,
      burstMin: 2,
      burstMax: 4,
      hazardChance: 0, // No hazards in Zen mode
      speedScale: 0.92 + progress * 0.15,
      specialArchetypeWeight: 0.35 + progress * 0.3,
    };
  }

  // Opening 12 seconds are extra welcoming
  const isOpening = safeElapsed < 12;

  return {
    wave,
    spawnIntervalSec: isOpening ? 1.65 : Math.max(0.78, 1.55 - progress * 0.72),
    burstMin: isOpening ? 2 : progress > 0.5 ? 2 : 1,
    burstMax: isOpening ? 3 : Math.min(5, 3 + Math.floor(progress * 2.5)),
    hazardChance: isOpening ? 0 : Math.min(0.22, 0.06 + progress * 0.16),
    speedScale: isOpening ? 0.9 : 0.95 + progress * 0.32,
    specialArchetypeWeight: isOpening ? 0.2 : Math.min(0.65, 0.25 + progress * 0.4),
  };
}

interface RunSummarySnapshot {
  mode: GameMode;
  victory: boolean;
  score: number;
  bestScore: number;
  maxStreak: number;
  maxCombo: number;
  fruitsSplattered: number;
  accuracyPercent: number;
  waveReached: number;
  durationSec: number;
}

function createRunSnapshot(
  scoreState: ScoreState,
  mode: GameMode,
  victory: boolean,
  waveReached: number,
  durationSec: number,
): RunSummarySnapshot {
  const accuracyPercent =
    scoreState.shotsFired > 0
      ? Math.min(100, Math.round((scoreState.fruitsSplattered / scoreState.shotsFired) * 100))
      : 100;

  return {
    mode,
    victory,
    score: Math.round(scoreState.score),
    bestScore: Math.round(scoreState.bestScore),
    maxStreak: scoreState.maxStreak,
    maxCombo: scoreState.maxCombo,
    fruitsSplattered: scoreState.fruitsSplattered,
    accuracyPercent,
    waveReached,
    durationSec: Math.round(durationSec),
  };
}

interface StripCurlAngles {
  lowerX: number;
  upperX: number;
}

interface BananaPeelPose {
  isPeeling: boolean;
  presentWeight: number; // 0..1 how much the banana moves center-frame for inspection/peeling
  inspectPitch: number;
  inspectYaw: number;
  inspectRoll: number;
  stemAngleX: number;
  pulpScale: number;
  strips: [StripCurlAngles, StripCurlAngles, StripCurlAngles, StripCurlAngles];
}

const PEEL_RELOAD_DURATION = 0.72;

/**
 * Pure kinematics calculator for the 4-strip Banana Peeling Reload Animation
 * and per-shot peel flare.
 */
function computeBananaPeelPose(
  reloadTimer: number,
  peelCharge: number,
  gunRecoil: number,
): BananaPeelPose {
  if (reloadTimer > 0) {
    const p = Math.max(0, Math.min(1, 1 - reloadTimer / PEEL_RELOAD_DURATION));

    // Smooth bell curve that brings the banana toward center view during peeling
    let presentWeight = 0;
    if (p < 0.22) {
      presentWeight = Math.sin((p / 0.22) * (Math.PI / 2));
    } else if (p < 0.78) {
      presentWeight = 1.0;
    } else {
      presentWeight = Math.cos(((p - 0.78) / 0.22) * (Math.PI / 2));
    }

    // Stem pull-tab snaps back at the start of the peel (p = 0.08..0.35)
    const stemPull = p < 0.35 ? Math.sin((p / 0.35) * Math.PI) * 0.95 : 0;

    // Staggered peeling of each of the 4 banana skin strips
    const strips = [0, 1, 2, 3].map((idx) => {
      const startP = 0.16 + idx * 0.11;
      const stripT = Math.max(0, Math.min(1, (p - startP) / 0.26));
      // Smooth step with slight overshoot bounce
      const ease = 1 - Math.pow(1 - stripT, 3);
      const bounce = stripT > 0 && stripT < 1 ? Math.sin(stripT * Math.PI) * 0.18 : 0;

      // At stripT = 0, strip is closed over the banana tip; at stripT = 1, peeled wide open
      const lowerX = -0.04 - (ease + bounce) * 0.68;
      const upperX = -0.06 - (ease + bounce * 1.4) * 1.18;
      return { lowerX, upperX };
    }) as [StripCurlAngles, StripCurlAngles, StripCurlAngles, StripCurlAngles];

    // Inner banana pulp emerges freshly as strips peel down
    const revealT = Math.max(0, Math.min(1, (p - 0.18) / 0.55));
    const pulpScale = 0.78 + 0.22 * Math.sin(revealT * (Math.PI / 2)) + (p > 0.75 ? Math.sin(((p - 0.75) / 0.25) * Math.PI) * 0.08 : 0);

    // Subtle tug motion as each strip tears down
    const tugJolt = p >= 0.16 && p <= 0.72 ? Math.sin((p - 0.16) * 28) * 0.09 : 0;

    return {
      isPeeling: true,
      presentWeight,
      inspectPitch: 0.42 * presentWeight + tugJolt,
      inspectYaw: 0.38 * presentWeight,
      inspectRoll: -0.25 * presentWeight + tugJolt * 0.6,
      stemAngleX: 0.45 - stemPull,
      pulpScale,
      strips,
    };
  }

  // Standard firing / aiming state: peel curls progressively further as shots are spent
  const spentRatio = Math.max(0, Math.min(1, (6 - peelCharge) / 5));
  const baseLower = -0.58 - spentRatio * 0.22 - gunRecoil * 0.38;
  const baseUpper = -0.95 - spentRatio * 0.35 - gunRecoil * 0.55;

  const defaultStrip: StripCurlAngles = {
    lowerX: baseLower,
    upperX: baseUpper,
  };

  return {
    isPeeling: false,
    presentWeight: 0,
    inspectPitch: 0,
    inspectYaw: 0,
    inspectRoll: 0,
    stemAngleX: 0.45 - gunRecoil * 0.75,
    pulpScale: 1.0 - spentRatio * 0.08,
    strips: [defaultStrip, defaultStrip, defaultStrip, defaultStrip],
  };
}

// ============================================================================
// 2. PROCEDURAL TROPICAL MARIMBA & JUNGLE AMBIENCE WEB AUDIO ENGINE
// ============================================================================
/**
 * 100% Procedural Web Audio API Engine for Tropical Jungle Ambience,
 * Upbeat Marimba / Steel-Pan Background Music, and Juicy Watercolor Splat SFX.
 */

class TropicalAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isMuted = false;
  private isPlayingLoop = false;
  private stepTimer: number | null = null;
  private birdTimer: number | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private stepIndex = 0;

  // Tropical Pentatonic / Calypso scale in F Major / D Minor (frequencies in Hz)
  // F4, G4, A4, C5, D5, F5, G5, A5
  private readonly melodyNotes = [
    349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99, 880.00,
  ];

  // Syncopated 16-step marimba pattern (-1 = rest)
  private readonly marimbaPattern = [
    0, -1, 2, 3, -1, 4, 3, -1,
    5, -1, 4, 2, -1, 3, 1, 0,
  ];

  // Warm bassline pattern (F2, C3, D3, C3)
  private readonly bassNotes = [
    87.31, 87.31, 130.81, 130.81,
    146.83, 146.83, 130.81, 98.00,
  ];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.28;
      this.musicGain.connect(this.masterGain);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.25;
      this.ambienceGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.75;
      this.sfxGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.04);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Starts tropical background marimba loop + ambient jungle soundscape (breeze + exotic birds).
   */
  public startLoops(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isPlayingLoop) return;
    this.isPlayingLoop = true;

    this.startJungleWind(ctx);

    // 135 BPM 16th-note groove (~111ms per 16th step, or 180ms per 8th groove)
    this.stepIndex = 0;
    this.stepTimer = window.setInterval(() => {
      if (!this.isPlayingLoop || this.isMuted) return;
      this.playMusicStep();
    }, 175);

    // Ambient tropical bird calls & tree frogs every 2.2 - 4.5 seconds
    const scheduleNextBird = () => {
      if (!this.isPlayingLoop) return;
      const delay = 2100 + Math.random() * 2400;
      this.birdTimer = window.setTimeout(() => {
        if (this.isPlayingLoop && !this.isMuted) {
          this.playTropicalBirdCall();
        }
        scheduleNextBird();
      }, delay);
    };
    scheduleNextBird();
  }

  /**
   * Stops background music and ambient loops (on Pause / GameOver / Unmount).
   */
  public stopLoops(): void {
    this.isPlayingLoop = false;
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.birdTimer !== null) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.windSource) {
      try {
        this.windSource.stop();
        this.windSource.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.windSource = null;
    }
  }

  private startJungleWind(ctx: AudioContext): void {
    if (!this.ambienceGain) return;
    try {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Soft pink-ish breeze filter
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 0.35;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 1.8;

      // Slow LFO to sweep the wind through palm fronds
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.18;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      noise.connect(filter);
      filter.connect(this.ambienceGain);
      noise.start();
      this.windSource = noise;
    } catch {
      // Ignore audio buffer issues
    }
  }

  private playMusicStep(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;

    const now = ctx.currentTime;
    const step = this.stepIndex % 16;
    this.stepIndex++;

    // 1. Wooden Marimba Note
    const noteIdx = this.marimbaPattern[step];
    if (noteIdx >= 0) {
      const freq = this.melodyNotes[noteIdx];
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      // Marimba uses sine fundamental + 4th harmonic wood overtone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 4, now);

      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.12, now);
      harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      harmonic.connect(harmGain);
      harmGain.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      harmonic.start(now);
      osc.stop(now + 0.17);
      harmonic.stop(now + 0.05);
    }

    // 2. Warm Tropical Bass on even steps
    if (step % 2 === 0) {
      const bassFreq = this.bassNotes[(step / 2) % this.bassNotes.length];
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassGain.gain.setValueAtTime(0.001, now);
      bassGain.gain.linearRampToValueAtTime(0.26, now + 0.015);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);

      bassOsc.start(now);
      bassOsc.stop(now + 0.3);
    }

    // 3. Bamboo Shaker / Woodblock Percussion
    if (step % 4 === 2) {
      const woodOsc = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodOsc.type = 'sine';
      woodOsc.frequency.setValueAtTime(980, now);
      woodOsc.frequency.exponentialRampToValueAtTime(620, now + 0.035);

      woodGain.gain.setValueAtTime(0.12, now);
      woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      woodOsc.connect(woodGain);
      woodGain.connect(this.musicGain);
      woodOsc.start(now);
      woodOsc.stop(now + 0.045);
    }
  }

  /**
   * Synthesizes an exotic tropical bird chirp / toucan call or tree-frog trill.
   */
  public playTropicalBirdCall(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain || this.isMuted) return;

    const now = ctx.currentTime;
    const callType = Math.random();

    if (callType < 0.65) {
      // Double exotic songbird warble
      for (let i = 0; i < 2; i++) {
        const start = now + i * 0.16;
        const baseFreq = 1650 + Math.random() * 650;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, start);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, start + 0.06);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, start + 0.13);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

        osc.connect(gain);
        gain.connect(this.ambienceGain);
        osc.start(start);
        osc.stop(start + 0.15);
      }
    } else {
      // Tropical kookaburra / tree-frog resonant trill
      for (let i = 0; i < 3; i++) {
        const start = now + i * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(720 + i * 90, start);
        osc.frequency.exponentialRampToValueAtTime(1180 + i * 110, start + 0.055);

        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);

        osc.connect(gain);
        gain.connect(this.ambienceGain);
        osc.start(start);
        osc.stop(start + 0.07);
      }
    }
  }

  /**
   * Banana Blaster Shot SFX: Comic peel-pop + crisp potassium laser thwip with ±8% pitch variation.
   */
  public playBananaShoot(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const now = ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16; // ±8% variation

    // Pop transient
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(780 * pitchVar, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(140 * pitchVar, now + 0.14);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Watercolor Fruit Explosion SFX: Wet lush paintbrush/water-balloon burst + combo-pitched chime!
   */
  public playFruitSplat(combo = 1, streak = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const now = ctx.currentTime;

    // 1. Wet Watercolor Splash Noise Burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.24);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.22);
    filter.Q.value = 2.2;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.55, now);
    splashGain.gain.exponentialRampToValueAtTime(0.01, now + 0.23);

    noise.connect(filter);
    filter.connect(splashGain);
    splashGain.connect(this.sfxGain);
    noise.start(now);

    // 2. Liquid Droplet Bubbles (3 quick ascending blips)
    for (let i = 0; i < 3; i++) {
      const dropStart = now + i * 0.032;
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const baseF = 420 + i * 160 + Math.min(12, streak) * 35;

      dropOsc.type = 'sine';
      dropOsc.frequency.setValueAtTime(baseF, dropStart);
      dropOsc.frequency.exponentialRampToValueAtTime(baseF * 1.65, dropStart + 0.055);

      dropGain.gain.setValueAtTime(0.28, dropStart);
      dropGain.gain.exponentialRampToValueAtTime(0.001, dropStart + 0.065);

      dropOsc.connect(dropGain);
      dropGain.connect(this.sfxGain);
      dropOsc.start(dropStart);
      dropOsc.stop(dropStart + 0.07);
    }

    // 3. Combo Harmonic Chime (rises with combo multiplier)
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    const scaleIdx = Math.min(this.melodyNotes.length - 1, combo - 1);
    const chimeFreq = this.melodyNotes[scaleIdx] * (streak >= 10 ? 1.5 : 1);

    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(chimeFreq, now);

    chimeGain.gain.setValueAtTime(0.32, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chimeOsc.start(now);
    chimeOsc.stop(now + 0.34);
  }

  /**
   * Hazard / Durian Bomb Hit SFX: Low dissonant thud & fizzle.
   */
  public playHazardHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  /**
   * Reload Banana Peel Zip SFX: 3 sequential fibrous peel-tear zips + fresh potassium chime!
   */
  public playReloadPeel(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const now = ctx.currentTime;

    // 3 sequential peel strip un-zipping sounds
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 + i * 90, start);
      osc.frequency.exponentialRampToValueAtTime(680 + i * 160, start + 0.11);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.26, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.13);
    }

    // Final crisp banana snap-ready pop
    const popStart = now + 0.45;
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(520, popStart);
    popOsc.frequency.exponentialRampToValueAtTime(1046.5, popStart + 0.09);

    popGain.gain.setValueAtTime(0.32, popStart);
    popGain.gain.exponentialRampToValueAtTime(0.001, popStart + 0.11);

    popOsc.connect(popGain);
    popGain.connect(this.sfxGain);
    popOsc.start(popStart);
    popOsc.stop(popStart + 0.12);
  }

  /**
   * Victory / Round Complete Fanfare.
   */
  public playVictoryFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const notes = [349.23, 440.0, 523.25, 698.46];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.32, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }
}

const tropicalAudio = new TropicalAudioEngine();

// ============================================================================
// 3. PROCEDURAL WATERCOLOR & TROPICAL FRUIT CANVAS TEXTURES
// ============================================================================
/**
 * Generates an organic wet-on-wet watercolor blotch texture with
 * translucent inner wash, feathered edges, coffee-ring pigment pooling,
 * and fine radial paint droplets.
 */
function createWatercolorBlotchTexture(
  primaryColor: string,
  secondaryColor: string,
  rimColor: string,
  seed = 0,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * 0.31;

  // Deterministic pseudo-random helper from seed
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  ctx.clearRect(0, 0, size, size);

  // 1. Soft outer bleed wash
  const outerGrad = ctx.createRadialGradient(cx, cy, baseR * 0.1, cx, cy, baseR * 1.45);
  outerGrad.addColorStop(0, primaryColor);
  outerGrad.addColorStop(0.55, secondaryColor);
  outerGrad.addColorStop(0.82, rimColor);
  outerGrad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  const lobes = 18;
  for (let i = 0; i <= lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const wobble =
      1 +
      0.22 * Math.sin(angle * 3 + seed) +
      0.14 * Math.cos(angle * 5 - seed * 2) +
      0.08 * Math.sin(angle * 9 + seed);
    const r = baseR * wobble;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = outerGrad;
  ctx.fill();

  // 2. Watercolor "Coffee-Ring" dark pigment edge pooling
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = rimColor;
  ctx.globalAlpha = 0.65;
  ctx.stroke();
  ctx.restore();

  // 3. Overlapping Secondary Wet Wash Blooms
  for (let b = 0; b < 5; b++) {
    const angle = (b / 5) * Math.PI * 2 + rand() * 0.8;
    const dist = baseR * (0.28 + rand() * 0.35);
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist;
    const br = baseR * (0.38 + rand() * 0.28);

    const bGrad = ctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
    bGrad.addColorStop(0, b % 2 === 0 ? primaryColor : secondaryColor);
    bGrad.addColorStop(0.75, primaryColor);
    bGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Radial Paint Spatter Droplets & Expressive Watercolor Brush Streaks
  for (let d = 0; d < 36; d++) {
    const angle = rand() * Math.PI * 2;
    const dist = baseR * (0.78 + rand() * 0.72);
    const dx = cx + Math.cos(angle) * dist;
    const dy = cy + Math.sin(angle) * dist;
    const dr = 2.4 + rand() * 7.2;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(angle);
    // Alternate between elongated brushstroke rays and teardrop droplets
    ctx.scale(d % 3 === 0 ? 2.4 : 1.4, d % 3 === 0 ? 0.48 : 0.82);
    ctx.globalAlpha = 0.72 + rand() * 0.26;
    ctx.fillStyle = d % 3 === 0 ? secondaryColor : d % 2 === 0 ? primaryColor : rimColor;
    ctx.beginPath();
    ctx.arc(0, 0, dr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates an expanding watercolor shockwave ring texture.
 */
function createWatercolorRingTexture(
  primaryColor: string,
  rimColor: string,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.48);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, primaryColor);
  grad.addColorStop(0.82, rimColor);
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates procedural Banana Peel texture with ripe golden yellow hue and organic brown sugar speckles.
 */
function createBananaSkinTexture(maxAnisotropy = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#fde047');
  grad.addColorStop(0.12, '#facc15');
  grad.addColorStop(0.88, '#eab308');
  grad.addColorStop(1, '#713f12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle longitudinal ridges
  ctx.strokeStyle = 'rgba(161, 98, 7, 0.22)';
  ctx.lineWidth = 3;
  for (let x = 16; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Ripe banana sugar spots
  ctx.fillStyle = 'rgba(113, 63, 18, 0.38)';
  for (let i = 0; i < 45; i++) {
    const sx = (i * 73) % 256;
    const sy = (i * 137) % 256;
    const sr = 1.5 + (i % 3);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates Watermelon striped rind texture.
 */
function createWatermelonRindTexture(maxAnisotropy = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#86efac';
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 16) {
      const wave = Math.sin(y * 0.08 + x) * 4;
      if (y === 0) ctx.moveTo(x + wave, y);
      else ctx.lineTo(x + wave, y);
    }
    for (let y = 256; y >= 0; y -= 16) {
      const wave = Math.sin(y * 0.08 + x + 1) * 4;
      ctx.lineTo(x + 12 + wave, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates Pineapple diamond-scale rind texture.
 */
function createPineappleTexture(maxAnisotropy = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 4;
  const step = 32;
  for (let i = -256; i < 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + 256, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }

  // Highlight eyes inside diamonds
  ctx.fillStyle = '#fef08a';
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates seamlessly tileable tropical mossy clearing ground texture + grayscale bump map.
 */
function createJungleGroundTextures(maxAnisotropy = 1): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#155e34';
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Seamlessly tiled dappled sunlit moss patches (wrapped across all 9 tile neighbors)
  for (let i = 0; i < 140; i++) {
    const baseX = (i * 197) % size;
    const baseY = (i * 313) % size;
    const r = 24 + (i % 44);

    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x = baseX + ox;
        const y = baseY + oy;
        if (x + r < 0 || x - r > size || y + r < 0 || y - r > size) continue;

        const grad = cCtx.createRadialGradient(x, y, 2, x, y, r);
        if (i % 5 === 0) {
          grad.addColorStop(0, 'rgba(163, 230, 53, 0.22)');
          grad.addColorStop(1, 'rgba(21, 94, 52, 0)');
        } else if (i % 2 === 0) {
          grad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
          grad.addColorStop(1, 'rgba(21, 94, 52, 0)');
        } else {
          grad.addColorStop(0, 'rgba(13, 66, 36, 0.32)');
          grad.addColorStop(1, 'rgba(21, 94, 52, 0)');
        }
        cCtx.fillStyle = grad;
        cCtx.beginPath();
        cCtx.arc(x, y, r, 0, Math.PI * 2);
        cCtx.fill();

        bCtx.fillStyle = i % 2 === 0 ? 'rgba(200,200,200,0.3)' : 'rgba(65,65,65,0.3)';
        bCtx.beginPath();
        bCtx.arc(x, y, r * 0.55, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 6);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 6);

  return { map, bumpMap };
}

// ============================================================================
// 4. 3D BANANA BLASTER (WITH 4-STRIP PEEL RELOAD), FRUITS & JUNGLE GLADE
// ============================================================================
interface PeelStripRig {
  pivot: THREE.Group;
  baseAngle: number;
  lowerMesh: THREE.Mesh;
  upperPivot: THREE.Group;
  upperMesh: THREE.Mesh;
}

interface BananaGunRig {
  root: THREE.Group;
  aimPivot: THREE.Group;
  muzzlePoint: THREE.Object3D;
  peelPetals: THREE.Mesh[];
  peelStrips: PeelStripRig[];
  innerPulpBarrel: THREE.Mesh;
  stemHammer: THREE.Mesh;
  muzzleFlash: THREE.Mesh;
  juiceCore: THREE.Mesh;
}

/**
 * Builds the articulated First-Person "Banana Blaster" model:
 * - Wrapped in `aimPivot` so it dynamically tracks the 3D crosshair target
 * - 4 multi-segment articulated Banana Peel Strips (`peelStrips`) that close around
 *   the barrel and physically peel/curl down from the tip during the reload animation!
 * - Exposed creamy banana pulp inner barrel with longitudinal ridges
 * - Fibrous banana stem rear sight / pull-tab that snaps back to initiate the peel
 * - Bamboo & jungle-vine tactical grip + glowing potassium-watercolor chamber
 */
function createBananaGunModel(maxAnisotropy = 1): BananaGunRig {
  const root = new THREE.Group();
  const aimPivot = new THREE.Group();
  root.add(aimPivot);

  const bananaSkinTex = createBananaSkinTexture(maxAnisotropy);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bananaSkinTex,
    roughness: 0.38,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const innerPeelMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const innerPulpMat = new THREE.MeshStandardMaterial({
    color: 0xfefce8,
    emissive: 0xfde047,
    emissiveIntensity: 0.18,
    roughness: 0.52,
    metalness: 0.02,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.88,
    metalness: 0.05,
  });

  const bambooGripMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.75,
    metalness: 0.1,
  });

  const vineMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.55,
    metalness: 0.05,
  });

  // 1. Primary Silhouette: Curved Banana Receiver & Grip Hull
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.36, 0.25),   // Bottom grip pommel
    new THREE.Vector3(0, -0.11, 0.15),   // Mid grip
    new THREE.Vector3(0, 0.08, -0.02),   // Receiver curve
    new THREE.Vector3(0, 0.14, -0.34),   // Mid barrel jacket
  ]);

  const bodyGeo = new THREE.TubeGeometry(curve, 24, 0.088, 7, false);
  const posAttr = bodyGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y < -0.25) {
      const factor = Math.max(0.55, 1 - ((-0.25 - y) / 0.12) * 0.45);
      posAttr.setX(i, posAttr.getX(i) * factor);
    }
  }
  bodyGeo.computeVertexNormals();
  const bananaHull = new THREE.Mesh(bodyGeo, skinMat);
  aimPivot.add(bananaHull);

  // 2. Creamy Inner Banana Pulp Core Barrel (revealed when the peel strips curl back!)
  const pulpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.13, -0.28),
    new THREE.Vector3(0, 0.155, -0.52),
    new THREE.Vector3(0, 0.17, -0.74),
  ]);
  const pulpCoreGeo = new THREE.TubeGeometry(pulpCurve, 20, 0.068, 8, false);
  // Taper the banana pulp tip naturally
  const pulpPos = pulpCoreGeo.attributes.position;
  for (let i = 0; i < pulpPos.count; i++) {
    const z = pulpPos.getZ(i);
    if (z < -0.58) {
      const factor = Math.max(0.45, 1 - ((-0.58 - z) / 0.18) * 0.52);
      pulpPos.setX(i, pulpPos.getX(i) * factor);
      pulpPos.setY(i, 0.17 + (pulpPos.getY(i) - 0.17) * factor);
    }
  }
  pulpCoreGeo.computeVertexNormals();
  const innerPulpBarrel = new THREE.Mesh(pulpCoreGeo, innerPulpMat);
  aimPivot.add(innerPulpBarrel);

  // Dark Banana Tip Cap attached directly to innerPulpBarrel so it moves seamlessly during peeling
  const nozzleGeo = new THREE.SphereGeometry(0.036, 10, 8);
  nozzleGeo.scale(1, 1, 1.35);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, stemMat);
  nozzleMesh.position.set(0, 0.17, -0.75);
  innerPulpBarrel.add(nozzleMesh);

  // 3. Articulated 2-Joint Banana Peel Strips (4 strips around the barrel that peel open on reload!)
  const peelStrips: PeelStripRig[] = [];
  const peelPetals: THREE.Mesh[] = [];

  const lowerStripGeo = new THREE.BoxGeometry(0.056, 0.014, 0.22);
  lowerStripGeo.translate(0, 0, -0.11); // Pivot at base (z = 0, extending toward -z)

  const upperStripShape = new THREE.Shape();
  upperStripShape.moveTo(-0.028, 0);
  upperStripShape.quadraticCurveTo(-0.032, 0.12, -0.008, 0.23);
  upperStripShape.lineTo(0.008, 0.23);
  upperStripShape.quadraticCurveTo(0.032, 0.12, 0.028, 0);
  upperStripShape.closePath();

  const upperStripGeo = new THREE.ExtrudeGeometry(upperStripShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 2,
  });
  upperStripGeo.rotateX(-Math.PI / 2); // Extend along -Z from joint

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const stripPivot = new THREE.Group();
    stripPivot.position.set(
      Math.cos(angle) * 0.074,
      0.15 + Math.sin(angle) * 0.074,
      -0.34,
    );
    stripPivot.rotation.z = angle - Math.PI / 2;

    const lowerMesh = new THREE.Mesh(lowerStripGeo, skinMat);
    stripPivot.add(lowerMesh);

    const upperPivot = new THREE.Group();
    upperPivot.position.set(0, 0, -0.20);
    lowerMesh.add(upperPivot);

    const upperMesh = new THREE.Mesh(upperStripGeo, [skinMat, innerPeelMat]);
    upperPivot.add(upperMesh);

    aimPivot.add(stripPivot);
    peelStrips.push({
      pivot: stripPivot,
      baseAngle: angle,
      lowerMesh,
      upperPivot,
      upperMesh,
    });
    peelPetals.push(upperMesh);
  }

  // 4. Accent Detail: Fibrous Stem Hammer / Peel Pull-Tab at Rear
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.034, 0.14, 8);
  const stemHammer = new THREE.Mesh(stemGeo, stemMat);
  stemHammer.position.set(0, 0.19, 0.02);
  stemHammer.rotation.x = 0.45;
  aimPivot.add(stemHammer);

  // 5. Bamboo Tactical Grip & Jungle Vine Rings
  const gripWrapGeo = new THREE.CylinderGeometry(0.092, 0.084, 0.22, 10);
  const gripWrap = new THREE.Mesh(gripWrapGeo, bambooGripMat);
  gripWrap.position.set(0, -0.16, 0.17);
  gripWrap.rotation.x = -0.58;
  aimPivot.add(gripWrap);

  for (let v = 0; v < 3; v++) {
    const vineRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.093, 0.012, 8, 16),
      vineMat,
    );
    vineRing.position.set(0, -0.09 - v * 0.06, 0.13 + v * 0.035);
    vineRing.rotation.x = Math.PI / 2 - 0.58;
    aimPivot.add(vineRing);
  }

  // 6. Side Chromatic Watercolor Juice Vial
  const juiceMat = new THREE.MeshStandardMaterial({
    color: 0xff2e93,
    emissive: 0xff1f8f,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.2,
  });
  const juiceCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.16, 6, 12),
    juiceMat,
  );
  juiceCore.rotation.x = Math.PI / 2;
  juiceCore.position.set(-0.095, 0.11, -0.22);
  aimPivot.add(juiceCore);

  // 7. Muzzle Point & Watercolor Muzzle Burst Mesh
  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.17, -0.78);
  aimPivot.add(muzzlePoint);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.14, 0),
    flashMat,
  );
  muzzleFlash.position.copy(muzzlePoint.position);
  aimPivot.add(muzzleFlash);

  return {
    root,
    aimPivot,
    muzzlePoint,
    peelPetals,
    peelStrips,
    innerPulpBarrel,
    stemHammer,
    muzzleFlash,
    juiceCore,
  };
}

/**
 * Shared cached textures and geometries for composite 3D fruits to prevent GC churn.
 */
let cachedWatermelonTex: THREE.CanvasTexture | null = null;
let cachedPineappleTex: THREE.CanvasTexture | null = null;

/**
 * Builds a multi-part 3D composite Fruit (`THREE.Group` of 3-8 parts across 3 silhouette scales)
 * so every mid-air target reads distinctly and looks juicy.
 */
function createFruitModel(kind: FruitKind, maxAnisotropy = 1): THREE.Group {
  if (!cachedWatermelonTex) {
    cachedWatermelonTex = createWatermelonRindTexture(maxAnisotropy);
    cachedPineappleTex = createPineappleTexture(maxAnisotropy);
  }

  const spec = FRUIT_SPECS[kind];
  const group = new THREE.Group();
  const r = spec.radius;

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.45,
    metalness: 0.05,
  });
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x713f12,
    roughness: 0.85,
    metalness: 0.05,
  });

  if (kind === 'watermelon') {
    // 1. Striped Melon Hull
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cachedWatermelonTex,
        roughness: 0.25,
        metalness: 0.05,
      }),
    );
    body.scale.set(1.18, 0.96, 0.96);
    group.add(body);

    // 2. Curly Vine Stem
    const stem = new THREE.Mesh(new THREE.TorusGeometry(r * 0.18, r * 0.04, 8, 14, Math.PI * 1.3), leafMat);
    stem.position.set(r * 1.12, r * 0.1, 0);
    group.add(stem);

    // 3. Tropical Leaf Accent
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.45, 5), leafMat);
    leaf.position.set(r * 1.15, r * 0.25, 0.1);
    leaf.rotation.z = -0.8;
    group.add(leaf);
  } else if (kind === 'pineapple') {
    // 1. Diamond-scaled golden body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.72, r * 0.82, r * 1.55, 16, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cachedPineappleTex,
        roughness: 0.55,
        metalness: 0.08,
      }),
    );
    group.add(body);

    // 2. Multi-tiered Spiky Crown Fronds (6 leaves across 2 rings)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.22, r * 0.95, 4),
        leafMat,
      );
      frond.position.set(
        Math.cos(angle) * r * 0.25,
        r * 1.05,
        Math.sin(angle) * r * 0.25,
      );
      frond.rotation.z = -Math.cos(angle) * 0.42;
      frond.rotation.x = Math.sin(angle) * 0.42;
      group.add(frond);
    }
    const centerFrond = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 1.1, 4), leafMat);
    centerFrond.position.set(0, r * 1.2, 0);
    group.add(centerFrond);
  } else if (kind === 'dragonfruit') {
    // 1. Vivid Magenta Pitaya Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xff1f8f,
        emissive: 0x831843,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.08,
      }),
    );
    body.scale.set(0.92, 1.22, 0.92);
    group.add(body);

    // 2. Lime-Tipped Flame Scales / Bracts (8 fins)
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.4,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 0.55, 4), finMat);
      const yOff = (i % 2 === 0 ? 0.25 : -0.22) * r;
      fin.position.set(Math.cos(a) * r * 0.85, yOff, Math.sin(a) * r * 0.85);
      fin.rotation.z = -Math.cos(a) * 0.65;
      fin.rotation.x = Math.sin(a) * 0.65;
      group.add(fin);
    }
  } else if (kind === 'mango') {
    // 1. Sun-ripened Golden-Coral Mango Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xff9f1c,
        emissive: 0xea580c,
        emissiveIntensity: 0.18,
        roughness: 0.22,
        metalness: 0.05,
      }),
    );
    body.scale.set(0.88, 1.25, 0.78);
    group.add(body);

    // Blush cheek
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.78, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.25,
      }),
    );
    blush.position.set(r * 0.18, r * 0.1, 0);
    group.add(blush);

    // Stem + Leaf
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, r * 0.35, 6), stemMat);
    stem.position.set(0, r * 1.28, 0);
    group.add(stem);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, 0.04, r * 0.22), leafMat);
    leaf.position.set(r * 0.28, r * 1.25, 0);
    leaf.rotation.z = -0.35;
    group.add(leaf);
  } else if (kind === 'starfruit') {
    // 1. 5-Pointed Extruded Starfruit Profile
    const starShape = new THREE.Shape();
    const pts = 5;
    for (let i = 0; i < pts * 2; i++) {
      const rad = i % 2 === 0 ? r * 1.05 : r * 0.42;
      const a = (i / (pts * 2)) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();

    const starGeo = new THREE.ExtrudeGeometry(starShape, {
      depth: r * 1.15,
      bevelEnabled: true,
      bevelThickness: r * 0.18,
      bevelSize: r * 0.14,
      bevelSegments: 2,
    });
    starGeo.center();

    const starMesh = new THREE.Mesh(
      starGeo,
      new THREE.MeshStandardMaterial({
        color: 0xbef264,
        emissive: 0x65a30d,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.05,
      }),
    );
    group.add(starMesh);

    const tipStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, r * 0.4, 6), stemMat);
    tipStem.position.set(0, 0, r * 0.72);
    tipStem.rotation.x = Math.PI / 2;
    group.add(tipStem);
  } else if (kind === 'passionfruit') {
    // 1. Glossy Royal Purple Passionfruit + Golden Equator Band + Stem
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0x7e22ce,
        emissive: 0x581c87,
        emissiveIntensity: 0.25,
        roughness: 0.18,
        metalness: 0.1,
      }),
    );
    group.add(body);

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.96, r * 0.08, 8, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.35,
      }),
    );
    band.rotation.x = Math.PI / 2;
    group.add(band);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, r * 0.4, 6), leafMat);
    stem.position.set(0, r * 1.05, 0);
    group.add(stem);
  } else if (kind === 'durian_bomb') {
    // Menacing Spiky Durian Hazard Bomb with Warning Telegraph Ring & Glowing Fuse
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r * 0.92, 1),
      new THREE.MeshStandardMaterial({
        color: 0x3f6212,
        emissive: 0xef4444,
        emissiveIntensity: 0.45,
        roughness: 0.65,
        metalness: 0.25,
      }),
    );
    group.add(core);

    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });

    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0],
    ];
    for (const [dx, dy, dz] of dirs) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.62, 5), spikeMat);
      spike.position.set(dx * r * 0.85, dy * r * 0.85, dz * r * 0.85);
      spike.lookAt(dx * 5, dy * 5, dz * 5);
      spike.rotateX(Math.PI / 2);
      group.add(spike);
    }

    // Telegraph Warning Ring around Hazard
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.25, r * 1.42, 24),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    ring.name = 'telegraphRing';
    group.add(ring);
  }

  return group;
}

interface JungleEnvironmentHandles {
  cannons: THREE.Group[];
  palmCanopies: THREE.Group[];
  groundMesh: THREE.Mesh;
}

/**
 * Builds a rich, natural outdoor Tropical Jungle Glade with:
 * - Textured mossy ground plane + turquoise lagoon shoreline
 * - 4 Bamboo Fruit-Launcher Cannons positioned downrange
 * - Composite swaying Coconut Palm Trees (curved segmented trunk + frond crown + coconuts)
 * - Carved Tiki Totem Landmarks framing the vista
 * - InstancedMesh tropical ferns & mossy boulders around the natural perimeter
 */
function populateJungleEnvironment(
  scene: THREE.Scene,
  maxAnisotropy = 1,
): JungleEnvironmentHandles {
  const { map: groundMap, bumpMap: groundBump } = createJungleGroundTextures(maxAnisotropy);

  // 1. Ground Terrain Plane (sits at y = 0, covers entire horizon)
  const groundGeo = new THREE.CircleGeometry(150, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: groundMap,
    bumpMap: groundBump,
    bumpScale: 0.15,
    roughness: 0.88,
    metalness: 0.02,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // 2. Shimmering Tropical Lagoon Cove in the Distant Horizon (z = -58, well behind the clearing)
  const lagoonGeo = new THREE.CircleGeometry(32, 36);
  lagoonGeo.rotateX(-Math.PI / 2);
  const lagoonMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0e7490,
    emissiveIntensity: 0.22,
    roughness: 0.15,
    metalness: 0.35,
  });
  const lagoon = new THREE.Mesh(lagoonGeo, lagoonMat);
  lagoon.scale.set(2.4, 1, 0.65);
  lagoon.position.set(0, 0.03, -56);
  scene.add(lagoon);

  // 3. 4 Composite Bamboo Fruit-Launcher Mortars downrange
  const cannons: THREE.Group[] = [];
  const cannonPositions: [number, number, number][] = [
    [-9.5, 0, -16],
    [-3.2, 0, -18.5],
    [3.2, 0, -18.5],
    [9.5, 0, -16],
  ];

  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xa3e635,
    roughness: 0.52,
    metalness: 0.08,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.82,
    metalness: 0.05,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.28,
    metalness: 0.55,
  });

  for (const [cx, cy, cz] of cannonPositions) {
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(cx, cy, cz);

    // Contact shadow disc
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 16),
      new THREE.MeshBasicMaterial({
        color: 0x051b11,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    cannonGroup.add(shadowDisc);

    // Wooden A-Frame Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 0.65, 10), darkWoodMat);
    base.position.y = 0.325;
    cannonGroup.add(base);

    // Bamboo Mortar Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 1.9, 14), bambooMat);
    barrel.position.set(0, 1.15, 0);
    barrel.rotation.x = 0.26; // Tilted slightly toward player sky
    cannonGroup.add(barrel);

    // Golden Bamboo Node Rings
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 16), goldTrimMat);
      ring.position.set(0, 0.85 + rIdx * 0.65, rIdx * 0.16);
      ring.rotation.x = Math.PI / 2 + 0.26;
      cannonGroup.add(ring);
    }

    scene.add(cannonGroup);
    cannons.push(cannonGroup);
  }

  // 4. Composite Swaying Coconut Palm Trees (3-12 part groups framing the clearing)
  const palmCanopies: THREE.Group[] = [];
  const palmLocations: [number, number, number, number][] = [
    [-16, 0, -14, 1.1],
    [-22, 0, -24, 1.35],
    [16, 0, -14, 1.05],
    [22, 0, -25, 1.3],
    [-12, 0, -30, 1.4],
    [13, 0, -31, 1.25],
    [0, 0, -36, 1.5],
  ];

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.85,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.7,
  });

  for (const [px, py, pz, scale] of palmLocations) {
    const palm = new THREE.Group();
    palm.position.set(px, py, pz);
    palm.scale.setScalar(scale);

    // Contact shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 14),
      new THREE.MeshBasicMaterial({
        color: 0x051b11,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    palm.add(shadow);

    // Curved Segmented Trunk (5 tapered cylinders)
    let curY = 0;
    let curX = 0;
    const leanDir = px < 0 ? 0.18 : -0.18;
    for (let s = 0; s < 5; s++) {
      const segH = 1.45;
      const rBottom = 0.48 - s * 0.06;
      const rTop = 0.42 - s * 0.06;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, segH, 8), trunkMat);
      seg.position.set(curX, curY + segH / 2, 0);
      seg.rotation.z = -leanDir * (s * 0.35);
      palm.add(seg);
      curY += segH * 0.94;
      curX += leanDir * (s * 0.32);
    }

    // Canopy Crown + Coconuts
    const canopy = new THREE.Group();
    canopy.position.set(curX, curY, 0);

    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2;
      const coco = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), coconutMat);
      coco.position.set(Math.cos(a) * 0.32, -0.2, Math.sin(a) * 0.32);
      canopy.add(coco);
    }

    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.68, 3.4, 4), frondMat);
      frond.scale.set(1, 1, 0.25);
      frond.position.set(Math.cos(a) * 1.4, 0.1, Math.sin(a) * 1.4);
      frond.rotation.y = -a;
      frond.rotation.z = -1.15;
      canopy.add(frond);
    }

    palm.add(canopy);
    palmCanopies.push(canopy);
    scene.add(palm);
  }

  // 5. Carved Tiki Stone Totem Pillars (Framing Vista Landmarks)
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x57534e,
    roughness: 0.85,
    metalness: 0.1,
  });
  const glowEyeMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
  });

  const totemPositions: [number, number, number][] = [
    [-13.5, 0, -11],
    [13.5, 0, -11],
  ];

  for (const [tx, ty, tz] of totemPositions) {
    const totem = new THREE.Group();
    totem.position.set(tx, ty, tz);
    totem.lookAt(0, 1.5, 4);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.6, 1.2), stoneMat);
    body.position.y = 1.8;
    totem.add(body);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.38, 1.45), stoneMat);
    brow.position.set(0, 2.85, 0.1);
    totem.add(brow);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), glowEyeMat);
    leftEye.position.set(-0.34, 2.45, 0.62);
    totem.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), glowEyeMat);
    rightEye.position.set(0.34, 2.45, 0.62);
    totem.add(rightEye);

    scene.add(totem);
  }

  // 6. InstancedMesh Perimeter Mossy Boulders (> 20 instances with ±15% scale & color variation)
  const rockCount = 36;
  const rockGeo = new THREE.DodecahedronGeometry(1.2, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.08,
  });
  const rocksInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  const tempColor = new THREE.Color();

  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 1.4 - Math.PI * 1.2;
    const radius = 22 + (i % 5) * 4.5;
    dummy.position.set(
      Math.cos(angle) * radius,
      0.35,
      Math.sin(angle) * radius - 8,
    );
    dummy.rotation.set(i * 0.5, i * 1.1, 0);
    const s = 0.85 + ((i * 19) % 30) / 100; // ±15% scale variation
    dummy.scale.set(s * 1.3, s * 0.75, s);
    dummy.updateMatrix();
    rocksInstanced.setMatrixAt(i, dummy.matrix);

    tempColor.setHSL(0.32 + (i % 4) * 0.02, 0.28, 0.24 + (i % 3) * 0.05);
    rocksInstanced.setColorAt(i, tempColor);
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  if (rocksInstanced.instanceColor) rocksInstanced.instanceColor.needsUpdate = true;
  rocksInstanced.computeBoundingSphere();
  scene.add(rocksInstanced);

  return {
    cannons,
    palmCanopies,
    groundMesh,
  };
}

// ============================================================================
// 5. MULTI-LAYERED 3D + 2D WATERCOLOR SPLATTER EXPLOSION SYSTEM
// ============================================================================
interface BloomCloudSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  active: boolean;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  rotSpeed: number;
}

interface DropletSlot {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  age: number;
  maxAge: number;
}

interface GroundDecalSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  maxAge: number;
  targetScale: number;
}

interface ScreenWatercolorSplat {
  normX: number; // 0..1
  normY: number; // 0..1
  primaryColor: string;
  secondaryColor: string;
  rimColor: string;
  radiusPx: number;
  age: number;
  maxAge: number;
  seed: number;
}

// Pre-allocated scratch math objects (Zero GC in render loop)
const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _projVec = new THREE.Vector3();

class WatercolorExplosionManager {
  private scene: THREE.Scene;
  private texturesByKind = new Map<FruitKind, THREE.CanvasTexture[]>();
  private ringTexturesByKind = new Map<FruitKind, THREE.CanvasTexture>();

  private bloomPool: BloomCloudSlot[] = [];
  private dropletPool: DropletSlot[] = [];
  private dropletInstanced: THREE.InstancedMesh;
  private groundDecals: GroundDecalSlot[] = [];
  private decalCursor = 0;

  public screenSplats: ScreenWatercolorSplat[] = [];

  private readonly MAX_BLOOMS = 72;
  private readonly MAX_DROPLETS = 160;
  private readonly MAX_DECALS = 28;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Pre-generate watercolor blotch & shockwave ring textures per fruit kind
    const kinds = Object.keys(FRUIT_SPECS) as FruitKind[];
    for (const kind of kinds) {
      const spec = FRUIT_SPECS[kind];
      const variants: THREE.CanvasTexture[] = [
        createWatercolorBlotchTexture(spec.primaryColor, spec.secondaryColor, spec.splatRimColor, 1),
        createWatercolorBlotchTexture(spec.secondaryColor, spec.primaryColor, spec.splatRimColor, 2),
      ];
      this.texturesByKind.set(kind, variants);
      this.ringTexturesByKind.set(
        kind,
        createWatercolorRingTexture(spec.primaryColor, spec.splatRimColor),
      );
    }

    // 2. Pre-allocate Billboard Watercolor Bloom Cloud Sprites
    const defaultTex = this.texturesByKind.get('watermelon')![0];
    for (let i = 0; i < this.MAX_BLOOMS; i++) {
      const material = new THREE.SpriteMaterial({
        map: defaultTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 12;
      this.scene.add(sprite);

      this.bloomPool.push({
        sprite,
        material,
        velocity: new THREE.Vector3(),
        active: false,
        age: 0,
        maxAge: 1,
        startScale: 1,
        endScale: 3,
        rotSpeed: 0,
      });
    }

    // 3. Pre-allocate Single InstancedMesh for 3D Watercolor Droplets & Pulp Bursts
    const dropGeo = new THREE.SphereGeometry(0.14, 8, 6);
    dropGeo.scale(0.85, 1.35, 0.85); // Teardrop paint droplet silhouette
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.dropletInstanced = new THREE.InstancedMesh(dropGeo, dropMat, this.MAX_DROPLETS);
    this.dropletInstanced.frustumCulled = false;

    for (let i = 0; i < this.MAX_DROPLETS; i++) {
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0);
      _dummyObj.updateMatrix();
      this.dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
      this.dropletInstanced.setColorAt(i, _tempColor.setHex(0xffffff));

      this.dropletPool.push({
        active: false,
        position: new THREE.Vector3(0, -100, 0),
        velocity: new THREE.Vector3(),
        scale: 1,
        age: 0,
        maxAge: 1,
      });
    }
    this.dropletInstanced.instanceMatrix.needsUpdate = true;
    if (this.dropletInstanced.instanceColor) {
      this.dropletInstanced.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.dropletInstanced);

    // 4. Pre-allocate Persistent Jungle Floor Watercolor Splat Decals
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    decalGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < this.MAX_DECALS; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: defaultTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(decalGeo, material);
      mesh.visible = false;
      mesh.position.y = 0.025 + i * 0.0005; // Disjoint depth so decals never Z-fight
      this.scene.add(mesh);

      this.groundDecals.push({
        mesh,
        material,
        active: false,
        age: 0,
        maxAge: 14,
        targetScale: 3.5,
      });
    }
  }

  /**
   * Triggers a rich, multi-layered mid-air Watercolor Explosion at `worldPos`.
   */
  public spawnWatercolorExplosion(
    worldPos: THREE.Vector3,
    kind: FruitKind,
    camera: THREE.Camera,
  ): void {
    const spec = FRUIT_SPECS[kind];
    const variants = this.texturesByKind.get(kind) || this.texturesByKind.get('watermelon')!;
    const ringTex = this.ringTexturesByKind.get(kind)!;

    // 1. Spawn 1 Expanding Shockwave Ring + 6 Billowing Wet Watercolor Pigment Clouds
    let spawnedClouds = 0;
    for (let i = 0; i < this.bloomPool.length && spawnedClouds < 7; i++) {
      const slot = this.bloomPool[i];
      if (slot.active) continue;

      slot.active = true;
      slot.age = 0;
      slot.sprite.visible = true;
      slot.sprite.position.copy(worldPos);

      if (spawnedClouds === 0) {
        // Shockwave watercolor ring
        slot.material.map = ringTex;
        slot.maxAge = 0.65;
        slot.startScale = 1.2;
        slot.endScale = 6.2;
        slot.velocity.set(0, 0, 0);
        slot.rotSpeed = (Math.random() - 0.5) * 1.5;
      } else {
        // Billowing wet watercolor blotch cloud
        slot.material.map = variants[spawnedClouds % variants.length];
        slot.maxAge = 0.85 + Math.random() * 0.55;
        slot.startScale = 1.4 + Math.random() * 0.8;
        slot.endScale = 3.8 + Math.random() * 2.4;

        const theta = (spawnedClouds / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 1.8 + Math.random() * 2.8;
        slot.velocity.set(
          Math.cos(theta) * speed,
          Math.sin(theta) * speed * 0.85 + 0.6,
          (Math.random() - 0.5) * 2.2,
        );
        slot.rotSpeed = (Math.random() - 0.5) * 2.4;
      }

      slot.material.rotation = Math.random() * Math.PI * 2;
      slot.material.opacity = 0.95;
      slot.material.needsUpdate = true;
      spawnedClouds++;
    }

    // 2. Spawn 24 Radial 3D Paint Droplets from Pooled Ring Buffer
    let spawnedDrops = 0;
    const colorChoices = [spec.primaryColor, spec.secondaryColor, spec.splatRimColor];
    for (let i = 0; i < this.dropletPool.length && spawnedDrops < 24; i++) {
      const drop = this.dropletPool[i];
      if (drop.active) continue;

      drop.active = true;
      drop.age = 0;
      drop.maxAge = 0.75 + Math.random() * 0.45;
      drop.position.copy(worldPos);

      const u = Math.random() * Math.PI * 2;
      const v = (Math.random() - 0.3) * Math.PI;
      const spd = 4.5 + Math.random() * 7.5;
      drop.velocity.set(
        Math.cos(u) * Math.cos(v) * spd,
        Math.sin(v) * spd + 2.8,
        Math.sin(u) * Math.cos(v) * spd,
      );
      drop.scale = 0.75 + Math.random() * 1.15;

      _tempColor.set(colorChoices[spawnedDrops % colorChoices.length]);
      this.dropletInstanced.setColorAt(i, _tempColor);
      spawnedDrops++;
    }
    if (this.dropletInstanced.instanceColor) {
      this.dropletInstanced.instanceColor.needsUpdate = true;
    }

    // 3. Stamp a Persistent Watercolor Blotch Decal onto the Jungle Floor below
    const decal = this.groundDecals[this.decalCursor % this.MAX_DECALS];
    this.decalCursor++;
    decal.active = true;
    decal.age = 0;
    decal.maxAge = 16;
    decal.targetScale = 2.8 + Math.random() * 1.8;
    decal.material.map = variants[this.decalCursor % variants.length];
    decal.material.opacity = 0.85;
    decal.material.needsUpdate = true;
    decal.mesh.position.x = worldPos.x + (Math.random() - 0.5) * 1.5;
    decal.mesh.position.z = worldPos.z + (Math.random() - 0.5) * 1.5;
    decal.mesh.rotation.y = Math.random() * Math.PI * 2;
    decal.mesh.scale.setScalar(0.4);
    decal.mesh.visible = true;

    // 4. Add a 2D Screen-Space Watercolor Wash Splat for immediate FPP tactile feedback
    _projVec.copy(worldPos).project(camera);
    if (_projVec.z >= -1 && _projVec.z <= 1) {
      const normX = (_projVec.x + 1) * 0.5;
      const normY = (1 - _projVec.y) * 0.5;
      this.screenSplats.push({
        normX,
        normY,
        primaryColor: spec.primaryColor,
        secondaryColor: spec.secondaryColor,
        rimColor: spec.splatRimColor,
        radiusPx: 95 + Math.random() * 55,
        age: 0,
        maxAge: 2.2,
        seed: Math.floor(Math.random() * 1000),
      });
      if (this.screenSplats.length > 10) {
        this.screenSplats.shift();
      }
    }
  }

  /**
   * Updates all active watercolor blooms, droplets, ground decals, and 2D screen washes.
   */
  public update(dt: number): void {
    // 1. Update Billboard Watercolor Clouds
    for (let i = 0; i < this.bloomPool.length; i++) {
      const slot = this.bloomPool[i];
      if (!slot.active) continue;

      slot.age += dt;
      if (slot.age >= slot.maxAge) {
        slot.active = false;
        slot.sprite.visible = false;
        continue;
      }

      const t = slot.age / slot.maxAge;
      // Fast ease-out expansion like wet pigment hitting water
      const easeOut = 1 - Math.pow(1 - t, 3);
      const scale = THREE.MathUtils.lerp(slot.startScale, slot.endScale, easeOut);
      slot.sprite.scale.set(scale, scale, 1);

      slot.sprite.position.addScaledVector(slot.velocity, dt * (1 - t * 0.65));
      slot.material.rotation += slot.rotSpeed * dt;
      slot.material.opacity = (1 - Math.pow(t, 1.6)) * 0.92;
    }

    // 2. Update Pooled 3D Paint Droplets
    let anyDropletUpdated = false;
    for (let i = 0; i < this.dropletPool.length; i++) {
      const drop = this.dropletPool[i];
      if (!drop.active) continue;
      anyDropletUpdated = true;

      drop.age += dt;
      if (drop.age >= drop.maxAge || drop.position.y < 0.05) {
        drop.active = false;
        _dummyObj.position.set(0, -100, 0);
        _dummyObj.scale.setScalar(0);
        _dummyObj.updateMatrix();
        this.dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      drop.velocity.y -= 14.5 * dt; // Gravity
      drop.position.addScaledVector(drop.velocity, dt);

      const t = drop.age / drop.maxAge;
      const curScale = drop.scale * (1 - t * 0.75);
      _dummyObj.position.copy(drop.position);
      _dummyObj.scale.setScalar(curScale);
      _dummyObj.updateMatrix();
      this.dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    if (anyDropletUpdated) {
      this.dropletInstanced.instanceMatrix.needsUpdate = true;
    }

    // 3. Update Ground Watercolor Decals
    for (let i = 0; i < this.groundDecals.length; i++) {
      const decal = this.groundDecals[i];
      if (!decal.active) continue;

      decal.age += dt;
      if (decal.age >= decal.maxAge) {
        decal.active = false;
        decal.mesh.visible = false;
        continue;
      }

      const expandT = Math.min(1, decal.age / 0.28);
      const s = THREE.MathUtils.lerp(0.4, decal.targetScale, 1 - Math.pow(1 - expandT, 3));
      decal.mesh.scale.setScalar(s);

      if (decal.age > decal.maxAge - 3.0) {
        decal.material.opacity = ((decal.maxAge - decal.age) / 3.0) * 0.75;
      }
    }

    // 4. Update 2D Screen Watercolor Washes
    for (let i = this.screenSplats.length - 1; i >= 0; i--) {
      const sp = this.screenSplats[i];
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        this.screenSplats.splice(i, 1);
      }
    }
  }

  public clearAll(): void {
    for (const slot of this.bloomPool) {
      slot.active = false;
      slot.sprite.visible = false;
    }
    for (let i = 0; i < this.dropletPool.length; i++) {
      this.dropletPool[i].active = false;
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0);
      _dummyObj.updateMatrix();
      this.dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    this.dropletInstanced.instanceMatrix.needsUpdate = true;
    for (const decal of this.groundDecals) {
      decal.active = false;
      decal.mesh.visible = false;
    }
    this.screenSplats.length = 0;
  }
}

// ============================================================================
// 6. PWA INSTALL & SINGLE-FILE HTML DOWNLOAD / EXPORT HOOK
// ============================================================================
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const SHARED_APP_URL =
  'https://ais-pre-z2jsls2xqom7wbu4otac5w-181218366741.asia-east1.run.app';

function getPublicAppUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return SHARED_APP_URL;
}

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  /**
   * Downloads the complete standalone single-file HTML edition of Prabhu's Banana
   * (`Prabhus-Banana-SingleFile.html`) containing the entire 3D game, audio, and UI in one file.
   */
  const downloadDesktopShortcut = useCallback(async () => {
    try {
      const response = await fetch('/Prabhus-Banana-SingleFile.html');
      if (response.ok) {
        const htmlText = await response.text();
        const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Prabhus-Banana-SingleFile.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback below if fetch fails while offline
    }

    const a = document.createElement('a');
    a.href = '/Prabhus-Banana-SingleFile.html';
    a.download = 'Prabhus-Banana-SingleFile.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const fetchSingleFileSource = useCallback(async (): Promise<string> => {
    const response = await fetch('/Prabhus-Banana.html');
    if (response.ok) {
      return await response.text();
    }
    const fallbackResponse = await fetch('/Prabhus-Banana-SingleFile.html');
    return await fallbackResponse.text();
  }, []);

  /**
   * Downloads `Build-Prabhus-Banana-EXE.bat`, an automatic Windows script that compiles
   * a standalone single-file `Prabhus-Banana-Portable.exe` (with embedded 3D game & custom icon)
   * using Windows' built-in .NET compiler (`csc.exe`) with zero external installs required.
   */
  const downloadPortableExeBuilder = useCallback(async () => {
    try {
      const response = await fetch('/Build-Prabhus-Banana-EXE.bat');
      if (response.ok) {
        const batText = await response.text();
        const blob = new Blob([batText], { type: 'application/x-bat;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Build-Prabhus-Banana-EXE.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback below
    }

    const a = document.createElement('a');
    a.href = '/Build-Prabhus-Banana-EXE.bat';
    a.download = 'Build-Prabhus-Banana-EXE.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isOnline,
    install,
    downloadDesktopShortcut,
    downloadPortableExeBuilder,
    fetchSingleFileSource,
  };
}

// ============================================================================
// 7. INSTALL & SHARE SINGLE-FILE MODAL
// ============================================================================
interface InstallShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallPWA: () => Promise<boolean>;
  onDownloadDesktopApp: () => void;
  onDownloadPortableExeBuilder: () => void;
  onFetchSingleFileSource?: () => Promise<string>;
}

const InstallShareModal: React.FC<InstallShareModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  onInstallPWA,
  onDownloadDesktopApp,
  onDownloadPortableExeBuilder,
  onFetchSingleFileSource,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSingleFile, setCopiedSingleFile] = useState(false);
  const [downloadedDesktop, setDownloadedDesktop] = useState(false);
  const [downloadedExeScript, setDownloadedExeScript] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = getPublicAppUrl();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    }
  };

  const handleCopySingleFileHtml = async () => {
    if (!onFetchSingleFileSource) return;
    try {
      const htmlSource = await onFetchSingleFileSource();
      await navigator.clipboard.writeText(htmlSource);
      setCopiedSingleFile(true);
      setTimeout(() => setCopiedSingleFile(false), 3000);
    } catch {
      setShareStatus('Downloaded single-file HTML instead!');
      onDownloadDesktopApp();
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: "Prabhu's Banana — Tropical Watercolor Splat",
          text: "Play Prabhu's Banana! Shoot mid-air tropical fruits with a peeling banana blaster in 3D watercolor explosions.",
          url: shareUrl,
        });
        setShareStatus('Shared successfully!');
        setTimeout(() => setShareStatus(null), 2600);
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await handleCopyLink();
    setShareStatus('App link copied to clipboard!');
    setTimeout(() => setShareStatus(null), 2600);
  };

  const handleDownloadPC = () => {
    onDownloadDesktopApp();
    setDownloadedDesktop(true);
    setTimeout(() => setDownloadedDesktop(false), 3200);
  };

  const handleDownloadExeScript = () => {
    onDownloadPortableExeBuilder();
    setDownloadedExeScript(true);
    setTimeout(() => setDownloadedExeScript(false), 3500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05140e]/85 p-4 md:p-6 pointer-events-auto"
    >
      <div className="w-full max-w-lg bg-[#092419] border-2 border-amber-400/70 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 text-left">
        {/* Header with Inline SVG App Icon & Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14 rounded-2xl border-2 border-amber-400/60 shadow-md shrink-0 bg-[#092218]"
              aria-label="Prabhu's Banana App Icon"
            >
              <rect width="64" height="64" rx="14" fill="#092218" />
              <circle cx="22" cy="22" r="12" fill="#ff2a6d" opacity="0.8" />
              <circle cx="44" cy="42" r="11" fill="#00e5ff" opacity="0.75" />
              <path
                d="M16 46 C20 26 32 14 48 12 C45 28 34 42 20 48 Z"
                fill="#facc15"
                stroke="#071a12"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-400">
                PORTABLE WINDOWS .EXE &amp; SINGLE-FILE APP
              </span>
              <h2
                id="install-share-modal-title"
                className="font-display font-extrabold text-2xl md:text-3xl text-amber-300 tracking-tight"
              >
                Prabhu&apos;s Banana
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Install and Share Modal"
            className="w-9 h-9 rounded-xl bg-[#061810] hover:bg-emerald-900 border border-emerald-700/70 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Automatic Portable .EXE Builder & Single-File HTML Download */}
        <div className="bg-[#061810] border border-emerald-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              1. Automatic Portable Windows .EXE &amp; Single-File Game
            </span>
            {isInstalled && (
              <span className="text-[11px] font-bold text-emerald-400">
                Installed on Device
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Primary 1-Click Automatic Portable .EXE Builder (.bat) Button */}
            <button
              type="button"
              data-testid="download-portable-exe-script-btn"
              onClick={handleDownloadExeScript}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#071a12] font-display font-extrabold text-sm shadow-[0_4px_0_#b45309] cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>
                {downloadedExeScript
                  ? 'Downloaded Build-Prabhus-Banana-EXE.bat!'
                  : 'Download Auto Portable .EXE Maker (Build-Prabhus-Banana-EXE.bat)'}
              </span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="download-pc-launcher-btn"
                onClick={handleDownloadPC}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-800/90 hover:bg-emerald-700 text-amber-200 border border-amber-400/40 font-bold text-xs cursor-pointer transition-colors"
              >
                {downloadedDesktop
                  ? 'Downloaded SingleFile.html!'
                  : 'Download Single-File (.html)'}
              </button>

              {onFetchSingleFileSource && (
                <button
                  type="button"
                  data-testid="copy-single-file-html-btn"
                  onClick={handleCopySingleFileHtml}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-800/90 hover:bg-emerald-700 text-amber-200 border border-amber-400/40 font-bold text-xs cursor-pointer transition-colors"
                >
                  {copiedSingleFile
                    ? 'Copied Single-File HTML!'
                    : 'Copy Single-File HTML Code'}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-emerald-200/85 leading-relaxed">
            <strong className="text-amber-200">How Portable .EXE Works:</strong> Download{' '}
            <code className="text-amber-300 font-mono-tabular">Build-Prabhus-Banana-EXE.bat</code> and
            double-click it on your Windows PC. It automatically compiles a standalone{' '}
            <code className="text-amber-300 font-mono-tabular">Prabhus-Banana-Portable.exe</code> (with custom
            Banana icon &amp; offline 3D game embedded inside) using Windows&apos; built-in .NET compiler!
          </p>
        </div>

        {/* Section 2: Share Prabhu's Banana Link */}
        <div className="bg-[#061810] border border-emerald-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-pink-300">
            2. Share Prabhu&apos;s Banana Live App Link
          </span>

          <div className="flex items-center gap-2 bg-[#04110b] border border-emerald-800/90 rounded-xl px-3 py-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable App Link"
              className="w-full bg-transparent text-xs font-mono-tabular text-emerald-100 focus:outline-none select-all"
            />
            <button
              type="button"
              data-testid="copy-app-link-btn"
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-200 font-bold text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <button
            type="button"
            data-testid="share-app-native-btn"
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-display font-extrabold text-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Share App with Friends</span>
          </button>

          {shareStatus && (
            <span className="text-xs font-bold text-cyan-300">{shareStatus}</span>
          )}
        </div>

        {/* Footer Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-900/70 hover:bg-emerald-800 text-emerald-100 font-bold text-sm cursor-pointer transition-colors"
        >
          Back to Prabhu&apos;s Banana
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 8. COMPACT CROSSHAIR & BOTTOM-LEFT SCORE / STREAK / COMBO HUD
// ============================================================================
interface GameHudProps {
  hud: LiveHudSnapshot;
  gameMode: GameMode;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPause: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRestart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInstallShare: (e: React.MouseEvent<HTMLButtonElement>) => void;
  crosshairRef: React.RefObject<HTMLDivElement | null>;
}

const GameHud: React.FC<GameHudProps> = ({
  hud,
  gameMode,
  isMuted,
  onToggleMute,
  onPause,
  onRestart,
  onOpenInstallShare,
  crosshairRef,
}) => {
  const { scoreState, vitality, maxVitality, wave, timeRemainingSec, peelCharge, floatingPopups } = hud;
  const comboProgress = Math.max(0, Math.min(1, scoreState.comboTimer / COMBO_WINDOW_SECONDS));

  return (
    <div className="fixed inset-0 pointer-events-none z-20 select-none overflow-hidden">
      {/* Compact Dynamic Watercolor Center / Cursor Reticle (34x34) */}
      <div
        ref={crosshairRef}
        data-testid="hud-crosshair"
        style={{ left: '50%', top: '46%' }}
        className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        <svg width="34" height="34" viewBox="0 0 34 34" className="overflow-visible">
          {/* Outer Watercolor Ring */}
          <circle
            cx="17"
            cy="17"
            r="10.5"
            fill="none"
            stroke="#0a1c14"
            strokeWidth="3"
            opacity="0.8"
          />
          <circle
            cx="17"
            cy="17"
            r="10.5"
            fill="none"
            stroke={scoreState.combo > 1 ? '#ff2e93' : '#facc15'}
            strokeWidth="1.8"
            strokeDasharray={scoreState.comboTimer > 0 ? `${Math.round(comboProgress * 66)} 67` : undefined}
          />
          {/* Crisp Crosshair Notches */}
          <path
            d="M17 2.5 L17 7.5 M17 26.5 L17 31.5 M2.5 17 L7.5 17 M26.5 17 L31.5 17"
            stroke="#fefce8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Center Banana-Yellow Dot */}
          <circle cx="17" cy="17" r="2" fill="#facc15" stroke="#0a1c14" strokeWidth="1.2" />
        </svg>
      </div>

      {/* Floating Watercolor Score & Combo Popups */}
      {floatingPopups.map((popup) => (
        <div
          key={popup.id}
          style={{
            left: `${popup.xPercent}%`,
            top: `${popup.yPercent}%`,
            opacity: Math.max(0, 1 - popup.age / 1.1),
            transform: `translate(-50%, -50%) scale(${1 + Math.sin(popup.age * Math.PI) * 0.18})`,
          }}
          className="fixed pointer-events-none flex flex-col items-center"
        >
          <span
            style={{ color: popup.color }}
            className="font-display font-extrabold text-3xl tracking-tight hud-stroke whitespace-nowrap"
          >
            {popup.text}
          </span>
          {popup.subtext && (
            <span className="font-display font-bold text-xs tracking-wider text-amber-200 hud-stroke-sm whitespace-nowrap">
              {popup.subtext}
            </span>
          )}
        </div>
      ))}

      {/* TOP-LEFT PERIMETER CLUSTER: Vitality Pips, Wave & Round Timer */}
      <div className="fixed top-5 left-6 flex items-center gap-6">
        {/* Tropical Pineapple Vitality Sockets */}
        {gameMode !== 'zen' && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-200/90 hud-stroke-sm">
              VITALITY
            </span>
            <div className="flex items-center gap-1.5" aria-label={`Vitality ${vitality} of ${maxVitality}`}>
              {Array.from({ length: maxVitality }).map((_, idx) => {
                const isFull = idx < vitality;
                return (
                  <svg
                    key={idx}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="transition-transform duration-150"
                  >
                    {/* Dark Outer Silhouette */}
                    <path
                      d="M12 2 L15 6 L19 5 L16 9 C19 11 20 15 18 19 C16 22 8 22 6 19 C4 15 5 11 8 9 L5 5 L9 6 Z"
                      fill="#091e14"
                      stroke="#091e14"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    {/* Interior State Fill */}
                    <path
                      d="M12 3.5 L14.2 6.8 L17.2 6 L15 9.2 C17.5 11 18.2 14.5 16.5 18 C15 20.5 9 20.5 7.5 18 C5.8 14.5 6.5 11 9 9.2 L6.8 6 L9.8 6.8 Z"
                      fill={isFull ? '#ff2e55' : '#1e3a2f'}
                      stroke={isFull ? '#fda4af' : '#335c4a'}
                      strokeWidth="1"
                    />
                    {isFull && (
                      <circle cx="10" cy="13" r="1.6" fill="#ffe4e6" opacity="0.85" />
                    )}
                  </svg>
                );
              })}
            </div>
          </div>
        )}

        {/* Wave Counter */}
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-200/90 hud-stroke-sm">
            WAVE
          </span>
          <span className="font-mono-tabular font-bold text-2xl text-amber-300 hud-stroke">
            {Math.round(wave)}
          </span>
        </div>

        {/* Arcade Timer */}
        {gameMode === 'arcade' && (
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-200/90 hud-stroke-sm">
              TIME
            </span>
            <span
              className={`font-mono-tabular font-bold text-2xl hud-stroke ${
                timeRemainingSec <= 10 ? 'text-rose-400' : 'text-amber-50'
              }`}
            >
              {Math.round(timeRemainingSec)}s
            </span>
          </div>
        )}
      </div>

      {/* TOP-RIGHT PERIMETER CLUSTER: Utility Icon Buttons (Install/Share, Mute [M], Pause [P], Restart [R]) */}
      <div className="fixed top-5 right-6 flex items-center gap-2.5 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Download or Share Prabhu's Banana App"
          onClick={onOpenInstallShare}
          className="w-11 h-11 rounded-xl bg-[#0b2419]/90 border-2 border-amber-300/40 hover:border-amber-300 text-amber-100 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Download PC App / Share Game"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          onClick={onToggleMute}
          className="w-11 h-11 rounded-xl bg-[#0b2419]/90 border-2 border-amber-300/40 hover:border-amber-300 text-amber-100 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Mute / Unmute Tropical Audio [M]"
        >
          {isMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="#1e3a2f" />
              <line x1="23" y1="9" x2="17" y2="15" stroke="#fb7185" />
              <line x1="17" y1="9" x2="23" y2="15" stroke="#fb7185" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="#facc15" stroke="#fef08a" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#4ade80" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#2dd4bf" />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause Game (P)"
          onClick={onPause}
          className="w-11 h-11 rounded-xl bg-[#0b2419]/90 border-2 border-amber-300/40 hover:border-amber-300 text-amber-100 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Pause Game [Esc / P]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="#facc15" stroke="#091e14" strokeWidth="1.5" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="#facc15" stroke="#091e14" strokeWidth="1.5" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Restart Run"
          onClick={onRestart}
          className="w-11 h-11 rounded-xl bg-[#0b2419]/90 border-2 border-amber-300/40 hover:border-amber-300 text-amber-100 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Restart Run"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* MANDATORY BOTTOM-LEFT SCORE, STREAK & COMBO CLUSTER */}
      <div
        data-testid="score-counter-bottom-left"
        aria-label="Score, Streak, and Combo Counter"
        className="fixed bottom-6 left-6 flex flex-col gap-2.5 max-w-sm"
      >
        {/* Active Watercolor Combo Callout Banner */}
        {scoreState.lastCallout && (
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-sm tracking-wider uppercase text-amber-300 hud-stroke-sm whitespace-nowrap">
              {scoreState.lastCallout}
            </span>
          </div>
        )}

        {/* World-Matched Tropical Plaque for Score + Streak + Combo */}
        <div className="bg-[#092218]/92 border-2 border-amber-400/50 rounded-2xl px-5 py-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.65)] flex items-end gap-6">
          {/* Primary Hero Score Readout (~3:1 Hero-to-Kicker hierarchy) */}
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-300/90">
              SCORE
            </span>
            <span
              data-testid="hud-score-value"
              className="font-mono-tabular font-extrabold text-4xl leading-none text-amber-300 hud-stroke"
            >
              {Math.round(scoreState.score)}
            </span>
          </div>

          {/* Streak Counter */}
          <div className="flex flex-col border-l border-emerald-700/60 pl-5">
            <span className="text-[11px] font-bold tracking-widest uppercase text-pink-300/95">
              STREAK
            </span>
            <div className="flex items-baseline gap-1">
              <span
                data-testid="hud-streak-value"
                className="font-mono-tabular font-extrabold text-2xl leading-none text-pink-400 hud-stroke-sm"
              >
                {Math.round(scoreState.streak)}
              </span>
              <span className="text-xs font-semibold text-emerald-200/80">hits</span>
            </div>
          </div>

          {/* Combo Multiplier + Decay Bar */}
          <div className="flex flex-col border-l border-emerald-700/60 pl-5 min-w-[78px]">
            <span className="text-[11px] font-bold tracking-widest uppercase text-cyan-300/95">
              COMBO
            </span>
            <span
              data-testid="hud-combo-value"
              className="font-mono-tabular font-extrabold text-2xl leading-none text-cyan-300 hud-stroke-sm"
            >
              {Math.round(scoreState.combo)}x
            </span>
            {/* Live Combo Decay Bar */}
            <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden mt-1.5 border border-emerald-800/70">
              <div
                style={{
                  transform: `scaleX(${scoreState.combo > 1 ? comboProgress : 0})`,
                  transformOrigin: 'left',
                }}
                className="w-full h-full bg-gradient-to-r from-pink-500 via-amber-400 to-cyan-300 transition-transform duration-75"
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT PERIMETER: Banana Blaster Equipment & Peel Charge Indicator */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-1.5">
        <div className="bg-[#092218]/90 border-2 border-amber-400/40 rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3.5">
          {/* Custom SVG Banana Blaster Silhouette Icon */}
          <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
            <path
              d="M6 25 C8 16 15 9 26 6 C25 13 19 21 10 26 Z"
              fill="#facc15"
              stroke="#091e14"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M23 7 C26 4 29 5 28 8 M23 9 C26 11 25 14 22 13"
              fill="none"
              stroke="#fde047"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-200 whitespace-nowrap">
                {hud.isPeeling ? 'PEELING FRESH BANANA...' : 'BANANA BLASTER · WATERCOLOR PEEL'}
              </span>
              <span className="text-[11px] font-mono-tabular font-semibold text-emerald-300">
                [LMB / SPACE]
              </span>
            </div>
            {/* Discrete Potassium Peel Pips */}
            <div className="flex items-center gap-1.5 mt-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-5 rounded-sm transition-colors ${
                    hud.isPeeling
                      ? 'bg-pink-400 border border-pink-200'
                      : idx < peelCharge
                        ? 'bg-amber-300 border border-amber-100'
                        : 'bg-emerald-950 border border-emerald-800'
                  }`}
                />
              ))}
              <span className="text-[10px] font-mono-tabular text-emerald-200/80 ml-1">
                [R] Peel Reload
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 9. INTERACTIVE 3D FIRST-PERSON VIEWPORT & GAME LOOP
// ============================================================================
interface LiveHudSnapshot {
  scoreState: ScoreState;
  vitality: number;
  maxVitality: number;
  wave: number;
  timeRemainingSec: number;
  peelCharge: number; // 0..6 shots before auto-peel refresh
  isPeeling: boolean;
  activeFruitsCount: number;
  floatingPopups: FloatingScorePopup[];
}

interface FloatingScorePopup {
  id: number;
  xPercent: number;
  yPercent: number;
  text: string;
  subtext?: string;
  color: string;
  age: number;
}

interface AirborneFruit {
  id: number;
  kind: FruitKind;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  age: number;
  initialX: number;
  hitFlashTimer: number;
  dyingTimer: number; // > 0 when in brief squash/burst frame
}

interface BananaBolt {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  color: THREE.Color;
  age: number;
  maxAge: number;
}

interface GameCanvasProps {
  gameState: GameState;
  gameMode: GameMode;
  runNonce: number;
  onHudUpdate: (hud: LiveHudSnapshot) => void;
  onGameOver: (summary: RunSummarySnapshot) => void;
  crosshairRef: React.RefObject<HTMLDivElement | null>;
}

// Reusable scratch vectors outside the loop (Zero GC)
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toFruit = new THREE.Vector3();
const _closestPt = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _projTemp = new THREE.Vector3();
const _ndcMouse = new THREE.Vector2(0, 0);

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  gameMode,
  runNonce,
  onHudUpdate,
  onGameOver,
  crosshairRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store mutable React props/callbacks in refs so canvas is never torn down
  const gameStateRef = useRef<GameState>(gameState);
  const gameModeRef = useRef<GameMode>(gameMode);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onGameOverRef = useRef(onGameOver);
  const resetSignalRef = useRef<number>(runNonce);
  const lastHandledNonceRef = useRef<number>(-1);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
  }, [onHudUpdate]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    resetSignalRef.current = runNonce;
  }, [runNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Sky Gradient, Fog & Studio PMREM Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x38bdf8, 0.015);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & Attached First-Person Banana Blaster Rig
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 140);
    camera.position.set(0, 2.3, 6.5);
    scene.add(camera);

    const bananaGun: BananaGunRig = createBananaGunModel(maxAnisotropy);
    // Position Banana Blaster in bottom-right FPP hand slot
    bananaGun.root.position.set(0.46, -0.34, -0.82);
    bananaGun.root.rotation.set(0.08, -0.16, 0.04);
    camera.add(bananaGun.root);

    // 4. Warm/Cool Tropical Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x14532d, 0.95);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.1);
    sunLight.position.set(16, 28, 14);
    sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      const d = 24;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 70;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.75);
    rimLight.position.set(-14, 12, -20);
    scene.add(rimLight);

    // 5. Populate Tropical Jungle Clearing, Bamboo Mortars & Swaying Palms
    const envHandles = populateJungleEnvironment(scene, maxAnisotropy);
    const watercolorExplosions = new WatercolorExplosionManager(scene);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Mutable Simulation State
    let bestScoreSaved = 0;
    try {
      bestScoreSaved = Number(localStorage.getItem('banana_blaster_best') || '0') || 0;
    } catch {
      bestScoreSaved = 0;
    }

    let scoreState: ScoreState = createInitialScoreState(bestScoreSaved);
    let vitality = 5;
    const maxVitality = 5;
    let timeRemainingSec = 75;
    let elapsedPlaySec = 0;
    let spawnTimer = 0.35;
    let peelCharge = 6;
    let overchargeActive = false;

    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let gunRecoil = 0;
    let peelReloadTimer = 0;
    let muzzleFlashTimer = 0;

    let playerStrafeX = 0;
    let playerWalkPhase = 0;
    let aimNormX = 0.5; // 0..1 viewport X
    let aimNormY = 0.46; // 0..1 viewport Y
    let smoothAimX = 0.5;
    let smoothAimY = 0.46;
    let hasMovedMouse = false;

    const airborneFruits: AirborneFruit[] = [];
    const activeBolts: BananaBolt[] = [];
    const floatingPopups: FloatingScorePopup[] = [];
    let nextFruitId = 1;
    let nextPopupId = 1;
    let lastHudSyncTime = 0;
    let defeatDelayTimer = -1;

    // Input Tracking (Unified Held + Edge-Triggered)
    const keysHeld = new Set<string>();
    const raycaster = new THREE.Raycaster();

    const syncHudNow = () => {
      const diff = getDifficultyParams(elapsedPlaySec, gameModeRef.current);
      onHudUpdateRef.current({
        scoreState: { ...scoreState },
        vitality,
        maxVitality,
        wave: diff.wave,
        timeRemainingSec: Math.max(0, Math.ceil(timeRemainingSec)),
        peelCharge,
        isPeeling: peelReloadTimer > 0,
        activeFruitsCount: airborneFruits.length,
        floatingPopups: [...floatingPopups],
      });
    };

    const spawnFruitWave = (count: number, forceNoHazard = false) => {
      const diff = getDifficultyParams(elapsedPlaySec, gameModeRef.current);

      for (let i = 0; i < count; i++) {
        // Choose mortar cannon index
        const cannonIdx = (nextFruitId + i) % envHandles.cannons.length;
        const cannon = envHandles.cannons[cannonIdx];

        // Determine fruit kind
        let kind: FruitKind = 'watermelon';
        if (!forceNoHazard && Math.random() < diff.hazardChance) {
          kind = 'durian_bomb';
        } else {
          kind = NON_HAZARD_FRUITS[(nextFruitId + i * 2) % NON_HAZARD_FRUITS.length];
        }

        const mesh = createFruitModel(kind, maxAnisotropy);
        const startPos = new THREE.Vector3(
          cannon.position.x + (Math.random() - 0.5) * 0.6,
          cannon.position.y + 1.8,
          cannon.position.z + 0.5,
        );
        mesh.position.copy(startPos);
        scene.add(mesh);

        // Calculate juicy mid-air arc into the central viewing gallery (z = -6 to -11, x = -6 to +6)
        const targetX = (i - (count - 1) / 2) * 3.6 + (Math.random() - 0.5) * 2.2;
        const targetZ = -7.5 + (Math.random() - 0.5) * 2.5;
        const flightTime = 2.15 / diff.speedScale;
        const gravity = 9.4 * FRUIT_SPECS[kind].gravityScale;

        const vx = (targetX - startPos.x) / flightTime;
        const vz = (targetZ - startPos.z) / flightTime;
        // Peak height around y = 6.2 to 8.5 in mid-air
        const vy = 0.5 * gravity * flightTime + (2.4 + Math.random() * 1.4) / flightTime;

        // Cannon recoil pulse
        cannon.scale.set(1.18, 0.84, 1.18);

        airborneFruits.push({
          id: nextFruitId++,
          kind,
          mesh,
          position: startPos,
          velocity: new THREE.Vector3(vx, vy, vz),
          rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 3.8,
            (Math.random() - 0.5) * 4.2,
            (Math.random() - 0.5) * 3.2,
          ),
          age: 0,
          initialX: startPos.x,
          hitFlashTimer: 0,
          dyingTimer: 0,
        });
      }
    };

    const resetRun = () => {
      // Clear existing fruits
      for (const f of airborneFruits) {
        scene.remove(f.mesh);
      }
      airborneFruits.length = 0;

      for (const b of activeBolts) {
        scene.remove(b.mesh);
      }
      activeBolts.length = 0;
      floatingPopups.length = 0;
      watercolorExplosions.clearAll();

      scoreState = createInitialScoreState(bestScoreSaved);
      vitality = maxVitality;
      timeRemainingSec = gameModeRef.current === 'arcade' ? 75 : 999;
      elapsedPlaySec = 0;
      spawnTimer = 0.15;
      peelCharge = 6;
      overchargeActive = false;
      hitstopTimer = 0;
      cameraTrauma = 0;
      gunRecoil = 0;
      peelReloadTimer = 0;
      playerStrafeX = 0;
      defeatDelayTimer = -1;

      // Immediately launch an initial welcoming wave of 3 colourful fruits into mid-air
      spawnFruitWave(3, true);
      syncHudNow();
    };

    // Spawn a decorative wave for the Title Screen showcase
    spawnFruitWave(3, true);

    const addFloatingPopup = (
      worldPos: THREE.Vector3,
      text: string,
      color: string,
      subtext?: string,
    ) => {
      _projTemp.copy(worldPos).project(camera);
      if (_projTemp.z >= -1 && _projTemp.z <= 1) {
        const xPercent = Math.min(86, Math.max(14, (_projTemp.x + 1) * 50));
        let yPercent = Math.min(78, Math.max(16, (1 - _projTemp.y) * 50));
        // Prevent overlap with recent active popups
        for (const existing of floatingPopups) {
          if (Math.abs(existing.xPercent - xPercent) < 18 && Math.abs(existing.yPercent - yPercent) < 9) {
            yPercent = Math.max(14, existing.yPercent - 10);
          }
        }
        floatingPopups.push({
          id: nextPopupId++,
          xPercent,
          yPercent,
          text,
          subtext,
          color,
          age: 0,
        });
        if (floatingPopups.length > 6) {
          floatingPopups.shift();
        }
      }
    };

    const triggerReloadPeel = () => {
      peelCharge = 6;
      overchargeActive = true;
      peelReloadTimer = PEEL_RELOAD_DURATION;
      tropicalAudio.playReloadPeel();
      syncHudNow();
    };

    /**
     * Fires the Banana Blaster along the aimed viewport ray (or auto-locks onto the best
     * mid-air fruit when using keyboard Space without mouse movement).
     */
    const fireBananaBlaster = (clientX?: number, clientY?: number) => {
      if (gameStateRef.current !== 'playing' || defeatDelayTimer > 0) return;

      const rect = renderer.domElement.getBoundingClientRect();
      if (typeof clientX === 'number' && typeof clientY === 'number' && rect.width > 0 && rect.height > 0) {
        aimNormX = THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0.04, 0.96);
        aimNormY = THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0.04, 0.96);
        hasMovedMouse = true;
      } else if (!hasMovedMouse && airborneFruits.length > 0) {
        // Keyboard-only Space assist: aim smoothly at the highest non-hazard airborne fruit
        const candidate =
          airborneFruits.find((f) => !FRUIT_SPECS[f.kind].isHazard && f.position.y > 1.2) ||
          airborneFruits[0];
        if (candidate) {
          _projTemp.copy(candidate.position).project(camera);
          if (_projTemp.z >= -1 && _projTemp.z <= 1) {
            aimNormX = THREE.MathUtils.clamp((_projTemp.x + 1) * 0.5, 0.08, 0.92);
            aimNormY = THREE.MathUtils.clamp((1 - _projTemp.y) * 0.5, 0.08, 0.92);
          }
        }
      }

      if (crosshairRef.current) {
        crosshairRef.current.style.left = `${aimNormX * 100}%`;
        crosshairRef.current.style.top = `${aimNormY * 100}%`;
      }

      scoreState = {
        ...scoreState,
        shotsFired: scoreState.shotsFired + 1,
      };

      // Consume peel charge (auto-peels a fresh banana layer when reaching 0)
      if (peelCharge <= 1) {
        peelCharge = 6;
        peelReloadTimer = PEEL_RELOAD_DURATION;
        tropicalAudio.playReloadPeel();
      } else {
        peelCharge -= 1;
      }

      // Trigger Banana Blaster Recoil, Stem Hammer Kick & Muzzle Peel Flare
      gunRecoil = 1.0;
      muzzleFlashTimer = 0.09;
      cameraTrauma = Math.min(1, cameraTrauma + 0.22);
      tropicalAudio.playBananaShoot();

      // Compute 3D Aim Ray from Camera through (aimNormX, aimNormY)
      _ndcMouse.set(aimNormX * 2 - 1, -(aimNormY * 2 - 1));
      raycaster.setFromCamera(_ndcMouse, camera);
      _rayOrigin.copy(raycaster.ray.origin);
      _rayDir.copy(raycaster.ray.direction);

      // Find all airborne fruits intersected by our potassium watercolor blast cylinder
      const hitFruits: AirborneFruit[] = [];
      const splashBonusRadius = overchargeActive ? 0.65 : 0.25;
      overchargeActive = false;

      for (let i = 0; i < airborneFruits.length; i++) {
        const fruit = airborneFruits[i];
        if (fruit.dyingTimer > 0) continue;

        _toFruit.subVectors(fruit.position, _rayOrigin);
        const projDist = _toFruit.dot(_rayDir);
        if (projDist < 0.5) continue;

        _closestPt.copy(_rayOrigin).addScaledVector(_rayDir, projDist);
        const perpDist = _closestPt.distanceTo(fruit.position);
        const effectiveRadius = FRUIT_SPECS[fruit.kind].hitRadius + splashBonusRadius;

        if (perpDist <= effectiveRadius) {
          hitFruits.push(fruit);
        }
      }

      // Spawn Golden Banana Energy Tracer Bolt from Muzzle to Hit Point (or distant point)
      bananaGun.muzzlePoint.getWorldPosition(_muzzleWorld);
      const boltEnd =
        hitFruits.length > 0
          ? hitFruits[0].position.clone()
          : _rayOrigin.clone().addScaledVector(_rayDir, 28);

      const boltDist = _muzzleWorld.distanceTo(boltEnd);
      const boltGeo = new THREE.CylinderGeometry(0.035, 0.07, boltDist, 6);
      boltGeo.rotateX(Math.PI / 2);
      const boltColor =
        hitFruits.length > 0
          ? new THREE.Color(FRUIT_SPECS[hitFruits[0].kind].primaryColor)
          : new THREE.Color(0xfef08a);
      const boltMat = new THREE.MeshBasicMaterial({
        color: boltColor,
        transparent: true,
        opacity: 0.92,
      });
      const boltMesh = new THREE.Mesh(boltGeo, boltMat);
      boltMesh.position.copy(_muzzleWorld).lerp(boltEnd, 0.5);
      boltMesh.lookAt(boltEnd);
      scene.add(boltMesh);

      activeBolts.push({
        mesh: boltMesh,
        startPos: _muzzleWorld.clone(),
        endPos: boltEnd,
        color: boltColor,
        age: 0,
        maxAge: 0.18,
      });

      if (hitFruits.length > 0) {
        const hitKinds = hitFruits.map((f) => f.kind);
        const prevScore = scoreState.score;
        scoreState = registerFruitHits(scoreState, hitKinds);

        if (scoreState.bestScore > bestScoreSaved) {
          bestScoreSaved = scoreState.bestScore;
          try {
            localStorage.setItem('banana_blaster_best', String(bestScoreSaved));
          } catch {
            // ignore storage errors
          }
        }

        const hitHazard = hitKinds.some((k) => FRUIT_SPECS[k].isHazard);
        if (hitHazard) {
          tropicalAudio.playHazardHit();
          cameraTrauma = Math.min(1, cameraTrauma + 0.65);
          hitstopTimer = 0.065;
          if (gameModeRef.current !== 'zen') {
            vitality = Math.max(0, vitality - 1);
            if (vitality <= 0 && defeatDelayTimer < 0) {
              defeatDelayTimer = 0.55;
            }
          }
        } else {
          tropicalAudio.playFruitSplat(scoreState.combo, scoreState.streak);
          cameraTrauma = Math.min(1, cameraTrauma + 0.35 + hitFruits.length * 0.12);
          // Brief 45ms sim-level hitstop for heavy juicy watercolor impact feel
          hitstopTimer = Math.min(0.065, 0.038 + hitFruits.length * 0.012);
        }

        // Trigger Watercolor Explosion & Floating Score Popup for each splattered fruit
        const pointsDelta = scoreState.score - prevScore;
        for (let idx = 0; idx < hitFruits.length; idx++) {
          const f = hitFruits[idx];
          const spec = FRUIT_SPECS[f.kind];
          watercolorExplosions.spawnWatercolorExplosion(f.position, f.kind, camera);

          if (idx === 0) {
            const sign = pointsDelta >= 0 ? '+' : '';
            addFloatingPopup(
              f.position,
              `${sign}${pointsDelta}`,
              spec.primaryColor,
              scoreState.combo > 1
                ? `${scoreState.combo}X COMBO · ${scoreState.lastCallout}`
                : scoreState.lastCallout,
            );
          }

          // Remove fruit mesh from scene
          scene.remove(f.mesh);
          const arrIdx = airborneFruits.indexOf(f);
          if (arrIdx !== -1) {
            airborneFruits.splice(arrIdx, 1);
          }
        }

        // If playfield is now clear, queue a fresh wave soon so action stays brisk
        if (airborneFruits.length === 0) {
          spawnTimer = Math.min(spawnTimer, 0.35);
        }
      } else {
        // Missed shot resets streak & combo
        scoreState = registerMissedShot(scoreState);
      }

      syncHudNow();
    };

    // Expose clean test helper on window for deterministic inspection if needed
    (window as unknown as Record<string, unknown>).__BANANA_GAME__ = {
      fireAtCenterFruit: () => {
        const target = airborneFruits.find((f) => !FRUIT_SPECS[f.kind].isHazard) || airborneFruits[0];
        if (target) {
          _projTemp.copy(target.position).project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          const cx = rect.left + ((_projTemp.x + 1) * 0.5) * rect.width;
          const cy = rect.top + ((1 - _projTemp.y) * 0.5) * rect.height;
          fireBananaBlaster(cx, cy);
        } else {
          spawnFruitWave(2, true);
        }
      },
    };

    // 7. DOM & Window Event Listeners
    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      aimNormX = THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0.03, 0.97);
      aimNormY = THREE.MathUtils.clamp((e.clientY - rect.top) / rect.height, 0.03, 0.97);
      hasMovedMouse = true;

      if (crosshairRef.current) {
        crosshairRef.current.style.left = `${aimNormX * 100}%`;
        crosshairRef.current.style.top = `${aimNormY * 100}%`;
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (gameStateRef.current !== 'playing') return;
      fireBananaBlaster(e.clientX, e.clientY);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keysHeld.add(e.code);

      if (gameStateRef.current === 'playing') {
        if (e.code === 'Space') {
          e.preventDefault();
          fireBananaBlaster();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          triggerReloadPeel();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const onBlurOrVisibility = () => {
      keysHeld.clear();
    };

    const canvasEl = renderer.domElement;
    window.addEventListener('mousemove', onPointerMove);
    canvasEl.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlurOrVisibility);
    document.addEventListener('visibilitychange', onBlurOrVisibility);

    // ResizeObserver for crisp canvas & 2D watercolor overlay sizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = w;
        overlayCanvasRef.current.height = h;
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // 8. Main Simulation & Render Loop (with Software-WebGL `afterDraw` Pacing)
    let frameId = 0;
    let isUnmounted = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isUnmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const render2DWatercolorOverlay = () => {
      const oCanvas = overlayCanvasRef.current;
      if (!oCanvas) return;
      const ctx = oCanvas.getContext('2d');
      if (!ctx) return;

      const w = oCanvas.width;
      const h = oCanvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw active 2D screen-space watercolor wash splatters
      for (const sp of watercolorExplosions.screenSplats) {
        const t = sp.age / sp.maxAge;
        const alpha = (1 - Math.pow(t, 1.5)) * 0.44;
        if (alpha <= 0.01) continue;

        const cx = sp.normX * w;
        const cy = sp.normY * h;
        const r = sp.radiusPx * (0.75 + 0.45 * (1 - Math.pow(1 - t, 3)));

        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
        grad.addColorStop(0, sp.primaryColor);
        grad.addColorStop(0.58, sp.secondaryColor);
        grad.addColorStop(0.88, sp.rimColor);
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        const lobes = 12;
        for (let i = 0; i <= lobes; i++) {
          const a = (i / lobes) * Math.PI * 2;
          const rad = r * (1 + 0.18 * Math.sin(a * 3 + sp.seed) + 0.1 * Math.cos(a * 5));
          const px = cx + Math.cos(a) * rad;
          const py = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    function tick() {
      if (isUnmounted) return;
      const now = performance.now();
      // Clamp frame delta time to <= 0.05s
      const rawDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Check if a run reset was requested
      if (resetSignalRef.current !== lastHandledNonceRef.current) {
        lastHandledNonceRef.current = resetSignalRef.current;
        resetRun();
      }

      const state = gameStateRef.current;

      // Sway palm tree canopies gently in all states
      const swayTime = now * 0.0012;
      for (let i = 0; i < envHandles.palmCanopies.length; i++) {
        const canopy = envHandles.palmCanopies[i];
        canopy.rotation.z = Math.sin(swayTime + i * 1.3) * 0.06;
        canopy.rotation.x = Math.cos(swayTime * 0.8 + i) * 0.04;
      }

      // Relax cannon scale after launch recoil
      for (let i = 0; i < envHandles.cannons.length; i++) {
        const c = envHandles.cannons[i];
        c.scale.x = THREE.MathUtils.damp(c.scale.x, 1, 10, rawDt);
        c.scale.y = THREE.MathUtils.damp(c.scale.y, 1, 10, rawDt);
        c.scale.z = THREE.MathUtils.damp(c.scale.z, 1, 10, rawDt);
      }

      if (state === 'title') {
        // Atmospheric Live World Camera Pan + Showcase
        const tourAngle = Math.sin(now * 0.00045) * 0.28;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(tourAngle) * 3.2, 4, rawDt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.55 + Math.sin(now * 0.001) * 0.15, 4, rawDt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 6.8, 4, rawDt);
        camera.rotation.set(
          -0.04 + (0.5 - aimNormY) * 0.12,
          -tourAngle * 0.45 + (0.5 - aimNormX) * 0.18,
          0,
          'YXZ',
        );

        // Gently bob and track cursor with the Banana Blaster in showcase view
        smoothAimX = THREE.MathUtils.damp(smoothAimX, aimNormX, 12, rawDt);
        smoothAimY = THREE.MathUtils.damp(smoothAimY, aimNormY, 12, rawDt);
        bananaGun.root.position.set(
          0.44 + (smoothAimX - 0.5) * 0.35 + Math.cos(now * 0.002) * 0.02,
          -0.32 + (0.5 - smoothAimY) * 0.28 + Math.sin(now * 0.003) * 0.025,
          -0.8,
        );
        bananaGun.root.rotation.set(
          0.1 + (0.5 - smoothAimY) * 0.45,
          -0.2 + (0.5 - smoothAimX) * 0.55 + Math.sin(now * 0.0015) * 0.08,
          0.05,
        );
        const titlePeelPose = computeBananaPeelPose(0, 6, 0);
        for (let sIdx = 0; sIdx < bananaGun.peelStrips.length; sIdx++) {
          const stripRig = bananaGun.peelStrips[sIdx];
          stripRig.lowerMesh.rotation.x = titlePeelPose.strips[sIdx].lowerX;
          stripRig.upperPivot.rotation.x = titlePeelPose.strips[sIdx].upperX;
        }
      } else if (state === 'playing') {
        // Advance hitstop timer in real dt while pausing simulation physics
        let simDt = rawDt;
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - rawDt);
          simDt = 0;
        }

        // Defeat delay beat before opening Game Over modal
        if (defeatDelayTimer > 0) {
          defeatDelayTimer -= rawDt;
          if (defeatDelayTimer <= 0) {
            defeatDelayTimer = -1;
            const diff = getDifficultyParams(elapsedPlaySec, gameModeRef.current);
            onGameOverRef.current(
              createRunSnapshot(scoreState, gameModeRef.current, false, diff.wave, elapsedPlaySec),
            );
          }
        }

        if (simDt > 0 && defeatDelayTimer < 0) {
          elapsedPlaySec += simDt;

          // Arcade timer countdown
          if (gameModeRef.current === 'arcade') {
            timeRemainingSec -= simDt;
            if (timeRemainingSec <= 0) {
              timeRemainingSec = 0;
              const diff = getDifficultyParams(elapsedPlaySec, gameModeRef.current);
              onGameOverRef.current(
                createRunSnapshot(scoreState, gameModeRef.current, true, diff.wave, elapsedPlaySec),
              );
            }
          }

          // Step Combo Timer
          scoreState = stepComboTimer(scoreState, simDt);

          // WASD / Arrow Strafe Movement
          let moveDir = 0;
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) moveDir -= 1;
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) moveDir += 1;

          if (moveDir !== 0) {
            playerStrafeX = THREE.MathUtils.clamp(playerStrafeX + moveDir * 7.5 * simDt, -5.5, 5.5);
            playerWalkPhase += Math.abs(moveDir) * simDt * 9.5;
          }

          // Spawn mid-air fruit waves
          spawnTimer -= simDt;
          if (spawnTimer <= 0) {
            const diff = getDifficultyParams(elapsedPlaySec, gameModeRef.current);
            const count =
              diff.burstMin + Math.floor(Math.random() * (diff.burstMax - diff.burstMin + 1));
            spawnFruitWave(count);
            spawnTimer = diff.spawnIntervalSec;
          }

          // Update Airborne Fruits & Distinct Flight Archetypes
          for (let i = airborneFruits.length - 1; i >= 0; i--) {
            const f = airborneFruits[i];
            const spec = FRUIT_SPECS[f.kind];
            f.age += simDt;

            const gravity = 9.4 * spec.gravityScale;
            f.velocity.y -= gravity * simDt;

            // Distinct flight archetype motion policies
            if (spec.archetype === 'spiral_glider') {
              f.position.x += (f.velocity.x + Math.cos(f.age * 4.5) * 2.4) * simDt;
              f.position.y += f.velocity.y * simDt;
              f.position.z += f.velocity.z * simDt;
            } else if (spec.archetype === 'zigzag_darter') {
              const zig = Math.sin(f.age * 6.5) * 3.8;
              f.position.x += (f.velocity.x + zig) * simDt;
              f.position.y += f.velocity.y * simDt;
              f.position.z += f.velocity.z * simDt;
            } else {
              f.position.addScaledVector(f.velocity, simDt);
            }

            f.mesh.position.copy(f.position);
            f.mesh.rotation.x += f.rotSpeed.x * simDt;
            f.mesh.rotation.y += f.rotSpeed.y * simDt;
            f.mesh.rotation.z += f.rotSpeed.z * simDt;

            // Pulse hazard telegraph ring toward camera
            if (spec.isHazard) {
              const ring = f.mesh.getObjectByName('telegraphRing');
              if (ring) {
                ring.lookAt(camera.position);
                const pulse = 1 + Math.sin(f.age * 14) * 0.16;
                ring.scale.setScalar(pulse);
              }
            }

            // Check if fruit fell below the jungle floor
            if (f.position.y < -0.5) {
              scene.remove(f.mesh);
              airborneFruits.splice(i, 1);

              // In Survival mode, letting a non-hazard fruit drop breaks streak and costs 1 vitality
              if (!spec.isHazard && gameModeRef.current === 'survival') {
                scoreState = registerMissedShot(scoreState);
                vitality = Math.max(0, vitality - 1);
                if (vitality <= 0 && defeatDelayTimer < 0) {
                  defeatDelayTimer = 0.5;
                }
              }
            }
          }
        }

        // Camera Position, Gait Bob, Viewport Aim & Decaying Trauma Shake
        cameraTrauma = Math.max(0, cameraTrauma - rawDt * 2.4);
        const shakeAmt = cameraTrauma * cameraTrauma;
        const shakeX = (Math.random() - 0.5) * shakeAmt * 0.28;
        const shakeY = (Math.random() - 0.5) * shakeAmt * 0.28;
        const shakeRoll = (Math.random() - 0.5) * shakeAmt * 0.06;

        const targetCamX = playerStrafeX + (aimNormX - 0.5) * 1.4;
        const targetCamY = 2.3 + Math.sin(playerWalkPhase) * 0.06 + (0.5 - aimNormY) * 0.65;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 10, rawDt) + shakeX;
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 10, rawDt) + shakeY;
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 6.5, 8, rawDt);

        const targetYaw = (0.5 - aimNormX) * 0.34;
        const targetPitch = (0.48 - aimNormY) * 0.26;
        camera.rotation.set(
          THREE.MathUtils.damp(camera.rotation.x, targetPitch, 14, rawDt),
          THREE.MathUtils.damp(camera.rotation.y, targetYaw, 14, rawDt),
          shakeRoll,
          'YXZ',
        );

        // First-Person Banana Blaster Dynamic Crosshair Tracking & Multi-Stage Peeling Reload
        gunRecoil = THREE.MathUtils.damp(gunRecoil, 0, 14, rawDt);
        if (peelReloadTimer > 0) {
          peelReloadTimer = Math.max(0, peelReloadTimer - rawDt);
        }

        // Smoothly damp aim coordinates and calculate wrist-flick velocity sway
        const prevSmoothX = smoothAimX;
        const prevSmoothY = smoothAimY;
        smoothAimX = THREE.MathUtils.damp(smoothAimX, aimNormX, 20, rawDt);
        smoothAimY = THREE.MathUtils.damp(smoothAimY, aimNormY, 20, rawDt);
        const aimVelX = THREE.MathUtils.clamp((aimNormX - prevSmoothX) * 2.2, -0.45, 0.45);
        const aimVelY = THREE.MathUtils.clamp((aimNormY - prevSmoothY) * 2.2, -0.45, 0.45);

        // Compute deterministic Banana Peeling Reload Pose
        const peelPose = computeBananaPeelPose(peelReloadTimer, peelCharge, gunRecoil);

        // Position Banana Blaster so it actively follows the crosshair across the viewport
        // and lifts toward center-frame while peeling a fresh banana layer!
        const followX = (smoothAimX - 0.5) * 0.68;
        const followY = (0.48 - smoothAimY) * 0.56;
        const idleBobX = Math.cos(now * 0.0024) * 0.012 + Math.sin(playerWalkPhase * 0.5) * 0.022;
        const idleBobY = Math.sin(now * 0.0036) * 0.016 + Math.abs(Math.cos(playerWalkPhase)) * 0.024;

        const handX = 0.40 + followX * (1 - peelPose.presentWeight * 0.5) - peelPose.presentWeight * 0.20 + idleBobX;
        const handY = -0.32 + followY * (1 - peelPose.presentWeight * 0.5) + peelPose.presentWeight * 0.15 - gunRecoil * 0.07 + idleBobY;
        const handZ = -0.78 + gunRecoil * 0.16 - peelPose.presentWeight * 0.12;

        bananaGun.root.position.set(handX, handY, handZ);

        // Compute exact camera-local convergence angles so the banana barrel points directly at the crosshair ray
        const targetLocalX = (smoothAimX - 0.5) * 8.2;
        const targetLocalY = (0.5 - smoothAimY) * 5.2;
        const targetLocalZ = -7.5;
        const convergeYaw = Math.atan2(handX - targetLocalX, handZ - targetLocalZ);
        const convergePitch = Math.atan2(targetLocalY - (handY + 0.16), Math.abs(handZ - targetLocalZ));

        const trackPitch = convergePitch - aimVelY * 0.45 + gunRecoil * 0.42;
        const trackYaw = convergeYaw - aimVelX * 0.55;
        const trackRoll = (0.5 - smoothAimX) * 0.35 - aimVelX * 0.95;

        bananaGun.root.rotation.set(
          trackPitch * (1 - peelPose.presentWeight * 0.65) + peelPose.inspectPitch,
          trackYaw * (1 - peelPose.presentWeight * 0.65) + peelPose.inspectYaw,
          0.04 + trackRoll + peelPose.inspectRoll,
          'YXZ',
        );

        // Apply articulated 4-strip Banana Peeling angles & fresh banana pulp emergence
        for (let sIdx = 0; sIdx < bananaGun.peelStrips.length; sIdx++) {
          const stripRig = bananaGun.peelStrips[sIdx];
          const poseStrip = peelPose.strips[sIdx] || peelPose.strips[0];
          stripRig.lowerMesh.rotation.x = poseStrip.lowerX;
          stripRig.upperPivot.rotation.x = poseStrip.upperX;
        }
        bananaGun.innerPulpBarrel.scale.set(
          peelPose.pulpScale,
          peelPose.pulpScale,
          peelPose.pulpScale,
        );
        bananaGun.stemHammer.rotation.x = peelPose.stemAngleX;

        // Muzzle Flash
        if (muzzleFlashTimer > 0) {
          muzzleFlashTimer -= rawDt;
          (bananaGun.muzzleFlash.material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, muzzleFlashTimer / 0.09);
          bananaGun.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.6);
          bananaGun.muzzleFlash.rotation.z += 0.5;
        } else {
          (bananaGun.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0;
        }

        // Update Banana Energy Tracer Bolts
        for (let i = activeBolts.length - 1; i >= 0; i--) {
          const b = activeBolts[i];
          b.age += rawDt;
          if (b.age >= b.maxAge) {
            scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            (b.mesh.material as THREE.Material).dispose();
            activeBolts.splice(i, 1);
          } else {
            (b.mesh.material as THREE.MeshBasicMaterial).opacity =
              (1 - b.age / b.maxAge) * 0.9;
          }
        }

        // Update Floating Score Popups
        for (let i = floatingPopups.length - 1; i >= 0; i--) {
          floatingPopups[i].age += rawDt;
          floatingPopups[i].yPercent -= rawDt * 14;
          if (floatingPopups[i].age >= 1.1) {
            floatingPopups.splice(i, 1);
          }
        }

        // Update Watercolor Explosions & Ground Decals
        watercolorExplosions.update(rawDt);
        render2DWatercolorOverlay();

        // Throttle React HUD updates to ~10Hz
        if (now - lastHudSyncTime > 95) {
          lastHudSyncTime = now;
          syncHudNow();
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isUnmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', onPointerMove);
      canvasEl.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlurOrVisibility);
      document.removeEventListener('visibilitychange', onBlurOrVisibility);
      renderer.dispose();
    };
  }, [crosshairRef]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Isolated Three.js WebGL Mount */}
      <div
        ref={mountRef}
        data-testid="game-canvas-mount"
        className="w-full h-full cursor-crosshair"
      />
      {/* 2D Watercolor Wash Splatter Overlay (pointer-events: none) */}
      <canvas
        ref={overlayCanvasRef}
        className="fixed inset-0 pointer-events-none z-10"
      />
    </div>
  );
};

// ============================================================================
// 10. MAIN APPLICATION ENTRY COMPONENT
// ============================================================================
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */








export default function App() {
  const initialState: GameState = (() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  })();

  const [gameState, setGameState] = useState<GameState>(initialState);
  const [gameMode, setGameMode] = useState<GameMode>('arcade');
  const [runNonce, setRunNonce] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [runSummary, setRunSummary] = useState<RunSummarySnapshot | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  const {
    isInstallable,
    isInstalled,
    isIOS,
    isOnline,
    install,
    downloadDesktopShortcut,
    downloadPortableExeBuilder,
    fetchSingleFileSource,
  } = usePWAInstall();

  const [hud, setHud] = useState<LiveHudSnapshot>(() => ({
    scoreState: createInitialScoreState(0),
    vitality: 5,
    maxVitality: 5,
    wave: 1,
    timeRemainingSec: 75,
    peelCharge: 6,
    isPeeling: false,
    activeFruitsCount: 0,
    floatingPopups: [],
  }));

  const crosshairRef = useRef<HTMLDivElement | null>(null);

  // Sync game state to document.body.dataset.state & control tropical audio loops
  useEffect(() => {
    document.body.dataset.state = gameState;
    if (gameState === 'playing') {
      tropicalAudio.startLoops();
    } else {
      tropicalAudio.stopLoops();
    }
  }, [gameState]);

  const startGame = useCallback(
    (modeOverride?: GameMode) => {
      if (modeOverride) {
        setGameMode(modeOverride);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setIsInstallModalOpen(false);
      document.body.dataset.state = 'playing';
      setRunSummary(null);
      setRunNonce((n) => n + 1);
      setGameState('playing');
      tropicalAudio.startLoops();
    },
    [],
  );

  const handleToggleMute = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.currentTarget.blur();
    const nextMuted = tropicalAudio.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  const handlePauseToggle = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.currentTarget.blur();
    setGameState((prev) => {
      if (prev === 'playing') {
        document.exitPointerLock?.();
        return 'paused';
      }
      if (prev === 'paused') {
        return 'playing';
      }
      return prev;
    });
  }, []);

  const handleRestart = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.currentTarget.blur();
    setIsInstallModalOpen(false);
    document.body.dataset.state = 'playing';
    setRunSummary(null);
    setRunNonce((n) => n + 1);
    setGameState('playing');
    tropicalAudio.startLoops();
  }, []);

  const handleOpenInstallShare = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.currentTarget.blur();
    document.exitPointerLock?.();
    setGameState((prev) => (prev === 'playing' ? 'paused' : prev));
    setIsInstallModalOpen(true);
  }, []);

  const handleInstallButtonClick = useCallback(async () => {
    if (isInstallable && !isInstalled) {
      const accepted = await install();
      if (accepted) return;
    }
    setIsInstallModalOpen(true);
  }, [isInstallable, isInstalled, install]);

  const handleGameOver = useCallback((summary: RunSummarySnapshot) => {
    document.exitPointerLock?.();
    if (summary.victory) {
      tropicalAudio.playVictoryFanfare();
    } else {
      tropicalAudio.playHazardHit();
    }
    setRunSummary(summary);
    setGameState('gameover');
  }, []);

  // Global keyboard shortcuts for Title start (Enter/Space), Pause (Esc/P), and Mute (M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (isInstallModalOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setIsInstallModalOpen(false);
        }
        return;
      }

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing' || gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePauseToggle();
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          handleToggleMute();
        }
      } else if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, isInstallModalOpen, startGame, handlePauseToggle, handleToggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a2117]">
      {/* Non-intrusive Offline Ready Banner (when offline) */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-400 text-[#071a12] text-xs font-extrabold tracking-wider uppercase py-1.5 px-4 text-center shadow-md">
          Offline Mode Active — Prabhu&apos;s Banana is cached and playable offline
        </div>
      )}

      {/* Persistent 3D Tropical FPP Viewport */}
      <GameCanvas
        gameState={gameState}
        gameMode={gameMode}
        runNonce={runNonce}
        onHudUpdate={setHud}
        onGameOver={handleGameOver}
        crosshairRef={crosshairRef}
      />

      {/* Active Gameplay HUD */}
      {gameState === 'playing' && (
        <GameHud
          hud={hud}
          gameMode={gameMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePauseToggle}
          onRestart={handleRestart}
          onOpenInstallShare={handleOpenInstallShare}
          crosshairRef={crosshairRef}
        />
      )}

      {/* TITLE SCREEN OVERLAY (Asymmetric Left-Third Negative Space Composition) */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-8 md:p-12 bg-gradient-to-r from-[#071a12]/90 via-[#071a12]/45 to-transparent">
          {/* Top-Left Bespoke Inline SVG Title Lockup & Mode Selection */}
          <div className="pointer-events-auto max-w-lg flex flex-col items-start gap-6 mt-2">
            {/* Custom Inline SVG Emblem & Display Lockup for Prabhu's Banana */}
            <svg
              viewBox="0 0 490 158"
              className="w-full max-w-[465px] overflow-visible drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]"
              role="img"
              aria-label="Prabhu's Banana: Tropical Watercolor Splat"
            >
              {/* Watercolor Splat Backing Blotches in SVG */}
              <path
                d="M36 42 C68 12, 145 18, 185 45 C225 22, 310 18, 375 52 C410 85, 380 132, 320 135 C220 142, 110 138, 45 118 C12 95, 14 62, 36 42 Z"
                fill="#ff1f8f"
                opacity="0.28"
              />
              <path
                d="M78 28 C140 8, 260 15, 360 38 C405 62, 390 118, 335 128 C215 135, 115 125, 62 98 Z"
                fill="#06b6d4"
                opacity="0.24"
              />
              {/* Curved Golden Banana Icon Integrated in Emblem */}
              <path
                d="M18 98 C22 52, 58 20, 106 12 C96 46, 68 82, 28 104 Z"
                fill="#facc15"
                stroke="#071a12"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="M95 16 C108 6, 120 12, 112 24"
                fill="none"
                stroke="#fde047"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              {/* Main Display Title Text: PRABHU'S BANANA */}
              <text
                x="78"
                y="72"
                fontFamily="'Bricolage Grotesque', sans-serif"
                fontWeight="800"
                fontSize="50"
                fill="#facc15"
                stroke="#071a12"
                strokeWidth="9"
                paintOrder="stroke fill"
                letterSpacing="-0.5"
              >
                PRABHU&apos;S
              </text>
              <text
                x="78"
                y="124"
                fontFamily="'Bricolage Grotesque', sans-serif"
                fontWeight="800"
                fontSize="52"
                fill="#ff2e93"
                stroke="#071a12"
                strokeWidth="9"
                paintOrder="stroke fill"
                letterSpacing="0.5"
              >
                BANANA
              </text>
              <text
                x="82"
                y="148"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontWeight="700"
                fontSize="13.5"
                fill="#a7f3d0"
                letterSpacing="3.2"
              >
                TROPICAL WATERCOLOR SPLATTER
              </text>
            </svg>

            {/* Interactive Mode Selector (Segmented Functional Buttons) */}
            <div className="flex flex-col gap-2 w-full">
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-200/90">
                Select Tropical Mode
              </span>
              <div className="grid grid-cols-3 gap-2.5 bg-[#092218]/90 p-1.5 rounded-xl border border-emerald-700/60">
                <button
                  type="button"
                  onClick={() => setGameMode('arcade')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    gameMode === 'arcade'
                      ? 'bg-amber-400 text-[#071a12] shadow-sm'
                      : 'text-emerald-100 hover:bg-emerald-900/60'
                  }`}
                >
                  Arcade Blitz (75s)
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('survival')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    gameMode === 'survival'
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'text-emerald-100 hover:bg-emerald-900/60'
                  }`}
                >
                  Survival Streak
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('zen')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    gameMode === 'zen'
                      ? 'bg-cyan-400 text-[#071a12] shadow-sm'
                      : 'text-emerald-100 hover:bg-emerald-900/60'
                  }`}
                >
                  Watercolor Zen
                </button>
              </div>
            </div>

            {/* Primary Start Action Button (`data-start="true"`) & Utility Row */}
            <div className="flex flex-col gap-3 w-full pt-1">
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startGame()}
                  className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-[#071a12] font-display font-extrabold text-xl tracking-tight shadow-[0_8px_0_#b45309] transition-all cursor-pointer whitespace-nowrap"
                >
                  Start Splattering
                </button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="px-4 py-4 rounded-2xl bg-[#0b291d]/90 hover:bg-[#113828] text-emerald-100 border border-emerald-600/50 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isMuted ? 'Audio: Muted' : 'Audio: Jungle Live'}
                </button>
              </div>

              {/* PC Portable .EXE, Single-File & Share Bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="title-portable-exe-btn"
                  onClick={downloadPortableExeBuilder}
                  className="px-4 py-2.5 rounded-xl bg-[#0b291d]/95 hover:bg-emerald-800/90 text-amber-200 border border-amber-400/60 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>Portable .EXE Script (.bat)</span>
                </button>

                <button
                  type="button"
                  data-testid="title-install-app-btn"
                  onClick={handleInstallButtonClick}
                  className="px-4 py-2.5 rounded-xl bg-[#0b291d]/95 hover:bg-emerald-800/90 text-emerald-100 border border-emerald-500/50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{isInstalled ? 'App Installed' : 'Single-File / Install'}</span>
                </button>

                <button
                  type="button"
                  data-testid="title-share-app-btn"
                  onClick={() => setIsInstallModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#0b291d]/95 hover:bg-emerald-800/90 text-pink-300 border border-pink-400/50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span>Share App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Single Flat Borderless Inline Control Hint Line in Bottom Safe Margin */}
          <div className="w-full flex items-center justify-between text-xs font-semibold text-emerald-100/90 hud-stroke-sm">
            <span>
              Mouse Aim &amp; Left-Click / Space Shoot · A/D Strafe · R Peel Reload · M Audio · Esc Pause
            </span>
            {hud.scoreState.bestScore > 0 && (
              <span className="font-mono-tabular text-amber-300">
                BEST SCORE: {Math.round(hud.scoreState.bestScore)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL (`document.body.dataset.state === 'paused'`) */}
      {gameState === 'paused' && !isInstallModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#05140e]/80 p-6"
        >
          <div className="w-full max-w-md bg-[#092419] border-2 border-amber-400/60 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-6">
            <h2
              id="pause-modal-title"
              className="font-display font-extrabold text-3xl text-amber-300 tracking-tight"
            >
              Prabhu&apos;s Banana Paused
            </h2>

            {/* Current Run Snapshot Tiles */}
            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="bg-[#061810] border border-emerald-800/70 rounded-xl p-3 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  SCORE
                </span>
                <span className="font-mono-tabular font-bold text-xl text-amber-300">
                  {Math.round(hud.scoreState.score)}
                </span>
              </div>
              <div className="bg-[#061810] border border-emerald-800/70 rounded-xl p-3 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
                  STREAK
                </span>
                <span className="font-mono-tabular font-bold text-xl text-pink-400">
                  {Math.round(hud.scoreState.streak)}
                </span>
              </div>
              <div className="bg-[#061810] border border-emerald-800/70 rounded-xl p-3 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  MAX COMBO
                </span>
                <span className="font-mono-tabular font-bold text-xl text-cyan-300">
                  {Math.round(hud.scoreState.maxCombo)}x
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => handlePauseToggle()}
                className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#071a12] font-display font-extrabold text-base cursor-pointer transition-colors"
              >
                Resume Game
              </button>
              <button
                type="button"
                onClick={() => handleRestart()}
                className="w-full py-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-amber-100 font-bold text-sm cursor-pointer transition-colors"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(true)}
                className="w-full py-3 rounded-xl bg-[#061810] hover:bg-emerald-900 border border-amber-400/40 text-amber-200 font-bold text-sm cursor-pointer transition-colors"
              >
                Download PC App / Share Link
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-3 rounded-xl bg-transparent hover:bg-emerald-950 text-emerald-300 font-semibold text-sm cursor-pointer transition-colors"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL (`document.body.dataset.state === 'gameover'`) */}
      {gameState === 'gameover' && runSummary && !isInstallModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-modal-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#05140e]/85 p-6"
        >
          <div className="w-full max-w-lg bg-[#092419] border-2 border-amber-400/70 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-pink-400">
                {runSummary.victory ? 'PRABHU’S BANANA MASTERPIECE' : 'JUNGLE RUN ENDED'}
              </span>
              <h2
                id="gameover-modal-title"
                className="font-display font-extrabold text-4xl text-amber-300 tracking-tight"
              >
                {runSummary.victory ? 'Watercolor Harvest!' : 'Out of Vitality!'}
              </h2>
            </div>

            {/* 3 Tabular-Nums Stat Tiles */}
            <div className="grid grid-cols-3 gap-3.5 w-full">
              <div className="bg-[#061810] border border-emerald-800/80 rounded-2xl p-4 flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  FINAL SCORE
                </span>
                <span className="font-mono-tabular font-extrabold text-2xl text-amber-300 mt-1">
                  {runSummary.score}
                </span>
                <span className="text-[11px] font-mono-tabular text-emerald-400/80 mt-0.5">
                  Best: {runSummary.bestScore}
                </span>
              </div>

              <div className="bg-[#061810] border border-emerald-800/80 rounded-2xl p-4 flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-300">
                  BEST STREAK
                </span>
                <span className="font-mono-tabular font-extrabold text-2xl text-pink-400 mt-1">
                  {runSummary.maxStreak}
                </span>
                <span className="text-[11px] font-mono-tabular text-pink-300/80 mt-0.5">
                  Max Combo: {runSummary.maxCombo}x
                </span>
              </div>

              <div className="bg-[#061810] border border-emerald-800/80 rounded-2xl p-4 flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  SPLATTERED
                </span>
                <span className="font-mono-tabular font-extrabold text-2xl text-cyan-300 mt-1">
                  {runSummary.fruitsSplattered}
                </span>
                <span className="text-[11px] font-mono-tabular text-cyan-200/80 mt-0.5">
                  Wave {runSummary.waveReached} · {runSummary.accuracyPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame()}
                className="flex-1 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#071a12] font-display font-extrabold text-lg shadow-[0_6px_0_#b45309] cursor-pointer transition-all"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(true)}
                className="px-5 py-4 rounded-2xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-sm cursor-pointer transition-colors"
              >
                Share / Install
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="px-5 py-4 rounded-2xl bg-emerald-900/90 hover:bg-emerald-800 text-amber-100 font-bold text-sm cursor-pointer transition-colors"
              >
                Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD PC APP & SHARE MODAL */}
      <InstallShareModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onInstallPWA={install}
        onDownloadDesktopApp={downloadDesktopShortcut}
        onDownloadPortableExeBuilder={downloadPortableExeBuilder}
        onFetchSingleFileSource={fetchSingleFileSource}
      />
    </main>
  );
}

export {
  COMBO_WINDOW_SECONDS,
  MAX_COMBO_MULTIPLIER,
  PEEL_RELOAD_DURATION,
  FRUIT_SPECS,
  createInitialScoreState,
  registerFruitHits,
  registerMissedShot,
  stepComboTimer,
  getDifficultyParams,
  createRunSnapshot,
  computeBananaPeelPose,
};
