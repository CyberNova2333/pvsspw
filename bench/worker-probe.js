// Observe successful submissions that write to the dedicated game canvas.
// Ignore shader compilation, texture uploads, offscreen passes and queue heartbeats.
(() => {
  const canvas = globalThis.GPUCanvasContext?.prototype;
  const queue = globalThis.GPUQueue?.prototype;
  const texture = globalThis.GPUTexture?.prototype;
  const encoder = globalThis.GPUCommandEncoder?.prototype;
  if (!canvas || !queue || !texture || !encoder) return;
  const surfaces = new WeakSet();
  const views = new WeakMap();
  const targets = new WeakMap();
  const buffers = new WeakMap();
  let lastPresented;
  const acquire = canvas.getCurrentTexture;
  canvas.getCurrentTexture = function (...args) {
    const t = acquire.apply(this,args);
    surfaces.add(t);
    return t;
  };
  const createView = texture.createView;
  texture.createView = function (...args) {
    const view = createView.apply(this,args);
    if (surfaces.has(this)) views.set(view,this);
    return view;
  };
  const draw = encoder.beginRenderPass;
  encoder.beginRenderPass = function (desc) {
    const pass = draw.call(this,desc);
    for (const a of desc.colorAttachments) {
      const t = views.get(a?.resolveTarget) || views.get(a?.view);
      if (t) targets.set(this,t);
    }
    return pass;
  };
  const copy = encoder.copyTextureToTexture;
  encoder.copyTextureToTexture = function (src,dst,size) {
    const value = copy.call(this,src,dst,size);
    if (surfaces.has(dst.texture)) targets.set(this,dst.texture);
    return value;
  };
  const finish = encoder.finish;
  encoder.finish = function (...args) {
    const buffer = finish.apply(this,args);
    if (targets.has(this)) buffers.set(buffer, targets.get(this));
    return buffer;
  };
  const submit = queue.submit;
  queue.submit = function (commands) {
    const list = Array.isArray(commands) ? commands : Array.from(commands);
    const value = submit.call(this,list);
    for (const command of list) {
      const t = buffers.get(command);
      if (t && t !== lastPresented) {
        lastPresented = t;
        self.postMessage({type:'pvsspw-submit',time:performance.timeOrigin + performance.now()});
        self.pvCaptureTexture?.(t);
      }
    }
    return value;
  };
})();
