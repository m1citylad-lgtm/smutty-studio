'use strict';

const assert = require('node:assert/strict');
const { eraseConnectedBackground } = require('../assets/js/flat-background.js');

(async () => {
  const width = 9, height = 9, first = [240, 240, 240], second = [180, 180, 180], art = [210, 50, 70];
  const original = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4, color = ((x < 3) === (y < 3)) ? first : second;
    original.set([...color, 255], p);
  }
  // Enclose an identical background pixel within a ring of artwork.
  for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) original.set([...art, 255], (y * width + x) * 4);
  original.set([...first, 255], (4 * width + 4) * 4);
  original.set([...art, 128], (4 * width + 3) * 4);
  const sourceSnapshot = new Uint8ClampedArray(original), pixels = new Uint8ClampedArray(original), progress = [];
  const removed = await eraseConnectedBackground(pixels, width, height, [first, second], 0, (checked) => progress.push(checked));
  assert.ok(removed > 0);
  assert.deepEqual(Array.from(original), Array.from(sourceSnapshot), 'Source bytes are not modified');
  assert.deepEqual(Array.from(pixels.slice((4 * width + 4) * 4, (4 * width + 4) * 4 + 4)), [...first, 255], 'Enclosed same-colour pixels remain opaque');
  assert.deepEqual(Array.from(pixels.slice((4 * width + 3) * 4, (4 * width + 3) * 4 + 4)), [...art, 128], 'Unmatched partial-alpha artwork remains unchanged');
  assert.ok(progress.length > 0, 'Progress callback is provided');
  assert.equal(pixels.length, width * height * 4, 'Dimensions and buffer size are preserved');

  const noMatch = new Uint8ClampedArray(original);
  assert.equal(await eraseConnectedBackground(noMatch, width, height, [[1, 2, 3]], 0), 0);
  assert.deepEqual(Array.from(noMatch), Array.from(original), 'No-match case leaves the candidate pixels unchanged');

  const single = new Uint8ClampedArray(original);
  assert.ok(await eraseConnectedBackground(single, width, height, first, 0) > 0, 'Existing single-colour API remains compatible');
  console.log('PASS: one/two-colour edge-connected removal, no-match, enclosed regions, alpha/source preservation, dimensions and progress');
})().catch((error) => { console.error(error); process.exitCode = 1; });
