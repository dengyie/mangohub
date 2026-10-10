import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobeSamples, GLOBE_SIZE, projectGlobeLocation, textureColumn, TEXTURE_HEIGHT, TEXTURE_WIDTH } from '../src/components/pixelGlobeGeometry.ts';

test('pixel globe wraps the dateline and negative turns without invalid texture indices', () => {
  for (const longitude of [-900, -540, -360, -180, -0.1, 0, 180, 360, 540, 900]) {
    const column = textureColumn(longitude);
    assert.ok(column >= 0 && column < TEXTURE_WIDTH);
    assert.equal(column, textureColumn(longitude + 360));
  }
  assert.equal(textureColumn(0), TEXTURE_WIDTH / 2);
  assert.equal(textureColumn(180), 0);
});

test('sphere sampling stays bounded and round-trips through the marker projection', () => {
  const samples = createGlobeSamples();
  assert.ok(samples.length > 6000 && samples.length < 6500);
  for (const sample of samples) {
    assert.ok(sample.row >= 0 && sample.row < TEXTURE_HEIGHT);
    const latitude = 90 - (sample.row + 0.5) / TEXTURE_HEIGHT * 180;
    const point = projectGlobeLocation(sample.longitude + 75, latitude, 75);
    if (!point) continue; // Texture rounding can cross the last half-pixel at the limb.
    assert.ok(Math.abs(point.x - sample.x - 2) < 2);
    assert.ok(Math.abs(point.y - sample.y - 2) < 2);
  }
});

test('globe clips back-facing markers and centers the visible hemisphere', () => {
  const point = projectGlobeLocation(75, 15, 75);
  assert.ok(Math.abs(point.x - GLOBE_SIZE / 2) < 1e-8);
  assert.ok(Math.abs(point.y - GLOBE_SIZE / 2) < 1e-8);
  assert.equal(projectGlobeLocation(255, -15, 75), null);
  assert.deepEqual(projectGlobeLocation(435, 15, 435), point);
});
