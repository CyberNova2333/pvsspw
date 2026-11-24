import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseThreadPolicy, guestWorkerLimit, selectWorkerCount } from '../web/thread-policy.js';

test('device budget stays parallel and leaves capacity for the rest of the player', () => {
  assert.deepEqual([
    guestWorkerLimit(1, 8), guestWorkerLimit(4, 8), guestWorkerLimit(8, 2),
    guestWorkerLimit(6, 8), guestWorkerLimit(16, 4), guestWorkerLimit(24, 8),
    guestWorkerLimit(undefined, undefined),
  ], [2, 2, 2, 4, 4, 6, 3]);
});

test('choose the smaller pool if extra workers bring little throughput', () => {
  assert.equal(selectWorkerCount(new Map([[2, 100], [3, 150], [4, 160], [5, 136]])), 3);
  assert.equal(selectWorkerCount(new Map([[2, 100], [3, 142], [4, 190]])), 4);
});

test('a game benchmark takes precedence only on the measured configuration', async () => {
  const device = { platform: 'Linux x86_64', userAgent: 'Edg/157.0', hardwareConcurrency: 24, deviceMemory: 32 };
  const options = { titleId: 'PCSG00214', adapter: { vendor: 'intel', architecture: 'xe-lpg', mode: 'core' },
    measure: async () => 6 };
  assert.deepEqual(await chooseThreadPolicy({}, device, options), { mode: 'game', workers: 3 });
  assert.deepEqual(await chooseThreadPolicy({VITASLOP_SMP_WORKERS: '5'}, device, options), {mode: 'manual', workers: 5});
  assert.equal((await chooseThreadPolicy({}, device, {...options, titleId: 'other'})).mode, 'measured');
  assert.equal((await chooseThreadPolicy({}, {...device, platform: 'Linux aarch64'}, options)).mode, 'measured');
  assert.equal((await chooseThreadPolicy({}, device, {...options, adapter: {...options.adapter, software: true}})).mode, 'measured');
});

test('launch policy honours user settings and falls back to SMP if the probe fails', async () => {
  const device = { hardwareConcurrency: 8, deviceMemory: 8 };
  let calls = 0;
  const measure = async limit => { calls++; assert.equal(limit, 6); return 4; };
  assert.deepEqual(await chooseThreadPolicy({ VITASLOP_SMP: '0' }, device, { measure }), { mode: 'single' });
  assert.deepEqual(await chooseThreadPolicy({ VITASLOP_SMP_WORKERS: '8' }, device, { measure }), { mode: 'manual', workers: 8 });
  assert.deepEqual(await chooseThreadPolicy({}, {hardwareConcurrency: 4}, { measure }), { mode: 'budget', workers: 2 });
  assert.equal(calls, 0);
  assert.deepEqual(await chooseThreadPolicy({}, device, { measure }), { mode: 'measured', workers: 4 });
  assert.deepEqual(await chooseThreadPolicy({ VITASLOP_SMP_WORKERS: '99' }, device, { measure }), { mode: 'measured', workers: 4 });
  assert.equal(calls, 2);
  assert.deepEqual(await chooseThreadPolicy({}, device, { measure: async () => { throw Error('timeout'); } }),
    { mode: 'budget', workers: 3 });
});
