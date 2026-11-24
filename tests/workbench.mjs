// Run against a locally served --fixed build. Each context has a disposable game library.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.env.PV_UI_URL || 'http://127.0.0.1:18747/';
const output = resolve(process.env.PV_UI_OUTPUT || 'artifacts/workbench');
const withGame = process.argv.includes('--game');
const intel = process.argv.includes('--intel');
const software = process.argv.includes('--software');
assert(!(intel && software), 'Select a single graphics device for the test.');
const chunkSize = 65536;
const blocks = Array.from({ length: 12 }, (_, i) => Buffer.alloc(chunkSize, i));
const requests = [];
let manifest;
const fixture = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.url === '/manifest') return res.end(JSON.stringify(manifest));
  const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '');
  if (req.url !== '/fixture.zip' || !range) {
    res.writeHead(404);
    return res.end();
  }
  const index = Number(range[1]) / chunkSize;
  requests.push(index);
  setTimeout(() => {
    if (res.destroyed) return;
    res.writeHead(206, {
      'Content-Range': 'bytes ' + range[1] + '-' + range[2] + '/' + manifest.size,
      'Content-Length': chunkSize,
    });
    res.end(blocks[index]);
  }, 125);
});
await new Promise((r) => fixture.listen(0, '127.0.0.1', r));
const source = 'http://127.0.0.1:' + fixture.address().port;
manifest = {
  schemaVersion: 1,
  id: 'workbench-fixture',
  name: 'fixture.zip',
  size: chunkSize * blocks.length,
  chunkSize,
  sha256: blocks.map((b) => createHash('sha256').update(b).digest('hex')),
  sources: [source + '/fixture.zip'],
};
await mkdir(output, { recursive: true });
let browser;
const errors = [];
const waitText = (p, id, text) =>
  p.waitForFunction(([id, text]) => document.getElementById(id).textContent.includes(text), [id, text]);
