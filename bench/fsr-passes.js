// Test worker only. Reuse the game's actual pipelines and bound native stage for
// a lossless screenshot pair from the same frame, outside the timing windows.
(() => {
  const counts = { 'present-scale': 0, 'fsr1-easu': 0, 'fsr1-rcas': 0 };
  const passes = {}, inputs = new WeakMap(), textures = new WeakMap();
  let device, stage;
  const createTexture = GPUDevice.prototype.createTexture;
  GPUDevice.prototype.createTexture = function (desc) {
    const texture = createTexture.call(this, desc);
    if (desc.label === 'present-stage') { device = this; stage = texture; }
    return texture;
  };
  const createView = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (...args) {
    const view = createView.apply(this, args); textures.set(view, this); return view;
  };
  const createGroup = GPUDevice.prototype.createBindGroup;
  GPUDevice.prototype.createBindGroup = function (desc) {
    const group = createGroup.call(this, desc);
    if (desc.label === 'present-scale' || desc.label === 'fsr1-input')
      inputs.set(group, textures.get(desc.entries.find(e => e.binding === 0)?.resource));
    return group;
  };
  const begin = GPUCommandEncoder.prototype.beginRenderPass;
  GPUCommandEncoder.prototype.beginRenderPass = function (desc) {
    const pass = begin.call(this, desc), label = desc.label;
    if (!Object.hasOwn(counts, label)) return pass;
    counts[label]++;
    // Refresh only when capturing, to follow resized targets and live toggles.
    if (!self.fsrCheck.recording) return pass;
    const state = { dst: desc.colorAttachments[0].view };
    passes[label] = state;
    const pipeline = pass.setPipeline, group = pass.setBindGroup;
    pass.setPipeline = function (p) { state.pipeline = p; return pipeline.call(this, p); };
    pass.setBindGroup = function (i, g, ...rest) {
      if (i === 0) state.group = g;
      return group.call(this, i, g, ...rest);
    };
    return pass;
  };
  function draw(encoder, state, dst) {
    const pass = encoder.beginRenderPass({ colorAttachments: [{
      view: dst, clearValue: [0,0,0,1], loadOp: 'clear', storeOp: 'store',
    }] });
    pass.setPipeline(state.pipeline); pass.setBindGroup(0, state.group);
    pass.draw(3); pass.end();
  }
  async function pair() {
    const off = passes['present-scale'], easu = passes['fsr1-easu'], rcas = passes['fsr1-rcas'];
    const out = textures.get(rcas.dst), scratch = textures.get(easu.dst);
    if (!stage || inputs.get(off.group) !== stage || inputs.get(easu.group) !== stage ||
        inputs.get(rcas.group) !== scratch || scratch.width !== out.width || scratch.height !== out.height)
      throw Error('The passes do not share the native game texture and output dimensions');
    const encoder = device.createCommandEncoder();
    const owned = [], pending = [];
    function read(texture) {
      const {width, height, format} = texture;
      if (!['bgra8unorm','rgba8unorm'].includes(format)) throw Error('Unexpected screenshot format ' + format);
      const stride = Math.ceil(width * 4 / 256) * 256;
      const buffer = device.createBuffer({size: stride * height, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
      owned.push(buffer);
      encoder.copyTextureToBuffer({texture}, {buffer, bytesPerRow: stride}, [width,height]);
      pending.push({buffer,width,height,format,stride});
    }
    try {
      read(stage);
      for (const enabled of [false,true]) {
        const target = device.createTexture({size: [out.width,out.height], format: out.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC});
        owned.push(target);
        if (enabled) draw(encoder, easu, easu.dst);
        draw(encoder, enabled ? rcas : off, target.createView());
        read(target);
      }
      // One submit: all three images see exactly the same native game frame.
      device.queue.submit([encoder.finish()]);
      const screenshots = [];
      for (const {buffer,width,height,format,stride} of pending) {
        await buffer.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(buffer.getMappedRange()), image = new ImageData(width,height);
        for (let y = 0; y < height; y++)
          image.data.set(bytes.subarray(y*stride,y*stride+width*4), y*width*4);
        if (format === 'bgra8unorm') for (let i=0; i<image.data.length; i+=4) {
          const r = image.data[i+2]; image.data[i+2] = image.data[i]; image.data[i] = r;
        }
        // The WebGPU canvas surface uses alphaMode: 'opaque'; match on-screen RGB without alpha holes.
        for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
        const canvas = new OffscreenCanvas(width,height);
        canvas.getContext('2d').putImageData(image,0,0);
        const blob = await canvas.convertToBlob({type:'image/png'});
        screenshots.push(new FileReaderSync().readAsDataURL(blob).split(',')[1]);
      }
      return screenshots;
    } finally { for (const resource of owned) resource.destroy(); }
  }
  self.fsrCheck = { counts, recording: false, pair };
})();
