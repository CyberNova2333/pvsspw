import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGraphics, adapterOptions } from '../web/graphics.js';
const gpu = (fn) => ({ requestAdapter: fn });
function device(info, works = true) {
  return {
    info,
    requestDevice: async () => {
      if (!works) throw Error('device unavailable');
      return { destroy() {} };
    },
  };
}
test('renderer selects the same compatibility and power options that created a device', async () => {
  const result = await findGraphics(
    gpu(async (o) =>
      o.featureLevel === 'compatibility' && !o.powerPreference ? device({ vendor: 'test' }) : null,
    ),
    'low-power',
  );
  assert.equal(result.adapter.mode, 'compatibility');
  assert.deepEqual(
    adapterOptions(result.adapter.mode, result.adapter.power, {
      powerPreference: 'high-performance',
      other: true,
    }),
    { featureLevel: 'compatibility', other: true },
  );
});
test('tries another GPU after device creation fails and prefers hardware over software', async () => {
  const result = await findGraphics(
    gpu(async (o) =>
      o.powerPreference === 'high-performance'
        ? device({ vendor: 'blocked' }, false)
        : o.powerPreference === 'low-power'
          ? device({ vendor: 'intel' })
          : device({ architecture: 'swiftshader' }),
    ),
  );
  assert.equal(result.adapter.vendor, 'intel');
  assert.equal(result.adapter.software, false);
});
test('an explicitly requested fallback is labeled software; a null adapter cannot start a game', async () => {
  const result = await findGraphics(gpu(async (o) => (o.forceFallbackAdapter ? device({}) : null)));
  assert.equal(result.adapter.software, true);
  assert.equal(result.adapter.mode, 'fallback');
  assert.equal((await findGraphics(gpu(async () => null))).adapter, undefined);
  assert.match((await findGraphics(undefined)).reason, /API/);
});
