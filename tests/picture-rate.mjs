// Exercise the pixel counter with known RGB changes on the same hardware path.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-features=Vulkan', '--use-angle=gl'],
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.PV_BATTLE_URL || 'http://127.0.0.1:18751/');
  await page.evaluate(await readFile('bench/picture-rate.js', 'utf8'));
  const r = await page.evaluate(async () => {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter || adapter.info.isFallbackAdapter) throw Error('Hardware adapter required');
    const d = await adapter.requestDevice();
    const tex = d.createTexture({
      size: [16, 8],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    self.battleDevices = new WeakMap([[tex, d]]);
    self.battlePictures.start(1);
    const pixels = new Uint8Array(16 * 8 * 4);
    function submit() {
      d.queue.writeTexture({ texture: tex }, pixels, { bytesPerRow: 64 }, [16, 8]);
      self.pvCaptureTexture(tex);
    }
    submit();
    submit(); // baseline then an identical picture
    pixels[4 * (4 * 16 + 8)] = 255;
    submit();
    submit();
    pixels[0] = 127;
    submit();
    pixels[4 * (4 * 16 + 8)] = 0;
    submit();
    pixels[3] = 255;
    submit(); // alpha only
    await new Promise((r) => setTimeout(r, 1050));
    return self.battlePictures.result();
  });
  assert.deepEqual([r.submissions, r.changed, r.centerChanged, r.duplicates], [6, 3, 2, 3]);
  console.log('Pixel comparison passed', r.changed, r.centerChanged, r.duplicates);
} finally {
  await browser.close();
}
