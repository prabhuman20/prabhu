import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialScoreState,
  registerFruitHits,
  registerMissedShot,
  stepComboTimer,
  getDifficultyParams,
  createRunSnapshot,
  COMBO_WINDOW_SECONDS,
} from './App';

test('single fruit hit increments score, streak, and sets combo timer', () => {
  const initial = createInitialScoreState(500);
  const next = registerFruitHits(initial, ['watermelon']);

  assert.equal(next.streak, 1);
  assert.equal(next.maxStreak, 1);
  assert.equal(next.combo, 1);
  assert.equal(next.score, 100);
  assert.equal(next.bestScore, 500);
  assert.equal(next.comboTimer, COMBO_WINDOW_SECONDS);
  assert.equal(next.fruitsSplattered, 1);
});

test('consecutive rapid hits within combo window build combo multiplier and streak bonus', () => {
  let state = createInitialScoreState(0);
  state = registerFruitHits(state, ['watermelon']); // streak 1, combo 1 -> +100
  state = stepComboTimer(state, 0.5); // still inside combo window
  state = registerFruitHits(state, ['mango']); // streak 2, combo 2 -> 120 * 2 = 240
  state = stepComboTimer(state, 0.4);
  state = registerFruitHits(state, ['dragonfruit']); // streak 3 (1.15x), combo 3 -> round(160 * 3 * 1.15) = 552

  assert.equal(state.streak, 3);
  assert.equal(state.combo, 3);
  assert.equal(state.maxCombo, 3);
  assert.equal(state.score, 100 + 240 + 552);
  assert.equal(state.bestScore, 892);
});

test('multi-fruit splat in single banana blast awards multi-splat bonus and climbs combo', () => {
  const initial = createInitialScoreState(0);
  const next = registerFruitHits(initial, ['watermelon', 'pineapple']);

  assert.equal(next.streak, 2);
  assert.equal(next.combo, 2);
  assert.equal(next.multiSplats, 1);
  assert.ok(next.score > 500, 'Expected multi-splat bonus to boost score above 500');
  assert.equal(next.lastCallout, 'DOUBLE PIGMENT SPLASH!');
});

test('missed shot resets streak and combo while preserving score and bestStreak', () => {
  let state = createInitialScoreState(0);
  state = registerFruitHits(state, ['pineapple']);
  state = registerFruitHits(state, ['starfruit']);
  assert.equal(state.streak, 2);
  assert.equal(state.combo, 2);

  const afterMiss = registerMissedShot(state);
  assert.equal(afterMiss.streak, 0);
  assert.equal(afterMiss.combo, 1);
  assert.equal(afterMiss.comboTimer, 0);
  assert.equal(afterMiss.maxStreak, 2);
  assert.equal(afterMiss.score, state.score);
});

test('hitting durian bomb hazard deducts points and resets streak/combo', () => {
  let state = createInitialScoreState(0);
  state = registerFruitHits(state, ['pineapple']);
  state = registerFruitHits(state, ['pineapple']);
  const scoreBefore = state.score;

  const afterBomb = registerFruitHits(state, ['durian_bomb']);
  assert.equal(afterBomb.streak, 0);
  assert.equal(afterBomb.combo, 1);
  assert.equal(afterBomb.score, scoreBefore - 150);
});

test('combo timer expires cleanly back to 1x when time runs out without breaking streak', () => {
  let state = createInitialScoreState(0);
  state = registerFruitHits(state, ['watermelon']);
  state = registerFruitHits(state, ['mango']);
  assert.equal(state.combo, 2);
  assert.equal(state.streak, 2);

  state = stepComboTimer(state, COMBO_WINDOW_SECONDS + 0.2);
  assert.equal(state.combo, 1);
  assert.equal(state.comboTimer, 0);
  assert.equal(state.streak, 2); // streak remains intact until a miss or hazard
});

test('difficulty ramp keeps opening 12s hazard-free and ramps across time', () => {
  const early = getDifficultyParams(4, 'arcade');
  const late = getDifficultyParams(75, 'arcade');
  const zenLate = getDifficultyParams(75, 'zen');

  assert.equal(early.hazardChance, 0);
  assert.ok(late.hazardChance > 0.1);
  assert.ok(late.spawnIntervalSec < early.spawnIntervalSec);
  assert.equal(zenLate.hazardChance, 0);
});

test('createRunSnapshot computes bounded accuracy percentage and integer metrics', () => {
  let state = createInitialScoreState(1000);
  state.shotsFired = 10;
  state = registerFruitHits(state, ['watermelon', 'mango']); // 2 hits
  const snap = createRunSnapshot(state, 'arcade', true, 4, 60.4);

  assert.equal(snap.accuracyPercent, 20);
  assert.equal(snap.fruitsSplattered, 2);
  assert.equal(snap.durationSec, 60);
});

test('computeBananaPeelPose animates 4 peel strips from closed to peeled open during reload', async () => {
  const { computeBananaPeelPose, PEEL_RELOAD_DURATION } = await import('./App');

  // Start of reload (timer near PEEL_RELOAD_DURATION -> progress ~ 0.05)
  const startPose = computeBananaPeelPose(PEEL_RELOAD_DURATION * 0.92, 6, 0);
  assert.equal(startPose.isPeeling, true);
  // Strips start closed near 0 rad
  assert.ok(startPose.strips[0].upperX > -0.2, 'Expected strip 0 to start closed');
  assert.ok(startPose.strips[3].upperX > -0.2, 'Expected strip 3 to start closed');

  // Mid reload (progress ~ 0.42): strip 0 is peeled open while strip 3 is still mostly closed
  const midPose = computeBananaPeelPose(PEEL_RELOAD_DURATION * 0.58, 6, 0);
  assert.ok(midPose.presentWeight > 0.8, 'Expected banana to be raised into view');
  assert.ok(
    midPose.strips[0].upperX < midPose.strips[3].upperX - 0.4,
    'Expected strip 0 to peel down before strip 3',
  );

  // End of reload (timer = 0)
  const readyPose = computeBananaPeelPose(0, 6, 0);
  assert.equal(readyPose.isPeeling, false);
  assert.ok(readyPose.strips[0].upperX < -0.8, 'Expected all strips peeled open when ready');
});

