// Run the installed UI workflow with an isolated desktop profile or an attached Android Chromium.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const {values: opt, positionals: [engine]} = parseArgs({allowPositionals:true, options:{
  android:{type:'string'}, cdp:{type:'string'}, chrome:{type:'string'}, output:{type:'string'},
  'boot-seconds':{type:'string', default:'180'}, headed:{type:'boolean'}, 'intel-vulkan':{type:'boolean'},
  fixed:{type:'boolean'}, 'capture-game':{type:'boolean'},
  knob:{type:'string',multiple:true}, 'vulkan-vendor':{type:'string'},
  channel:{type:'string'}, 'gl-compositor':{type:'boolean'}, 'screen-evidence':{type:'boolean'},
  'touch-viewport':{type:'boolean'}
}});
const ports = {vitaslop:18741, vita3k:18742};
if (!Object.hasOwn(ports, engine) || Boolean(opt.android) !== Boolean(opt.cdp))
  throw Error('Usage: node scripts/run.mjs vitaslop|vita3k [--channel msedge | --chrome PATH | --android SERIAL --cdp URL]');
const bootSeconds = Number(opt['boot-seconds']);
const desktopChannel = opt.channel ?? (opt.chrome || opt.android ? undefined : 'msedge');
const vendor=opt['vulkan-vendor'] || (opt['intel-vulkan'] ? 'intel' : null);
if(opt.channel && (opt.channel!=='msedge' || opt.chrome || opt.android))
  throw Error('Use --channel msedge without --chrome or --android');
if (opt['touch-viewport'] && opt.android) throw Error('--touch-viewport simulates touch on desktop');
if(vendor && !['intel','nvidia','amd'].includes(vendor)) throw Error('Unknown Vulkan hardware vendor');
if (!Number.isInteger(bootSeconds) || bootSeconds < 1) throw Error('Invalid observation interval');
const sample = JSON.parse(await readFile(join(root,'bench/sample.lock.json')));
if (opt.fixed && (engine !== 'vitaslop' || opt.android)) throw Error('--fixed requires desktop Vitaslop');
const locked = opt.fixed ? JSON.parse(await readFile(join(root,'.cache/pvsspw/builds/vitaslop/manifest.json'))) :
  JSON.parse(await readFile(join(root,'bench/players.lock.json')))[engine];
const inputDir = join(root,'.cache/pvsspw/inputs');
for (const file of ['PCSG00214.zip', ...(engine === 'vita3k' ? ['firmware.zip'] : [])]) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(join(inputDir,file))) hash.update(chunk);
  if (hash.digest('hex') !== sample[file].sha256) throw Error('Input fingerprint mismatch: '+file);
}
const origin = 'http://127.0.0.1:'+(opt.fixed ? 18747 : ports[engine]);
const now = new Date().toISOString();
const out = resolve(opt.output || join(root, 'artifacts',engine+'-'+now.replaceAll(':','-')));
const overlay = opt.fixed && join(inputDir,'vitaslop-sas.zip');
await mkdir(out, {recursive:true});
if (await access(join(out,'run.json')).then(()=>true,()=>false)) throw Error('Choose a new output directory for this trial');
const result = {time:now, engine, revision:locked.deploymentCommit, titleId:sample.titleId,
  sampleSha256:sample['PCSG00214.zip'].sha256, deviceClass:'desktop', environment:{},
  phases:[], visual:'unverified', sustainedFps:null, saveReload:'not-tested', status:'started', bootSeconds};
