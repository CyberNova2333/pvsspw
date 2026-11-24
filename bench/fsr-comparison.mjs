// Called after the operator verifies control and landing in the first battle.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';

export async function compareFsr({page, frame, worker, out, setup, diag}) {
  const w = worker();
  const json = (file, data) => writeFile(join(out, file), JSON.stringify(data,null,2)+'\n');
  const shot = name => page.screenshot({path:join(out,name+'.jpg'),quality:87});
  const counts = () => w.evaluate(() => ({...fsrCheck.counts}));
  async function toggle(enabled) {
    await page.locator('#panelToggleBtn').click();
    await page.locator('#panelTabSettings').click();
    await page.locator('#outputResolution').selectOption('display');
    await page.locator('#fsr1').setChecked(enabled);
    assert.equal(await page.locator('#outputResolution').inputValue(), 'display');
    await page.locator('#panelToggleBtn').click();
    const start = await counts();
    const label = enabled ? 'fsr1-rcas' : 'present-scale';
    for (let i=0;i<100;i++) {
      await page.waitForTimeout(250);
      if ((await counts())[label] - start[label] >= 4) return;
    }
    throw Error('Selected GPU pass never executed: '+label+' '+JSON.stringify(await counts()));
  }
  await page.setViewportSize({width:1440,height:900});
  await w.evaluate(() => { fsrCheck.recording = true; });
  await toggle(false);
  await toggle(true);
  const images = await w.evaluate(() => fsrCheck.pair());
  for (const [i,label] of ['native','off','on'].entries())
    await writeFile(join(out,'fsr-'+label+'.png'),Buffer.from(images[i],'base64'));
  await w.evaluate(() => { fsrCheck.recording = false; });
  await w.evaluate(await readFile('bench/picture-rate.js','utf8'));
  const results = {};
  for (const [name,enabled] of [['off',false], ['on',true]]) {
    await toggle(enabled);
    await page.waitForTimeout(8000);
    const startState = await diag(), before = await counts();
    assert.equal(startState.hidden,false); assert.ok(!startState.fault);
    assert.equal(startState.guestWorkers,'3');
    await json('fsr-'+name+'-setup.json',{...setup,...startState,before});
    await shot('fsr-'+name+'-start');
    await w.evaluate(() => battlePictures.start(600));
    let nextMinute = 1, sample;
    const deadline = Date.now()+640000;
    for (;;) {
      await page.waitForTimeout(2500);
      const now = await frame.evaluate(() => ({hidden:document.hidden, changes:window.pvBattleHideCount, fault:PVBench.result().fault}));
      if (now.hidden || now.changes !== startState.hideCount || now.fault) throw Error('Game left valid scene: '+JSON.stringify(now));
      sample = await w.evaluate(() => battlePictures.result());
      if (sample.status === 'complete') break;
      if (Date.now()>deadline) throw Error('Pixel counter timed out');
      if (sample.elapsed >= nextMinute*60) {
        await shot('fsr-'+name+'-minute-'+nextMinute++);
        console.log('FSR',name,'elapsed',Math.floor(sample.elapsed));
      }
    }
    await shot('fsr-'+name+'-end');
    const after = await counts();
    const passes = Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
    assert.ok(sample.width >= 960 && sample.height >= 544 && sample.width*sample.height > 960*544);
    assert.ok(sample.changed > 0 && sample.centerChanged > 0);
    if (enabled) {
      assert.ok(passes['fsr1-easu']>0 && passes['fsr1-easu']===passes['fsr1-rcas'] && passes['present-scale']===0);
    } else assert.ok(passes['present-scale']>0 && passes['fsr1-rcas']===0 && passes['fsr1-easu']===0);
    results[name] = {pixels:sample,passes};
    await json('fsr-'+name+'-measurement.json',results[name]);
  }
  assert.deepEqual([results.off.pixels.width,results.off.pixels.height,results.off.pixels.format],
                   [results.on.pixels.width,results.on.pixels.height,results.on.pixels.format]);
  return results;
}
