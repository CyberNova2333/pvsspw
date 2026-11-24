// Called by workbench.mjs --game --intel --pentagram-menu in its disposable library.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

async function selectedRow(page, path) {
  const image = await page.screenshot({ path, type: 'png', scale: 'css' });
  return page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0));
    const picture = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(1280, 720);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
    picture.close();
    // The Options menu highlights exactly one of its five rows in magenta.
    const scores = [175, 262, 345, 430, 514].map((y) => {
      const { data } = ctx.getImageData(103, y, 157, 1);
      let score = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 140 && data[i + 2] > 125 && data[i] - data[i + 1] > 45) score++;
      }
      return score;
    });
    const winner = Math.max(...scores);
    return winner > 30 && scores.filter((n) => n > 30).length === 1 ? scores.indexOf(winner) : -1;
  }, image.toString('base64'));
}

export async function testPentagramMenu(page, engine, cdp, directory) {
  await page.setViewportSize({ width: 1280, height: 720 });
  const tap = async (name, ms) => {
    const rect = await engine.locator('[data-btn="' + name + '"]').boundingBox();
    assert(rect, 'Visible on-screen ' + name);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
    });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await engine.waitForFunction(() => /SceAvPlayer: (first picture handed out|per picture)/.test(
    window.vitaPlayer.reports.diag || '',
  ), null, { timeout: 120000 });
  // Leave the OP, go through the title, then open the game menu from the prologue.
  for (const wait of [2000, 3800, 1800]) {
    await tap('start', 90);
    await page.waitForTimeout(wait);
  }
  const row = (name) => selectedRow(page, directory + '/pentagram-' + name + '.png');
  await engine.evaluate(() => {
    window.testDirectionEvents = [];
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data, ...rest) {
      if (data.type.startsWith('pv-direction-') || (data.type === 'key' && /^Arrow/.test(data.code)))
        window.testDirectionEvents.push(data);
      return post.call(this, data, ...rest);
    };
  });
  let before = await row('options');
  assert.equal(before, 0, 'Japanese Options menu opens on SAVE');
  const moves = [];
  const measureMove = async (direction, ms, tag) => {
    await tap(direction, ms);
    await page.waitForTimeout(600);
    const actual = await row(tag);
    const expected = (before + (direction === 'down' ? 1 : 4)) % 5;
    moves.push({ direction, ms, before, expected, actual });
    assert.equal(actual, expected, JSON.stringify(moves.at(-1)));
    before = actual;
  };
  for (const [i, ms] of [66, 84, 118, 165, 235, 73, 130, 110].entries()) {
    const direction = i < 5 ? 'down' : 'up';
    await measureMove(direction, ms, 'tap-' + (i + 1));
  }
  const messages = () => engine.evaluate(() => window.testDirectionEvents.splice(0));
  assert.equal((await messages()).filter((m) => m.type === 'pv-direction-step').length, moves.length);
  const worker = page.workers().find((w) => new URL(w.url()).pathname === '/worker.js');
  assert(worker);
  // Limit the real game renderer only in this test. Input remains ordinary CDP
  // touch on the overlay, and the guest advances under its normal scheduler.
  await worker.evaluate(() => {
    const proto = GPUCanvasContext.prototype;
    const acquire = proto.getCurrentTexture;
    const delay = new Int32Array(new SharedArrayBuffer(4));
    proto.getCurrentTexture = function (...args) {
      Atomics.wait(delay, 0, 0, 72);
      return acquire.apply(this, args);
    };
    self.restoreTestRenderer = () => { proto.getCurrentTexture = acquire; };
  });
  const sample = () => engine.evaluate(() => ({ time: performance.now(), frames: PVBench.result().events }));
  let lowFps;
  try {
    await page.waitForTimeout(650);
    const start = await sample();
    for (const [i, ms] of [180, 310, 450].entries()) await measureMove('down', ms, 'slow-' + i);
    const end = await sample();
    lowFps = 1000 * (end.frames - start.frames) / (end.time - start.time);
    assert(lowFps > 0 && lowFps < 20, 'Measured low-FPS condition: ' + lowFps);
    assert.deepEqual((await messages()).map((m) => m.type), Array(3).fill('pv-direction-step'));
    await page.locator('#dpadBehavior').evaluate((el) => {
      el.value = 'single';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await measureMove('up', 1250, 'single-held');
    assert.deepEqual(await messages(), [{ type: 'pv-direction-step', direction: 0 }]);
    await page.locator('#dpadBehavior').evaluate((el) => {
      el.value = 'step';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await tap('down', 950);
    assert.deepEqual(await messages(), [
      { type: 'pv-direction-step', direction: 2 },
      { type: 'pv-direction-repeat', direction: 2, pressed: true },
      { type: 'pv-direction-repeat', direction: 2, pressed: false },
    ]);
    await page.waitForTimeout(400);
    const afterHold = await row('released');
    assert(afterHold >= 0);
    assert.notEqual(afterHold, (before + 1) % 5, 'A sustained press repeated beyond the initial step');
    await page.waitForTimeout(550);
    assert.equal(await row('neutral'), afterHold, 'Menu cursor stops after release');
  } finally {
    await worker.evaluate(() => self.restoreTestRenderer());
    await writeFile(directory + '/pentagram-menu.json', JSON.stringify({ moves, lowFps }, null, 2) + '\n');
  }
}