if (opt['screen-evidence']) result.screenCaptures = [];
let browser, page, context, lastProbe;
const errors = [], httpErrors = [];
if (process.env.VK_DRIVER_FILES) result.vulkanDriver = process.env.VK_DRIVER_FILES.split('/').at(-1);
const phase = s => {result.phases.push({name:s,at:new Date().toISOString()}); console.log(engine,s);};
const pause = ms => new Promise(done=>setTimeout(done,ms));
function adb(...args) {return execFileSync('adb',['-s',opt.android,...args],{encoding:'utf8'}).trim();}
async function input(selector, filename) {
  if (!opt.android) return page.locator(selector).first().setInputFiles(join(inputDir,filename));
  // Stream the exact verified ZIP to temporary disk. Never expand it into a JS ArrayBuffer.
  await page.evaluate(async ({selector,filename})=>{
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('pvsspw-bench-inputs',{create:true});
    const target = await dir.getFileHandle(filename,{create:true});
    const stream = await target.createWritable();
    const response = await fetch('/__input/'+filename);
    if (!response.ok) {await stream.abort();throw Error('Local sample HTTP '+response.status);}
    await response.body.pipeTo(stream);
    const transfer = new DataTransfer(); transfer.items.add(await target.getFile());
    const element = document.querySelector(selector); element.files=transfer.files;
    element.dispatchEvent(new Event('change',{bubbles:true}));
  },{selector,filename});
}
async function waitForOutcome(success, failure, timeout=240000) {
  await Promise.race([success.first().waitFor({state:'visible', timeout}),
    failure.first().waitFor({state:'visible',timeout}).then(async()=>{throw Error((await failure.first().innerText()).slice(0,600));})]);
}
async function nwImport(firmware) {
  const dialog = page.getByRole('dialog',{name:'Import'});
  await page.getByRole('button',{name:firmware?'Import firmware':'Import a game',exact:true}).first().click();
  await dialog.locator('input[type=file]').waitFor({state:'attached'});
  await input('dialog input[type=file], [role=dialog] input[type=file]',firmware?'firmware.zip':'PCSG00214.zip');
  await dialog.getByRole('button',{name:'Import',exact:true}).click();
  await waitForOutcome(dialog.getByRole('button',{name:firmware?'Done':'Play',exact:true}),dialog.locator('[role=alert], .bg-error-container, .text-error').filter({hasText:/./}));
  if (firmware) await dialog.getByRole('button',{name:'Done'}).click();
}
async function snapshot() {
  return await page.evaluate(()=>window.PVBench?.result());
}
try {
  if (opt.android) {
    const prop = k=>adb('shell','getprop',k);
    const virtual = prop('ro.kernel.qemu')==='1' || prop('ro.boot.qemu')==='1' || opt.android.startsWith('emulator-');
    result.deviceClass=virtual?'android-emulator':'android-adb-unverified';
    result.environment = {model:prop('ro.product.model'),android:prop('ro.build.version.release'),
      abi:prop('ro.product.cpu.abi'),qemu:virtual};
    // Match the CDP endpoint to the selected adb transport.
    const local = new URL(opt.cdp);
    if (!['localhost','127.0.0.1'].includes(local.hostname) || !adb('forward','--list').split('\n').some(
      l=>l.split(/\s+/)[0]===opt.android && l.includes('tcp:'+local.port+' ') && l.includes('devtools_remote')))
      throw Error('CDP endpoint must be adb-forwarded for the selected device');
    browser=await chromium.connectOverCDP(opt.cdp);
    context=browser.contexts()[0];
  } else {
    const args=vendor?['--enable-unsafe-webgpu','--ignore-gpu-blocklist',
      opt['gl-compositor']?'--use-angle=gl':'--use-angle=vulkan','--enable-features=Vulkan']:[];
    if(vendor && !opt.headed && !desktopChannel) args.push('--disable-vulkan-surface');
    result.environment={os:process.platform,arch:process.arch,launchArgs:args,headed:!!opt.headed,channel:desktopChannel??'chromium'};
    browser=await chromium.launch({channel:desktopChannel,executablePath:opt.chrome,headless:!opt.headed,args});
    const display = opt['touch-viewport']
      ? { viewport:{width:844,height:390}, hasTouch:true, isMobile:true, deviceScaleFactor:2 }
      : { viewport:{width:1280,height:720} };
    if (opt['touch-viewport']) result.deviceClass='desktop-touch-emulation';
    result.environment.display=display;
    context=await browser.newContext(display);
  }
  result.browser=browser.version();
  page=await context.newPage();page.setDefaultTimeout(30000);
  if(opt['capture-game']) {
    result.gameCaptures = [];
    result.diagnostics=[];
    page.on('console',msg=>{
      if(msg.type()==='error' || /PANIC at|panicked at|GPUValidationError|uncaptured error/i.test(msg.text())) {
        if(result.diagnostics.length<24) result.diagnostics.push(msg.text().slice(0,2000));
      }
    });
    result.workerReports = {};
    await page.exposeFunction('pvRecordReport',(id,text)=>{
      if(['adapter','status','fps','diag','capture-error'].includes(id)) result.workerReports[id]=String(text).slice(-2400);
    });
    await page.exposeFunction('pvWriteCapture',async (frame,time,url)=>{
      if(!Number.isSafeInteger(frame) || !url.startsWith('data:image/png;base64,')) return;
      const file = 'game-'+String(frame).padStart(6,'0')+'.png';
      await writeFile(join(out,file),Buffer.from(url.split(',')[1],'base64'));
      result.gameCaptures.push({frame,time,file});
    });
    await page.addInitScript(()=>{
      const BaseWorker=window.Worker;
      window.Worker=class extends BaseWorker {
        constructor(url, options) {
          const src=new URL(url, location.href);
          if(src.pathname==='/worker.js') src.searchParams.set('captureGame','1');
          super(src,options);
          this.addEventListener('message',({data})=>{
            if(data?.type==='pvsspw-capture-error') window.pvRecordReport('capture-error',data.message);
            if(data?.type==='report') window.pvRecordReport(data.id,data.text);
            if(data?.type!=='pvsspw-capture') return;
            const reader=new FileReader();
            reader.onload=()=>window.pvWriteCapture(data.frame,data.time,reader.result);
            reader.readAsDataURL(data.blob);
          });
        }
      };
    });
  }
  page.on('crash',()=>{result.pageCrashed = true;});
  page.on('pageerror',e=>{if(errors.length<8)errors.push(e.message.slice(0,360));});
  page.on('response',r=>{if(r.status()>=400 && httpErrors.length<8)httpErrors.push([r.status(),new URL(r.url()).pathname]);});
  phase('open');await page.goto(opt.fixed ? origin+'/core.html' : origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.PVBench);
  if(opt.knob) {
    result.diagnosticKnobs={};
    for(const setting of opt.knob) {
      const match=/^(VITASLOP_[A-Z0-9_]+)=(.+)$/.exec(setting);
      if(!match) throw Error('Expected --knob VITASLOP_NAME=value');
      result.diagnosticKnobs[match[1]]=match[2];
    }
    await page.evaluate(knobs=>localStorage.setItem('vitaslop.settings',JSON.stringify({knobs})),result.diagnosticKnobs);
    page.on('console',msg=>{
      if(/link: module|unsupported|unhandled|unreachable|undefined instruction|present log|\[present\]|stall|deadlock/i.test(msg.text()) && errors.length<80)
        errors.push(msg.text().slice(0,500));
    });
  }
  if((await snapshot()).revision !== locked.deploymentCommit) throw Error('Wrong player revision at '+origin);
  if(opt.fixed) result.wasmSha256 = Object.fromEntries(Object.entries(locked.files).filter(([f])=>f.endsWith('.wasm')));
  result.capabilities=await page.evaluate(async()=>{
    let gpu;
    try {const a=await navigator.gpu?.requestAdapter();gpu=a?{vendor:a.info?.vendor,architecture:a.info?.architecture,isFallbackAdapter:a.info?.isFallbackAdapter}:null;} catch(e){gpu=String(e);}
    return {ua:navigator.userAgent,gpu,jspi:typeof globalThis.WebAssembly?.Suspending==='function',
      isolated:crossOriginIsolated,opfs:!!navigator.storage?.getDirectory,wasmMemory64:!!globalThis.WebAssembly?.validate(
        Uint8Array.of(0,97,115,109,1,0,0,0,5,3,1,4,0))};
  });
  if(vendor && (result.capabilities.gpu?.vendor!==vendor || result.capabilities.gpu?.isFallbackAdapter))
    throw Error('Requested '+vendor+' hardware adapter unavailable for this trial');
  const existing=await page.evaluate(async()=>{
    const dirs=[];for await(const k of (await navigator.storage.getDirectory()).keys()) dirs.push(k);return dirs;
  });
  result.initialOpfsEntries=existing;
  if(existing.some(n=>!['pvsspw-bench-inputs','.probe'].includes(n))) throw Error('Origin already contains data; use a fresh test profile or origin for a cold run.');
  if(engine==='vitaslop'){
    phase('import-game');await page.getByRole('link',{name:'Add games',exact:true}).first().click();
    await page.locator('[data-mode=zip]').click();
    await input('#f-zip','PCSG00214.zip');
    await waitForOutcome(page.locator('#play'),page.locator('.card.error'));
    if (overlay) {
      phase('import-firmware-overlay');
      result.overlaySha256 = createHash('sha256').update(await readFile(overlay)).digest('hex');
      if(result.overlaySha256 !== locked.overlaySha256) throw Error('Wrong firmware overlay');
      await page.locator('#rp-zip-in').setInputFiles(overlay);
      await waitForOutcome(page.locator('#rp-on:checked'), page.locator('#rp-note').filter({hasText:'Could not add'}));
      result.overlayDescription = await page.locator('#rp-list').innerText();
    }
    phase('play');
    if (await page.locator('#play').isDisabled()) {
      const reasons = await page.locator('.checks .fatal').allTextContents();
      throw Error('Play disabled: '+reasons.join(' | '));
    }
    if (opt['touch-viewport']) await page.locator('#play').tap();
    else await page.locator('#play').click();
  } else {
    phase('import-firmware');await nwImport(true);
    phase('import-game');await nwImport(false);
    phase('play');await page.getByRole('dialog').getByRole('button',{name:'Play',exact:true}).click();
  }
  const deadline=Date.now()+bootSeconds*1000;
  let shot=false;
  let nextUpdate=Date.now()+15000;
  let nextCanvas=Date.now()+4000;
  while(Date.now()<deadline){
    lastProbe=await snapshot();
    if(opt['screen-evidence'] && lastProbe?.started && Date.now()>=nextCanvas) {
      const elapsed=Math.round(Date.now()-lastProbe.started);
      const name='canvas-'+elapsed+'ms.png';
      const surface = engine === 'vitaslop' ? page.locator('#screen') : page.locator('canvas:visible').first();
      try {
        await surface.screenshot({path:join(out,name),timeout:3000});
        result.screenCaptures.push({file:name, requestedMs:elapsed, capturedMs:Math.round(Date.now()-lastProbe.started)});
      } catch (error) {
        if (errors.length < 8) errors.push('Canvas screenshot: '+error.message.slice(0,180));
      }
      nextCanvas=Date.now()+10000;
    }
    if(opt['capture-game'] && Date.now()>=nextUpdate) {
      console.log('Game submissions',lastProbe?.events,'worker',result.workerReports.status ?? '(starting)');
      nextUpdate=Date.now()+15000;
    }
    if(lastProbe?.fault) throw Error(lastProbe.fault);
    if(lastProbe?.events && !shot){
      const file='first-observed.png';
      await page.screenshot({path:join(out,file),timeout:8000}).then(()=>{
        result.firstObservedCapture={file,capturedMs:Math.round(Date.now()-lastProbe.started)};
      }).catch(()=>{});
      shot=true;
    }
    const failure=page.locator('#fatal:not([hidden]), [role=alert], .card.error');
    if(await failure.first().isVisible() && (await failure.first().innerText()).trim()) throw Error((await failure.first().innerText()).slice(0,600));
    if(engine==='vita3k' && await page.getByText('The game could not start',{exact:true}).first().isVisible())
      throw Error((await page.locator('body').innerText()).slice(0,600));
    await pause(1000);
  }
  result.status=lastProbe?.events?'frames-observed-scene-unverified':'no-frame-before-timeout';
} catch(e) {
  result.status='blocked';result.reason=e.message.slice(0,750);
} finally {
  if(page && !page.isClosed()){
    lastProbe=await snapshot().catch(()=>lastProbe);
    if (engine === 'vitaslop')
      result.effectiveKnobs = await page.evaluate(()=>window.__runKnobs ?? null).catch(()=>null);
    result.visibleText=await page.locator('body').innerText({timeout:2500}).then(t=>opt['capture-game']?t.slice(0,12000):t.slice(-1800)).catch(()=>null);
    await page.screenshot({path:join(out,'final.png'),timeout:6000}).catch(()=>{});
    await page.close({runBeforeUnload:false}).catch(()=>{});
    if(opt.android){
      // Drop only this runner's temporary transfer copies; preserve the game's saves.
      const cleanup=await context.newPage().catch(()=>null);
      if(cleanup) try {
        await cleanup.goto(origin+'/__bench/probe.js',{waitUntil:'commit',timeout:8000});
        await cleanup.evaluate(async()=>{await (await navigator.storage.getDirectory()).removeEntry('pvsspw-bench-inputs',{recursive:true}).catch(()=>{});});
      } catch {} finally {await cleanup.close().catch(()=>{});}
    }
  }
  result.probe=lastProbe??null;result.errors=errors;result.httpErrors=httpErrors;
  await writeFile(join(out,'run.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({engine,status:result.status,phase:result.phases.at(-1)?.name,reason:result.reason,output:out}));
  if(browser) await browser.close().catch(()=>{});
}
