// Test worker only. Compare successive game output textures before they are
// recycled. Keep pixels on the GPU and read one flag per submission at the end.
(() => {
  if (self.battlePictures) return;
  const shader = `
    @group(0) @binding(0) var surface: texture_2d<f32>;
    @group(0) @binding(1) var<storage, read_write> previous: array<u32>;
    @group(0) @binding(2) var<storage, read_write> result: atomic<u32>;
    var<workgroup> groupFlags: atomic<u32>;
    @compute @workgroup_size(16, 8)
    fn compare(@builtin(global_invocation_id) id: vec3u, @builtin(local_invocation_index) lane: u32) {
      let size = textureDimensions(surface);
      if (all(id.xy < size)) {
        let p = id.y * size.x + id.x;
        let rgb = pack4x8unorm(vec4f(textureLoad(surface, id.xy, 0).rgb, 1.0));
        if (previous[p] != rgb) {
          previous[p] = rgb;
          let center = all(id.xy >= size / 4u) && all(id.xy < size * 3u / 4u);
          atomicOr(&groupFlags, select(1u, 3u, center));
        }
      }
      workgroupBarrier();
      if (lane == 0u) {
        let flags = atomicLoad(&groupFlags);
        if (flags != 0u) { atomicOr(&result, flags); }
      }
    }`;
  let trial;
  function initialize(t, texture) {
    const d = self.battleDevices.get(texture);
    if (!d || !['rgba8unorm','bgra8unorm'].includes(texture.format))
      throw Error('Unsupported surface or missing WebGPU device: ' + texture.format);
    t.device = d;
    t.width = texture.width;
    t.height = texture.height;
    t.format = texture.format;
    t.capacity = Math.ceil(t.seconds * 240) + 2;
    const storage = GPUBufferUsage.STORAGE, src = GPUBufferUsage.COPY_SRC, dst = GPUBufferUsage.COPY_DST;
    t.previous = d.createBuffer({size: t.width * t.height * 4, usage: storage});
    t.scratch = d.createBuffer({size: 4, usage: storage | src | dst});
    t.flags = d.createBuffer({size: t.capacity * 4, usage: src | dst});
    t.pipeline = d.createComputePipeline({layout: 'auto', compute: {
      module: d.createShaderModule({code: shader}), entryPoint: 'compare',
    }});
    t.onError = e => { t.error = e.error.message; };
    d.addEventListener('uncapturederror', t.onError);
    d.lost.then(info => { t.error = 'Device lost: ' + info.message; });
  }
  function capture(texture) {
    const t = trial;
    if (!t || t.finished || t.error) return;
    try {
      if (!t.device) initialize(t, texture);
      const now = performance.now();
      if (t.begin !== undefined && now >= t.begin + 1000 * t.seconds) return;
      if (texture.width !== t.width || texture.height !== t.height || texture.format !== t.format)
        throw Error('Game surface changed during measurement');
      const i = t.times.length;
      if (i >= t.capacity) throw Error('Frame buffer capacity exceeded');
      const d = t.device, e = d.createCommandEncoder();
      e.clearBuffer(t.scratch);
      const pass = e.beginComputePass();
      pass.setPipeline(t.pipeline);
      pass.setBindGroup(0, d.createBindGroup({layout: t.pipeline.getBindGroupLayout(0), entries: [
        {binding: 0, resource: texture.createView()},
        {binding: 1, resource: {buffer: t.previous}}, {binding: 2, resource: {buffer: t.scratch}},
      ]}));
      pass.dispatchWorkgroups(Math.ceil(t.width / 16), Math.ceil(t.height / 8));
      pass.end();
      e.copyBufferToBuffer(t.scratch, 0, t.flags, i * 4, 4);
      d.queue.submit([e.finish()]);
      if (t.begin === undefined) t.begin = now;
      t.times.push(now - t.begin); // slot zero contains the uncounted baseline
    } catch (e) { t.error = String(e); }
  }
  async function result() {
    const t = trial;
    if (!t) return {status:'idle'};
    if (t.error) throw Error(t.error);
    if (t.finished) return t.finished;
    if (!t.times.length) return {status:'waiting for game texture'};
    const elapsed = (performance.now() - t.begin) / 1000;
    if (elapsed < t.seconds) return {status:'running', elapsed, samples:t.times.length - 1};
    const d = t.device, bytes = t.times.length * 4;
    const read = d.createBuffer({size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
    try {
      const e = d.createCommandEncoder();
      e.copyBufferToBuffer(t.flags, 0, read, 0, bytes);
      d.queue.submit([e.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      if (t.error) throw Error(t.error);
      const flags = new Uint32Array(read.getMappedRange());
      const minutes = Array.from({length:Math.ceil(t.seconds/60)}, () => ({submissions:0, changed:0, centerChanged:0}));
      const gaps = [];
      let last = 0, changes = 0, center = 0;
      for (let i = 1; i < flags.length; i++) {
        const b = minutes[Math.floor(t.times[i] / 60000)];
        b.submissions++;
        if (flags[i] & 1) {
          b.changed++;
          changes++;
          gaps.push(t.times[i] - last);
          last = t.times[i];
        }
        if (flags[i] & 2) { b.centerChanged++; center++; }
      }
      gaps.sort((a,b) => a-b);
      const percentile = p => gaps.length ? gaps[Math.ceil(p*gaps.length)-1] : null;
      const submissions = flags.length - 1;
      t.finished = {status:'complete', seconds:t.seconds, startEpochMs:performance.timeOrigin+t.begin,
        width:t.width, height:t.height, format:t.format, submissions, changed:changes, centerChanged:center,
        duplicates:submissions-changes, pictureFps:changes/t.seconds, centerFps:center/t.seconds,
        submissionRate:submissions/t.seconds, p50ChangeGapMs:percentile(.5), p95ChangeGapMs:percentile(.95),
        longestGapIncludingTailMs:Math.max(gaps.at(-1)||0,t.seconds*1000-last), minutes};
      return t.finished;
    } finally {
      read.destroy();
      t.previous.destroy(); t.scratch.destroy(); t.flags.destroy();
      d.removeEventListener('uncapturederror', t.onError);
    }
  }
  self.battlePictures = {
    start(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) throw Error('Expected a positive duration');
      if (trial && !trial.finished) throw Error('A measurement is already active');
      trial = {seconds, times:[]};
      self.pvCaptureTexture = capture;
    },
    discard() {
      if (trial && !trial.finished) {
        for (const buffer of [trial.previous, trial.scratch, trial.flags]) buffer?.destroy();
        if (trial.device) trial.device.removeEventListener('uncapturederror', trial.onError);
      }
      trial = undefined;
      self.pvCaptureTexture = undefined;
    }, result,
  };
})();