const confirmOnce = (p) => p.once('dialog', (d) => d.accept());
async function pick(page, button, file) {
  const chooser = page.waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(file);
}
async function downloaded(page, button) {
  const done = page.waitForEvent('download');
  await button.click();
  return await done;
}
async function openPage(context) {
  const p = await context.newPage();
  p.setDefaultTimeout(30000);
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await waitText(p, 'gpuBadge', 'WebGPU');
  await p.evaluate(() => document.fonts.ready);
  return p;
}
try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      ...(intel || software ? ['--use-angle=gl', '--enable-features=Vulkan'] : []),
      ...(software ? ['--enable-unsafe-webgpu'] : []),
    ],
  });
  const desktop = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  let page = await openPage(desktop);
  if (intel) assert.match(await page.locator('#gpuBadge').innerText(), /intel/i);
  if (software) assert.match(await page.locator('#gpuBadge').innerText(), /软件/);
  await page.screenshot({ path: output + '/desktop.png' });
  await page.getByRole('switch').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('switch').click();
  await page.locator('#panelToggleBtn').click();
  for (const tab of await page.getByRole('tab').all()) {
    await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    assert(await page.locator('#' + (await tab.getAttribute('aria-controls'))).isVisible());
  }
  await page.getByRole('tab').last().press('Home');
  assert.equal(await page.locator('#panelTabLibrary').getAttribute('aria-selected'), 'true');
  await page.screenshot({ path: output + '/library.png' });
  await page.locator('#panelTabSettings').click();
  await page.locator('#scaling').selectOption('integer');
  await page.locator('#fsr1').check();
  assert.equal(await page.locator('#outputResolution').inputValue(), 'display');
  await page.reload();
  await page.locator('#panelToggleBtn').click();
  await page.locator('#panelTabSettings').click();
  await page.waitForFunction(() => document.getElementById('scaling').value === 'integer');
  assert.equal(await page.locator('#outputResolution').inputValue(), 'display');
  assert.equal(await page.locator('#fsr1').isChecked(), true);
  await page.locator('#outputResolution').selectOption('native');
  assert.equal(await page.locator('#fsr1').isChecked(), false);
  await page.locator('#scaling').selectOption('fit');
  await page.locator('#panelTabSaves').click();
  const bytes = Buffer.from(
    await page.evaluate(async () => {
      const { writeZip } = await import('/zipstore.js');
      const single = writeZip([
        { name: 'files/savedata0%3A/slot.bin', bytes: new Uint8Array([17, 23, 31]) },
      ]);
      return Array.from(writeZip([{ name: 'PVTEST001.zip', bytes: single }]));
    }),
  );
  confirmOnce(page);
  await pick(page, page.locator('#restoreAll'), {
    name: 'backup.zip',
    mimeType: 'application/zip',
    buffer: bytes,
  });
  await waitText(page, 'saveList', 'PVTEST001');
  const backup = await downloaded(page, page.locator('#exportAll'));
  assert.deepEqual(await readFile(await backup.path()), bytes);
  await page.close();
  page = await openPage(desktop);
  await page.locator('#panelToggleBtn').click();
  await page.locator('#panelTabSaves').click();
  await waitText(page, 'saveList', 'PVTEST001');
  await pick(page, page.getByRole('button', { name: '恢复此游戏' }), {
    name: 'broken.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('invalid'),
  });
  await waitText(page, 'statusText', 'zip');
  const afterInvalid = await downloaded(page, page.locator('#exportAll'));
  assert.deepEqual(await readFile(await afterInvalid.path()), bytes);
  await page.locator('#panelTabOnline').click();
  await page.locator('#onlineManifestURL').fill(source + '/manifest');
  await page.locator('#onlineManifestLoadBtn').click();
  await page.getByRole('button', { name: '下载或继续' }).click();
  await page.waitForFunction(() => document.querySelector('#onlineGameList progress')?.value >= 65536);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await waitText(page, 'onlineGameList', '已暂停');
  // Restoring the manifest into a new document must reuse already verified blocks.
  const before = requests.filter((i) => i === 0).length;
  await page.reload();
  await page.locator('#panelToggleBtn').click();
  await page.locator('#panelTabOnline').click();
  await page.locator('#onlineManifestFile').setInputFiles({
    name: 'manifest.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(manifest)),
  });
  await page.getByRole('button', { name: '下载或继续' }).click();
  await waitText(page, 'onlineGameList', '下载与校验完成');
  assert.equal(requests.filter((i) => i === 0).length, before);
  assert(await page.getByRole('button', { name: '导入游戏库' }).isEnabled());
  await page.locator('#panelTabStorage').click();
  await waitText(page, 'fileTree', 'game-downloads');
  confirmOnce(page);
  await page.locator('#cleanDownloads').click();
  await waitText(page, 'statusText', '下载缓存已清除');
  await page.locator('#panelTabOnline').click();
  assert.equal(await page.locator('.online-game-card').count(), 0);
  await page.locator('#panelCloseBtn').click();
  await page.locator('#fullscreenBtn').click();
  await page.locator('#fsMenuToggle').click();
  await page.locator('#fsSaves').click();
  assert(await page.locator('#tabSaves').isVisible());
  await page.locator('#panelCloseBtn').click();
  await page.locator('#fsMenuToggle').click();
  await page.locator('#fsExit').click();
  console.log(
    'Desktop shell, settings, file/URL manifest, range resume, cache cleanup, save round trip, fullscreen passed.',
  );
  if (withGame) {
    page.setDefaultTimeout(120000);
    await page.locator('#panelToggleBtn').click();
    await page.locator('#panelTabSettings').click();
    await page.locator('#gpuPreference').selectOption('high-performance');
    await page.locator('#panelCloseBtn').click();
    await page.locator('#gameFile').setInputFiles('.cache/pvsspw/inputs/PCSG00214.zip');
    await waitText(page, 'titles', 'PCSG00214');
    await pick(
      page,
      page.getByRole('button', { name: '导入 rePatch' }),
      '.cache/pvsspw/inputs/vitaslop-sas.zip',
    );
    await waitText(page, 'titles', 'rePatch 已启用');
    const details = page.locator('#gamePage');
    await page.getByRole('link', { name: '详情与附加内容' }).click();
    await details.getByText('vitaslop-sas.zip', { exact: true }).waitFor();
    const overlay = details.getByRole('checkbox', { name: '启用' });
    await overlay.uncheck();
    await page.waitForFunction(
      () =>
        !document.querySelector('#gamePage input[type=checkbox]')?.checked &&
        document.querySelector('.page-note').textContent.includes('更新'),
    );
    await details.getByRole('checkbox', { name: '启用' }).check();
    await details.getByText('启用状态已更新', { exact: true }).waitFor();
    await page.screenshot({ path: output + '/game-details.png' });
    await details.getByRole('button', { name: '按键映射' }).click();
    const binding = details.getByRole('button', { name: '× 叉键的键盘映射' });
    await binding.click();
    await page.keyboard.press('KeyJ');
    await details.getByRole('button', { name: '保存设置' }).click();
    await page.waitForFunction(() => document.querySelector('.page-note').textContent === '设置已保存');
    await page.reload();
    await binding.waitFor();
    assert.equal(await binding.innerText(), 'KeyJ');
    await page.screenshot({ path: output + '/mapping.png' });
    await details.getByRole('button', { name: '返回', exact: true }).click();
    await details.getByRole('heading', { name: '附加内容', exact: true }).waitFor();
    await details.getByRole('button', { name: '返回', exact: true }).click();
    await details.waitFor({ state: 'hidden' });
    await page.evaluate(() =>
      window.addEventListener('vita-adapter', (e) => {
        window.testWorkerAdapter = e.detail;
      }),
    );
    if (software) confirmOnce(page);
    await page.locator('#titles').getByRole('button', { name: software ? '使用软件渲染启动' : '开始游玩' }).click();
    const f = page.frames().find((f) => f.url().includes('/engine.html'));
    await f.waitForFunction(() => window.PVBench.result().events >= 4);
    if (software) {
      // The Japanese warning has a red heading and a grey dialog; an active
      // WebGPU queue can also produce a completely blank browser surface.
      await f.waitForFunction(() => {
        const canvas = document.getElementById('softwareScreen');
        if (canvas.hidden) return false;
        const ctx = new OffscreenCanvas(160, 90).getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, 160, 90);
        const rgba = ctx.getImageData(0, 0, 160, 90).data;
        let red = 0, gray = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          if (rgba[i] > 110 && rgba[i] > 1.5 * rgba[i + 1] && rgba[i + 1] > rgba[i + 2]) red++;
          if (rgba[i] > 60 && rgba[i] < 190 && rgba[i] === rgba[i + 1]) gray++;
        }
        return red > 5 && gray > 200;
      }, null, { polling: 150, timeout: 45000 });
    } else await page.waitForTimeout(3200);
    await page.screenshot({ path: output + '/game.png' });
    await page.locator('#panelToggleBtn').click();
    await page.locator('#panelTabSettings').click();
    await page.locator('#showFps').check();
    await page.locator('#emuMenu').click();
    await f.locator('#menu').waitFor();
    await f.getByText('游玩菜单', { exact: true }).waitFor();
    await page.screenshot({ path: output + '/pause-menu.png' });
    await f.locator('#m-resume').click();
    await page.locator('#touchGamepadToggle').click();
    await f.locator('#pad').waitFor();
    const cdp = await desktop.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.setViewportSize({ width: 844, height: 390 });
    const key = f.locator('[data-btn="cross"]');
    const bounds = await key.boundingBox();
    assert(bounds);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }],
    });
    await f.waitForFunction(() => document.querySelector('[data-btn=cross]').classList.contains('held'));
    await page.screenshot({ path: output + '/game-touch.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await f.waitForFunction(
      () => !document.querySelector('[data-btn=cross]').classList.contains('held'),
    );
    if (process.argv.includes('--pentagram-menu')) {
      const { testPentagramMenu } = await import('./pentagram-menu.mjs');
      await testPentagramMenu(page, f, cdp, output);
    }
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator('#panelToggleBtn').click();
    await page.locator('#panelTabInfo').click();
    await page.locator('#sampleStart').click();
    await page.waitForFunction(() => !document.getElementById('sampleExport').disabled);
    await page.locator('#sampleStop').click();
    const sample = await downloaded(page, page.locator('#sampleExport'));
    assert(JSON.parse(await readFile(await sample.path(), 'utf8')).samples.length);
    const diag = await downloaded(page, page.locator('#exportReport'));
    const report = JSON.parse(await readFile(await diag.path(), 'utf8'));
    assert(
      await page.evaluate(() => !!window.testWorkerAdapter),
      'the worker used the selected GPU preference',
    );
    assert.equal(report.titleId, 'PCSG00214');
    assert(report.probe.events > 0);
    console.log('Game', report.titleId, report.adapter, report.probe.events, 'submissions');
    await page.locator('#panelTabSettings').click();
    const shot = await downloaded(page, page.locator('#shot'));
    await shot.saveAs(output + '/game-capture.png');
    confirmOnce(page);
    await page.locator('#quit').click();
    await page.waitForFunction(() => document.getElementById('engine').hidden);
    await page.reload();
    await page.locator('#panelToggleBtn').click();
    await waitText(page, 'titles', 'PCSG00214');
    console.log(
      'Title import, rePatch, launch, menu, pad, screenshot, diagnostics, performance export and exit passed.',
    );
    if (intel) {
      const handoff = await desktop.newPage();
      await handoff.addInitScript(() => {
        AudioContext.prototype.resume = function () {
          window.audioWaitingForGesture = true;
          return new Promise(() => {});
        };
      });
      await handoff.goto(new URL('/#/play/PCSG00214', url).href);
      const engine = handoff.frameLocator('#engine');
      await engine.locator('#loading').waitFor({ state: 'hidden', timeout: 120000 });
      await handoff.waitForFunction(() => {
        const game = document.getElementById('engine').contentWindow;
        return game.audioWaitingForGesture && game.PVBench?.result().events >= 10;
      }, null, { timeout: 120000 });
      await handoff.close();
      console.log('Direct game link produced frames while browser audio awaited user interaction.');
    }
  }
  await desktop.close();
  // A browser that cannot create a GPU device can still open its library and retry.
  const unavailable = await browser.newContext();
  await unavailable.route('**/ui/graphics-probe.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "onmessage=()=>postMessage({attempts:[],reason:'没有可用的 WebGPU 适配器'})",
    }),
  );
  const recovery = await openPage(unavailable);
  await recovery.evaluate(async () => {
    const store = await import('/store.js');
    await store.writeTitle({ title: '图形检测样例', titleId: 'PVTEST001', bytes: 1, importedAt: 1 });
  });
  await recovery.reload();
  await waitText(recovery, 'idleActionText', '查看启动问题');
  await recovery.locator('#idleStartBtn').click();
  assert(await recovery.locator('#tabInfo').isVisible());
  assert(await recovery.locator('#engine').isHidden());
  await unavailable.unroute('**/ui/graphics-probe.js');
  await recovery.locator('#retryEnvironment').click();
  await recovery.waitForFunction(() => !document.getElementById('retryEnvironment').disabled);
  if (intel) {
    await waitText(recovery, 'idleActionText', '开始游玩');
    assert.match(await recovery.locator('#gpuBadge').innerText(), /intel/i);
  }
  await recovery.goto(new URL('/core.html#/settings/PVTEST001', url).href, { waitUntil: 'commit' });
  await recovery.getByRole('dialog').getByRole('heading', { name: '键盘与实体手柄' }).waitFor();
  assert.equal(new URL(recovery.url()).pathname, '/');
  await recovery.goto(new URL('/core.html', url).href);
  await recovery.waitForFunction(() => document.body.dataset.screen === 'library');
  assert.equal(await recovery.title(), 'Library - vitaslop');
  await unavailable.close();
  console.log('Unavailable graphics opens diagnostics and retries against the real renderer worker.');
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const touch = await openPage(mobile);
  await touch.screenshot({ path: output + '/touch-portrait.png' });
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await touch.setViewportSize(size);
    const bounds = await touch.locator('#panelToggleBtn').boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= size.width);
    await touch.locator('#panelToggleBtn').tap();
    await touch.locator('#panelTabSettings').tap();
    await touch.locator('#padMode').selectOption('beside');
    await touch.waitForFunction(() =>
      document.getElementById('settingStatus').textContent.includes('全局'),
    );
    assert(
      await touch.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth && window.visualViewport.pageLeft === 0,
      ),
    );
    const panel = await touch.locator('#sidePanel').boundingBox();
    assert(panel.x >= 0 && panel.x + panel.width <= size.width + 1);
    await touch.screenshot({ path: output + '/touch-settings-' + size.width + '.png' });
    await touch.locator('#advanced').tap();
    const subpage = touch.getByRole('dialog');
    await subpage.getByRole('button', { name: '× 叉键的键盘映射' }).waitFor();
    const sheet = await subpage.boundingBox();
    assert(
      sheet &&
        sheet.x >= 0 &&
        sheet.x + sheet.width <= size.width + 1 &&
        sheet.y >= 0 &&
        sheet.y + sheet.height <= size.height + 1,
    );
    await subpage.getByRole('button', { name: '返回', exact: true }).tap();
    await subpage.waitFor({ state: 'hidden' });
    await touch.locator('#panelCloseBtn').tap();
  }
  console.log('390×844 and 844×390 desktop touch emulation passed.');
  const fakePads = await browser.newContext();
  await fakePads.addInitScript(() => {
    navigator.getGamepads = () =>
      [0, 1].map((index) => ({ index, id: 'Test ' + index, connected: true }));
  });
  const gp = await openPage(fakePads);
  await gp.locator('#panelToggleBtn').click();
  await gp.locator('#panelTabSettings').click();
  await gp.locator('#padDevice').selectOption('[1,"Test 1"]');
  const player = gp.frames().find((f) => f.url().includes('/engine.html'));
  await player.waitForFunction(
    () => navigator.getGamepads()[0] === null && navigator.getGamepads()[1].index === 1,
  );
  await fakePads.close();
  console.log('Controller selection passed with two simulated Gamepad API devices.');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  fixture.closeAllConnections();
  await new Promise((r) => fixture.close(r));
}
