// Interactive review of the Japanese prologue, then a fixed window on its first playable battle.
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
const [mode, directory, manualWorkers] = process.argv.slice(2);
if (!['single', 'multi', 'auto'].includes(mode) || !directory ||
    (manualWorkers !== undefined && (mode !== 'multi' || !/^[1-8]$/.test(manualWorkers))))
  throw Error('Usage: node scripts/battle.mjs single|multi|auto <new evidence directory> [workers for multi: 1-8]');
const out = resolve(directory);
await fs.mkdir(out, { recursive: true });
if ((await fs.readdir(out)).length) throw Error('Use an empty evidence directory');
const json = (name, value) => fs.writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const title = 'PCSG00214',
  inputs = resolve('.cache/pvsspw/inputs');
const sample = JSON.parse(await fs.readFile('bench/sample.lock.json'));
async function digest(path) {
  const h = createHash('sha256');
  for await (const b of createReadStream(path)) h.update(b);
  return h.digest('hex');
}
const archive = join(inputs, title + '.zip'),
  overlay = join(inputs, 'vitaslop-sas.zip');
if ((await digest(archive)) !== sample[title + '.zip'].sha256) throw Error('Sample fingerprint mismatch');
const fsrTrial = process.env.PV_FSR_COMPARE === '1';
const context = await chromium.launchPersistentContext(resolve(fsrTrial ? '.cache/fsr-profile' : '.cache/battle-profile-' + mode), {
  channel: 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-features=Vulkan', '--use-angle=gl'],
});
try {
  // Extend the worker response without modifying the production renderer.
  let pre = await fs.readFile('bench/picture-surface.js', 'utf8');
  if (fsrTrial) pre += '\n' + await fs.readFile('bench/fsr-passes.js', 'utf8');
  await context.route(/\/worker\.js(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: pre + '\n' + (await response.text()) });
  });
  const page = context.pages()[0];
  page.setDefaultTimeout(120000);
  const url = process.env.PV_BATTLE_URL || 'http://127.0.0.1:18751/';
  await page.goto(url);
  await page.waitForFunction(() => /intel/i.test(document.querySelector('#gpuBadge')?.innerText));
  if (!(await page.evaluate(async (id) => !!(await (await import('/store.js')).readTitle(id)), title))) {
    await page.locator('#gameFile').setInputFiles(archive);
    await page.waitForFunction((id) => document.querySelector('#titles').innerText.includes(id), title);
  }
  if (!(await page.evaluate(async (id) => !!(await (await import('/opfs.js')).readRepatch(id)), title))) {
    if (!(await page.locator('#titles').isVisible())) {
      await page.locator('#panelToggleBtn').click();
      await page.locator('#panelTabLibrary').click();
    }
    const choose = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '导入 rePatch' }).click();
    await (await choose).setFiles(overlay);
    await page.getByText(/rePatch 已启用/).waitFor();
  }
  await page.evaluate(
    async ({ title, mode, manualWorkers }) => {
      const s = await import('/store.js');
      s.saveTitleSettings(title, {
        pad: { mode: 'hidden' },
        showFps: false,
        // The historical multi arm used the upstream default of three guest workers.
        knobs: mode === 'multi' ? { VITASLOP_SMP: '1', VITASLOP_SMP_WORKERS: manualWorkers ?? '3' } :
          mode === 'single' ? { VITASLOP_SMP: '0' } : {},
      });
    },
    { title, mode, manualWorkers },
  );
  await page.reload();
  await page.waitForFunction(() => document.getElementById('idleActionText').textContent === '开始游玩');
  await page.locator('#idleStartBtn').click();
  const frame = page.frames().find((f) => f.url().includes('engine.html'));
  await frame.evaluate(() => {
    window.pvBattleHideCount = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.pvBattleHideCount++;
    });
  });
  const worker = () => page.workers().find((w) => new URL(w.url()).pathname === '/worker.js');
  async function shot(label) {
    await page.screenshot({ path: join(out, label + '.jpg'), quality: 83 });
  }
  const delay = (ms) => page.waitForTimeout(ms);
  const mapping = await frame.evaluate(
    async (id) => (await (await import('/store.js')).effective(id)).keyboard,
    title,
  );
  const tap = async (arg, ms = 95) => {
    const key = mapping[arg] || arg;
    await frame.locator('#screen').evaluate((el) => el.focus());
    await page.keyboard.down(key);
    await delay(ms);
    await page.keyboard.up(key);
  };
  const diag = () =>
    frame.evaluate(() => ({
      status: vitaPlayer.reports.status,
      gpu: vitaPlayer.reports.adapter,
      fault: PVBench.result().fault,
      submissions: PVBench.result().events,
      surface: vitaPlayer.reports.surface,
      hidden: document.hidden,
      hideCount: window.pvBattleHideCount,
      diag: vitaPlayer.reports.diag,
      revision: PV_CONFIG.revision,
      threading: vitaPlayer.reports.threading,
      guestWorkers: window.__runKnobs?.VITASLOP_SMP_WORKERS,
    }));
  let windowActive = false,
    nextShot = 0,
    initialHideCount = 0,
    complete = false;
  await fs.writeFile(join(out, 'action'), '');
  await fs.writeFile(join(out, 'ready'), '');
  let last = '',
    lastLive = 0;
  for (;;) {
    const cmd = (await fs.readFile(join(out, 'action'), 'utf8')).trim();
    if (cmd && cmd !== last) {
      last = cmd;
      const [label, act, arg, duration, count] = cmd.split(/\s+/);
      if (!/^[a-z0-9_-]+$/i.test(label)) throw Error('Invalid screenshot label');
      if (act === 'exit') break;
      try {
        if (windowActive && !['look', 'stats', 'diag', 'discard'].includes(act))
          throw Error('Input during a measurement');
        if (act === 'story') {
          await frame.waitForFunction(
            () => /SceAvPlayer: (first picture handed out|per picture)/.test(vitaPlayer.reports.diag || ''),
            null,
            { timeout: 150000 },
          );
          await tap('start');
          await delay(2300);
          await tap('start');
          await delay(3800);
          await shot('prologue-map');
          await tap('circle');
          await delay(2900);
          await tap('cross', 300);
          for (let i = 0; i < 80; i++) {
            await tap('circle');
            await delay(320);
          }
        } else if (act === 'fsr-compare') {
          if (!fsrTrial || complete || windowActive) throw Error('Use a fresh PV_FSR_COMPARE=1 trial');
          const { compareFsr } = await import('../bench/fsr-comparison.mjs');
          await compareFsr({page, frame, worker, out, diag, setup: {
            title, sampleSha256: sample[title + '.zip'].sha256, overlaySha256: await digest(overlay),
            browser: context.browser().version(), channel: 'msedge', headless: true, worker: worker().url(),
          }});
          complete = true;
        } else if (act === 'key' || act === 'burst') {
          for (let i = 0; i < Number(count || 1); i++) {
            await tap(arg, Number(duration || 95));
            if (count) await delay(320);
          }
        } else if (act === 'stick') {
          await worker().evaluate(
            async ({ x, ms }) => {
              const threaded = new URL(location.href).searchParams.get('smp') === '1';
              const g = await import(threaded ? './pkg-threads/vitaslop_web.js' : './pkg/vitaslop_web.js');
              g.worker_input_stick(0, x, 128, true);
              await new Promise((r) => setTimeout(r, ms));
              g.worker_input_stick(0, 128, 128, false);
            },
            { x: Number(arg), ms: Number(duration) },
          );
        } else if (act === 'diag') await json(label, await diag());
        else if (act === 'sample') {
          if (complete) throw Error('A complete trial already exists in this directory');
          const w = worker(),
            d = await diag();
          const threaded = new URL(w.url()).searchParams.get('smp') === '1';
          if (threaded !== (mode !== 'single') || d.hidden || d.fault)
            throw Error('Trial precondition failed');
          if (!(await w.evaluate(() => !!self.battleDevices)))
            throw Error('Worker texture instrumentation missing');
          await w.evaluate(await fs.readFile('bench/picture-rate.js', 'utf8'));
          await json(label + '-setup', {
            title,
            mode,
            sampleSha256: sample[title + '.zip'].sha256,
            overlaySha256: await digest(overlay),
            browser: context.browser().version(),
            channel: 'msedge',
            headless: true,
            worker: w.url(),
            ...d,
          });
          await w.evaluate((s) => self.battlePictures.start(s), Number(arg || 600));
          windowActive = true;
          nextShot = 0;
          initialHideCount = d.hideCount;
        } else if (act === 'discard') {
          await worker().evaluate(() => self.battlePictures.discard());
          windowActive = false;
        } else if (act === 'stats')
          await json(label, await worker().evaluate(() => self.battlePictures.result()));
        else if (act !== 'look') throw Error('Unknown action');
        await delay(450);
        await shot(label);
        console.log('Action', cmd);
      } catch (err) {
        console.error('Action error', cmd, String(err));
        await json(label + '-error', { error: String(err) });
      }
    }
    if (Date.now() - lastLive >= 5000) {
      lastLive = Date.now();
      const d = await diag();
      if (windowActive) {
        if (d.fault || d.hidden || d.hideCount !== initialHideCount)
          throw Error('Invalid measurement: ' + JSON.stringify(d));
        const r = await worker().evaluate(() => self.battlePictures.result());
        if (r.elapsed >= nextShot || r.status === 'complete') {
          await shot('window-' + (r.status === 'complete' ? 'end' : Math.floor(nextShot / 60)));
          nextShot += 60;
        }
        if (r.status === 'complete') {
          await json('measurement', r);
          windowActive = false;
          complete = true;
          console.log('Measurement', r);
        }
      } else await shot('live');
      console.log('Game', d.submissions, d.status?.slice(0, 115), d.fault?.slice(0, 125));
    }
    await delay(240);
  }
} finally {
  await context.close();
}
