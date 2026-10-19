import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validateConfig, bindSegment } from './music-config.js';

test('reject invalid times, volumes and unsafe media paths', () => {
  for (const patch of [{ start: -1 }, { end: 0 }, { end: NaN }, { volume: 2 }, { src: 'assets/../secret' }, { src: 'javascript:alert(1)' }]) {
    assert.throws(() => validateConfig({ ...defaults, opening: { ...defaults.opening, ...patch } }));
  }
  assert.deepEqual(validateConfig(defaults), defaults);
});

class Track extends EventTarget {
  currentTime = 0;
  pauses = 0;
  plays = 0;
  pause() { this.pauses++; }
  play() { this.plays++; return Promise.resolve(); }
}

test('loops only the selected segment and detaches preview handlers', () => {
  const track = new Track();
  const unbind = bindSegment(track, { start: 30, end: 45, loop: true });
  track.currentTime = 44; track.dispatchEvent(new Event('timeupdate'));
  assert.equal(track.plays, 0);
  track.currentTime = 45; track.dispatchEvent(new Event('timeupdate'));
  assert.equal(track.currentTime, 30); assert.equal(track.plays, 1);
  track.dispatchEvent(new Event('ended'));
  assert.equal(track.plays, 2);
  unbind(); track.currentTime = 45; track.dispatchEvent(new Event('timeupdate'));
  assert.equal(track.plays, 2);
});

test('stops at selected endpoint when repeat is disabled', () => {
  const track = new Track();
  bindSegment(track, { start: 8, end: 12, loop: false });
  track.currentTime = 12; track.dispatchEvent(new Event('timeupdate'));
  assert.equal(track.pauses, 1); assert.equal(track.plays, 0);
});
