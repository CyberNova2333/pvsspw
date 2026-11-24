import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../bench/probe.js',import.meta.url),'utf8');
const workerSource = readFileSync(new URL('../bench/worker-probe.js',import.meta.url),'utf8');

function page(storage = new Map(), id='document-1') {
  let time=5, timer;
  const doc=new EventTarget();doc.hidden=false;
  class Worker extends EventTarget {}
  const ctx = {Worker,document:doc,location:new URL('http://localhost/#/play/PCSG00214'),
    addEventListener(){},performance:{timeOrigin:1000,now:()=>time},crypto:{randomUUID:()=>id},
    PV_CONFIG:{engine:'vita3k',revision:'test',sample:{titleId:'PCSG00214','PCSG00214.zip':{sha256:'same'}}},
    navigator:{userAgent:'test'},crossOriginIsolated:true,structuredClone,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setTimeout:f=>{timer=f},URL};
  ctx.window=ctx; vm.runInNewContext(source,ctx);
  const worker=new ctx.Worker('/worker.js');
  return {bench:ctx.PVBench,doc,tick:n=>{time+=n;},finish:()=>timer(),
    frame:()=>worker.dispatchEvent(new MessageEvent('message',{data:{type:'vita-present'}}))};
}

test('first frame, foreground window including idle seconds, lost foreground',()=>{
  const p=page();p.bench.start();
  assert.equal(p.bench.result().firstFrameMs,null);
  p.tick(12);p.frame();assert.equal(p.bench.result().firstFrameMs,12);
  p.bench.startWindow();p.tick(598000);p.frame();p.frame();p.tick(2000);p.finish();
  assert.equal(p.bench.result().fpsWindow.fps,2/600);
  p.bench.startWindow();p.doc.hidden=true;p.doc.dispatchEvent(new Event('visibilitychange'));
  p.finish();assert.equal(p.bench.result().fpsWindow.status,'backgrounded');
  assert.equal(p.bench.result().fpsWindow.fps,null);
});
test('saving requires visible play and a matching read in a fresh document',()=>{
  const store=new Map(), p=page(store);
  p.bench.start();assert.throws(()=>p.bench.saved('day 3'));
  p.frame();p.bench.saved('day 3');assert.throws(()=>p.bench.loaded('day 3'));
  const q=page(store,'document-2');q.bench.start();q.frame();
  assert.throws(()=>q.bench.loaded('different'));q.bench.loaded('day 3');
  assert.equal(q.bench.result().save.status,'read-back-by-operator');
});
test('Vitaslop counts target submissions and ignores offscreen or repeated work',()=>{
  class GPUTexture {createView(){return {};}}
  let tex=new GPUTexture();
  class GPUCanvasContext {getCurrentTexture(){return tex;}}
  class GPUCommandEncoder {beginRenderPass(){return {};} copyTextureToTexture(){} finish(){return {};}}
  class GPUQueue {submit(){}}
  let count=0;
  const ctx={GPUCanvasContext,GPUCommandEncoder,GPUQueue,GPUTexture,
    performance:{timeOrigin:1000,now:()=>1},self:{postMessage(){count++;}}};
  vm.runInNewContext(workerSource,ctx);
  const surface=new GPUCanvasContext(), q=new GPUQueue();
  function draw(t){const enc=new GPUCommandEncoder();enc.beginRenderPass({colorAttachments:[{view:t.createView()}]});q.submit([enc.finish()]);}
  surface.getCurrentTexture();draw(new GPUTexture());assert.equal(count,0);
  draw(tex);draw(tex);assert.equal(count,1);
  tex=new GPUTexture();const e=new GPUCommandEncoder();e.copyTextureToTexture({}, {texture:surface.getCurrentTexture()},[1,1]);q.submit([e.finish()]);
  assert.equal(count,2);
});

test('imported library titles do not inherit the locked benchmark input fingerprint', () => {
  const {bench} = page();
  bench.start({titleId:'OTHER0001'});
  assert.equal(bench.result().titleId, 'OTHER0001');
  assert.equal(bench.result().sampleSha256, null);
  bench.start();
  assert.equal(bench.result().titleId, 'PCSG00214');
  assert.equal(bench.result().sampleSha256, 'same');
});
