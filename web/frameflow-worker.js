// SPDX-License-Identifier: AGPL-3.0-only
// Additional Terms: see vendor/frameflow/LICENSE
/**
 * PVSSPW FrameFlow WebGPU Worker Integration (GameFI Interpolation + GameSR 2x SR, zero-copy shared GPUDevice).
 *
 * Loaded via ES module import BEFORE worker-probe.js and Vitaslop's worker.js:
 *  - Enables `shader-f16` on Vitaslop's GPUDevice when supported by the adapter.
 *  - When GameFI / GameSR is active, redirects Vitaslop's swapchain acquisition into a
 *    3-slot same-device GPUTexture ring (zero CPU readback, zero format mismatch).
 *  - Runs GameFI optical-flow interpolation and optional GameSR 2x super-resolution asynchronously
 *    on the shared GPU and paces strictly monotonic frames to the real OffscreenCanvas swapchain.
 *  - When both are off (default), introduces zero GPU or CPU overhead.
 */
import { WebGPUEngine, loadModelFromUrl } from '/ui/vendor/frameflow/index.js';

const PRESETS = {
  'lite-2x': { model: 'lite', factor: 2, label: '2× · Lite' },
  'std-2x': { model: 'std', factor: 2, label: '2× · Std' },
  'lite-3x': { model: 'lite', factor: 3, label: '3× · Lite' },
  'std-3x': { model: 'std', factor: 3, label: '3× · Std' },
};

const SR_PRESETS = {
  'sr-lite': { model: 'sr_lite', scale: 2, label: '2× · Lite' },
  'sr-std': { model: 'sr_std', scale: 2, label: '2× · Std' },
};

const query = new URL(self.location.href).searchParams;
const softwarePresent = query.get('uiPresent') === 'software';
const initialPreset = PRESETS[query.get('uiFrameflow')] ? query.get('uiFrameflow') : 'off';
const initialSrPreset = SR_PRESETS[query.get('uiSr')] ? query.get('uiSr') : 'off';

if (globalThis.GPUCanvasContext && globalThis.GPUDevice && globalThis.GPUQueue && globalThis.GPUCommandEncoder && globalThis.GPUTexture) {
  // Capture raw native prototypes BEFORE worker-probe.js or capture-game.js wraps them.
  const rawRequestDevice = globalThis.GPUAdapter?.prototype?.requestDevice;
  const rawConfigure = GPUCanvasContext.prototype.configure;
  const rawGetCurrentTexture = GPUCanvasContext.prototype.getCurrentTexture;
  const rawCreateView = GPUTexture.prototype.createView;
  const rawDestroyTex = GPUTexture.prototype.destroy;
  const rawCreateEncoder = GPUDevice.prototype.createCommandEncoder;
  const rawBeginRenderPass = GPUCommandEncoder.prototype.beginRenderPass;
  const rawCopyTexToTex = GPUCommandEncoder.prototype.copyTextureToTexture;
  const rawFinish = GPUCommandEncoder.prototype.finish;
  const rawSubmit = GPUQueue.prototype.submit;

  // Request shader-f16 on Vitaslop's shared device when available for 2x FrameFlow compute speed.
  if (rawRequestDevice && !softwarePresent) {
    GPUAdapter.prototype.requestDevice = async function (desc) {
      if (this.features?.has('shader-f16')) {
        const prev = Array.from(desc?.requiredFeatures || []);
        if (!prev.includes('shader-f16')) {
          try {
            return await rawRequestDevice.call(this, { ...(desc || {}), requiredFeatures: [...prev, 'shader-f16'] });
          } catch (_) {
            // Fall back cleanly if the driver rejects combining shader-f16 with other requested limits.
          }
        }
      }
      return rawRequestDevice.call(this, desc);
    };
  }

  let mainCtx = null;
  let mainDevice = null;
  let mainFormat = 'bgra8unorm';
  let mainUsage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;
  let lastConfigureDesc = null;
  let captureW = 0;
  let captureH = 0;
  let swapTargetW = 0;
  let swapTargetH = 0;

  let requestedPreset = softwarePresent ? 'off' : initialPreset;
  let requestedSrPreset = softwarePresent ? 'off' : initialSrPreset;
  let engine = null;
  const modelCache = new Map(); // modelName -> loadedModel
  let loadingTicket = 0;
  let srLoadingTicket = 0;
  let activeModelName = null;
  let sessionModelName = null;
  let activeFactor = 2;
  let session = null;
  let activeSrModelName = null;
  let srSessionModelName = null;
  let srSession = null;
  let ringTextures = [];
  let ringW = 0;
  let ringH = 0;
  let ringFmt = '';
  let ringDirty = false;
  let captureSlot = 0;
  let prevSlot = -1;
  let currSlot = -1;
  let lastSourceTime = 0;
  let emaIntervalMs = 33.33;
  let highFpsStreak = 0;
  let bypassing = false;
  let perfTier = 0;
  let overloadStreak = 0;
  let lastPerfCheckMs = 0;
  let checkMidCount = 0;
  let thermalBypass = false;
  let presentQueue = [];
  let subFrameTimer = null;
  let lastError = null;
  let loading = false;
  let srLastError = null;
  let srLoading = false;
  let avgSrMs = 0;
  let gpuBusy = false;

  // Stats window
  let winStart = performance.now();
  let winSources = 0;
  let winPresented = 0;
  let winMid = 0;
  let totalSources = 0;
  let totalPresented = 0;
  let totalMid = 0;
  let totalDropped = 0;
  let avgGpuMs = 0;
  let lastStatsPost = 0;

  // Track which command buffers render into our capture ring textures.
  const ringSlotByTex = new WeakMap();
  const viewToRingSlot = new WeakMap();
  const encToRingSlot = new WeakMap();
  const cmdToRingSlot = new WeakMap();

  function isInterpReady() {
    return requestedPreset !== 'off' && !!engine && !!activeModelName && modelCache.has(activeModelName);
  }

  function isSrReady() {
    return requestedSrPreset !== 'off' && !!engine && !!activeSrModelName && modelCache.has(activeSrModelName);
  }

  function isReadyToIntercept() {
    return !softwarePresent && !!mainDevice && !!mainCtx && (isInterpReady() || isSrReady());
  }

  function syncSwapchainSize() {
    if (!mainCtx?.canvas || !lastConfigureDesc || captureW <= 0 || captureH <= 0) return;
    const wantW = srSession ? Math.min(1920, srSession.outW) : captureW;
    const wantH = srSession ? Math.min(1088, srSession.outH) : captureH;
    if (mainCtx.canvas.width !== wantW || mainCtx.canvas.height !== wantH) {
      mainCtx.canvas.width = wantW;
      mainCtx.canvas.height = wantH;
      swapTargetW = wantW;
      swapTargetH = wantH;
      rawConfigure.call(mainCtx, lastConfigureDesc);
    } else {
      swapTargetW = wantW;
      swapTargetH = wantH;
    }
  }

  function destroyRingAndSession() {
    clearSubFrameTimer();
    if (session) {
      session.destroy();
      session = null;
    }
    sessionModelName = null;
    if (srSession) {
      srSession.destroy();
      srSession = null;
    }
    srSessionModelName = null;
    for (const tex of ringTextures) {
      try { rawDestroyTex.call(tex); } catch (_) {}
    }
    ringTextures = [];
    ringW = 0;
    ringH = 0;
    ringFmt = '';
    ringDirty = false;
    resetPacing();
    syncSwapchainSize();
  }

  function resetPacing() {
    captureSlot = 0;
    prevSlot = -1;
    currSlot = -1;
    lastSourceTime = 0;
    emaIntervalMs = activeFactor === 3 ? 50.0 : 33.33;
    highFpsStreak = 0;
    bypassing = false;
    presentQueue = [];
  }

  function ensureRingAndSession(width, height, format) {
    const wantInterp = isInterpReady();
    const wantSr = isSrReady();
    if (!engine || !mainDevice || (!wantInterp && !wantSr)) {
      if (ringTextures.length || session || srSession) destroyRingAndSession();
      return false;
    }
    if (width <= 0 || height <= 0) return false;

    const ringChanged = ringTextures.length !== 3 || width !== ringW || height !== ringH || format !== ringFmt;
    if (ringChanged) {
      if (session) { session.destroy(); session = null; sessionModelName = null; }
      if (srSession) { srSession.destroy(); srSession = null; srSessionModelName = null; }
      for (const tex of ringTextures) {
        try { rawDestroyTex.call(tex); } catch (_) {}
      }
      const texUsage = mainUsage | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
      const textures = [];
      for (let i = 0; i < 3; i++) {
        const tex = mainDevice.createTexture({
          label: `frameflow-ring-${i}`,
          size: [width, height],
          format,
          usage: texUsage,
        });
        // Prevent guest/wgpu SurfaceTexture drop hooks from prematurely destroying a ring slot.
        tex.destroy = () => {};
        ringSlotByTex.set(tex, i);
        textures.push(tex);
      }
      ringTextures = textures;
      ringW = width;
      ringH = height;
      ringFmt = format;
      resetPacing();
    }

    let createdAny = ringChanged;
    if (!wantInterp) {
      if (session) {
        clearSubFrameTimer();
        session.destroy();
        session = null;
        sessionModelName = null;
        resetPacing();
      }
    } else if (!session || ringDirty || sessionModelName !== activeModelName) {
      clearSubFrameTimer();
      if (session) { session.destroy(); session = null; }
      const model = modelCache.get(activeModelName);
      const highRes = width * height > 1280 * 720;
      const lowTier = perfTier >= 1 || highRes;
      const nextSession = engine.createSession(model, {
        width,
        height,
        internal: lowTier
          ? (perfTier >= 1 ? [256, 160] : [384, 224])
          : (activeModelName === 'lite' ? [384, 224] : 'auto'),
        sampling: lowTier ? 'bilinear' : 'model',
        stillGuard: !lowTier,
      });
      nextSession.addInput();  // slot 2 (3-slot ring)
      nextSession.addOutput(); // output slot 1 (for 3x interpolation)
      for (let i = 0; i < 3; i++) {
        nextSession.setExternalInputTexture(i, ringTextures[i]);
      }
      session = nextSession;
      sessionModelName = activeModelName;
      lastPerfCheckMs = performance.now();
      checkMidCount = 0;
      resetPacing();
      createdAny = true;
    }

    if (!wantSr) {
      if (srSession) {
        srSession.destroy();
        srSession = null;
        srSessionModelName = null;
        avgSrMs = 0;
        createdAny = true;
      }
    } else if (!srSession || srSessionModelName !== activeSrModelName) {
      if (srSession) { srSession.destroy(); srSession = null; }
      const srModel = modelCache.get(activeSrModelName);
      srSession = engine.createSession(srModel, { width, height });
      srSessionModelName = activeSrModelName;
      createdAny = true;
    }

    ringDirty = false;
    syncSwapchainSize();
    if (createdAny) postStats(true);
    return true;
  }

  function presentFrameDirect(frame, isMid = false) {
    if (!mainCtx || !mainDevice || !engine) return;
    const baseTex = session
      ? ('source' in frame ? session.inputTexture(frame.source) : session.outputTexture(frame.output ?? 0))
      : ringTextures[frame.source ?? 0];
    if (!baseTex) return;

    let blitTex = baseTex;
    let srStartMs = 0;
    if (srSession && isSrReady()) {
      srStartMs = performance.now();
      srSession.setExternalInputTexture(0, baseTex);
      srSession.upscale(0, 0);
      blitTex = srSession.outputTexture(0);
    }

    let swapTex;
    try {
      swapTex = rawGetCurrentTexture.call(mainCtx);
    } catch (_) {
      return;
    }
    const pipe = engine._getBlitPipe(mainFormat);
    const bg = mainDevice.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: rawCreateView.call(blitTex) },
        { binding: 1, resource: engine.sampler },
      ],
    });
    const enc = rawCreateEncoder.call(mainDevice);
    const pass = rawBeginRenderPass.call(enc, {
      colorAttachments: [{
        view: rawCreateView.call(swapTex),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bg);
    pass.draw(3);
    pass.end();
    rawSubmit.call(mainDevice.queue, [rawFinish.call(enc)]);
    if (srStartMs > 0 && (!session || bypassing) && mainDevice?.queue?.onSubmittedWorkDone && !gpuBusy) {
      gpuBusy = true;
      mainDevice.queue.onSubmittedWorkDone().then(() => {
        const dt = performance.now() - srStartMs;
        avgSrMs = avgSrMs ? avgSrMs * 0.8 + dt * 0.2 : dt;
        gpuBusy = false;
      }, () => {
        gpuBusy = false;
      });
    }
    winPresented++;
    totalPresented++;
    if (isMid) {
      winMid++;
      totalMid++;
    }
  }

  function clearSubFrameTimer() {
    if (subFrameTimer !== null) {
      clearTimeout(subFrameTimer);
      subFrameTimer = null;
    }
  }

  function drainPresentQueue() {
    clearSubFrameTimer();
    if (!isInterpReady() || !session) return;
    const now = performance.now();
    while (presentQueue.length > 1 && presentQueue[1].dueMs <= now) {
      presentQueue.shift();
      totalDropped++;
    }
    if (presentQueue.length > 0 && presentQueue[0].dueMs <= now + 3.0) {
      const item = presentQueue.shift();
      presentFrameDirect(
        item.kind === 'source' ? { source: item.slot } : { output: item.outSlot },
        item.kind === 'mid',
      );
    }
    if (presentQueue.length > 0) {
      const delay = Math.max(1, Math.round(presentQueue[0].dueMs - performance.now()));
      subFrameTimer = setTimeout(drainPresentQueue, delay);
    }
    if (now - lastStatsPost >= 500) {
      postStats(false);
    }
  }

  function onCapturedSourceFrame(slot, now) {
    winSources++;
    totalSources++;

    if (!isInterpReady() || !session) {
      captureSlot = (slot + 1) % 3;
      if (!gpuBusy) {
        presentFrameDirect({ source: slot }, false);
      }
      if (now - lastStatsPost >= 500) postStats(false);
      return;
    }

    // Choose a race-free next capture slot not equal to current or previous frame.
    const nextSlot = [0, 1, 2].find((s) => s !== slot && s !== currSlot);
    captureSlot = nextSlot !== undefined ? nextSlot : (slot + 1) % 3;

    if (currSlot < 0) {
      currSlot = slot;
      lastSourceTime = now;
      presentFrameDirect({ source: slot }, false);
      if (now - lastStatsPost >= 500) postStats(false);
      return;
    }

    const dt = now - lastSourceTime;
    if (dt > 4 && dt < 200) {
      emaIntervalMs = emaIntervalMs * 0.85 + dt * 0.15;
    }
    const interval = Math.min(120, Math.max(12, emaIntervalMs));
    prevSlot = currSlot;
    currSlot = slot;
    lastSourceTime = now;

    // Fast bypass when the game already renders natively near 60 FPS.
    if (activeFactor === 2 && emaIntervalMs < 21.0) {
      highFpsStreak++;
      if (highFpsStreak >= 6) bypassing = true;
    } else if (emaIntervalMs >= 24.0 || activeFactor === 3) {
      highFpsStreak = 0;
      bypassing = false;
    }

    // Flush any remaining stale sub-frame from the previous pair before starting the new pair.
    if (presentQueue.length > 0) {
      const stale = presentQueue.splice(0, presentQueue.length);
      totalDropped += stale.length;
    }
    clearSubFrameTimer();

    if (bypassing || thermalBypass || !session || gpuBusy) {
      if (!srSession || !gpuBusy) {
        presentFrameDirect({ source: slot }, false);
      }
      if (now - lastStatsPost >= 500) postStats(false);
      return;
    }

    try {
      const t0 = performance.now();
      session.pair(prevSlot, currSlot);
      for (let i = 1; i < activeFactor; i++) {
        const t = i / activeFactor;
        const outSlot = i - 1;
        session.mid(t, outSlot);
        checkMidCount++;
        if (i === 1) {
          // Present first interpolated sub-frame immediately (monotonic: prev -> mid1 -> ... -> curr).
          presentFrameDirect({ output: outSlot }, true);
        } else {
          presentQueue.push({
            kind: 'mid',
            outSlot,
            t,
            dueMs: now + interval * ((i - 1) / activeFactor),
          });
        }
      }
      // Schedule real current frame after the interpolated sub-frame(s).
      presentQueue.push({
        kind: 'source',
        slot,
        dueMs: now + interval * ((activeFactor - 1) / activeFactor),
      });
      const firstDelay = Math.max(1, Math.round(presentQueue[0].dueMs - performance.now()));
      subFrameTimer = setTimeout(drainPresentQueue, firstDelay);

      if (mainDevice?.queue?.onSubmittedWorkDone) {
        gpuBusy = true;
        mainDevice.queue.onSubmittedWorkDone().then(() => {
          const elapsed = performance.now() - t0;
          avgGpuMs = avgGpuMs ? avgGpuMs * 0.8 + elapsed * 0.2 : elapsed;
          gpuBusy = false;
        }, () => {
          gpuBusy = false;
        });
      }

      if (now - lastPerfCheckMs >= 2000 && checkMidCount >= 10) {
        lastPerfCheckMs = now;
        checkMidCount = 0;
        if (avgGpuMs > 28.0) overloadStreak++;
        else overloadStreak = 0;
        if (overloadStreak >= 2) {
          if (perfTier === 0) {
            perfTier = 1;
            ringDirty = true;
            overloadStreak = 0;
            avgGpuMs = 0;
            postStats(true);
          } else if (perfTier === 1) {
            perfTier = 2;
            thermalBypass = true;
            overloadStreak = 0;
            clearSubFrameTimer();
            presentQueue.length = 0;
            postStats(true);
          }
        }
      }
    } catch (err) {
      lastError = String(err?.message || err);
      presentFrameDirect({ source: slot }, false);
    }
    if (now - lastStatsPost >= 500) {
      postStats(false);
    }
  }

  function stopRafLoop() {
    clearSubFrameTimer();
  }

  function postStats(force) {
    const now = performance.now();
    const elapsed = Math.max(1, now - winStart);
    let sourceFps = 0;
    let outputFps = 0;
    if (elapsed >= 450 || force) {
      sourceFps = Number(((winSources * 1000) / elapsed).toFixed(1));
      outputFps = Number(((winPresented * 1000) / elapsed).toFixed(1));
      if (elapsed >= 900) {
        winStart = now;
        winSources = 0;
        winPresented = 0;
        winMid = 0;
      }
    }
    lastStatsPost = now;
    const presetCfg = PRESETS[requestedPreset];
    const srCfg = SR_PRESETS[requestedSrPreset];
    self.postMessage({
      type: 'pvsspw-frameflow-stats',
      stats: {
        preset: requestedPreset,
        label: presetCfg?.label || '关闭',
        active: isInterpReady() && !!session,
        loading,
        srPreset: requestedSrPreset,
        srLabel: srCfg?.label || '关闭',
        srActive: isSrReady() && !!srSession,
        srLoading,
        srOutW: srSession?.outW || 0,
        srOutH: srSession?.outH || 0,
        avgSrMs: Number(avgSrMs.toFixed(2)),
        srError: srLastError,
        bypassing,
        perfTier,
        thermalBypass,
        softwareBlocked: softwarePresent,
        backend: engine ? engine.info().backend : null,
        precision: engine ? engine.info().precision : null,
        factor: activeFactor,
        width: ringW,
        height: ringH,
        workW: session?.workW || 0,
        workH: session?.workH || 0,
        sourceFps,
        outputFps,
        avgGpuMs: Number(avgGpuMs.toFixed(2)),
        totalSources,
        totalPresented,
        totalMid,
        totalDropped,
        error: lastError,
      },
    });
  }

  async function ensureEngineAndModel(modelName) {
    if (!engine) {
      engine = await WebGPUEngine.create({ device: mainDevice });
    }
    if (!modelCache.has(modelName)) {
      const model = await loadModelFromUrl(engine, `/ui/vendor/frameflow/models/${modelName}`);
      modelCache.set(modelName, model);
    }
  }

  function refreshActiveSessions() {
    if (captureW > 0 && captureH > 0) {
      ensureRingAndSession(captureW, captureH, mainFormat);
    } else {
      postStats(true);
    }
  }

  async function applyPreset(preset) {
    const normalized = PRESETS[preset] ? preset : 'off';
    requestedPreset = softwarePresent ? 'off' : normalized;
    lastError = null;
    perfTier = 0;
    thermalBypass = false;
    overloadStreak = 0;
    checkMidCount = 0;
    avgGpuMs = 0;
    const ticket = ++loadingTicket;

    if (requestedPreset === 'off') {
      loading = false;
      activeModelName = null;
      stopRafLoop();
      refreshActiveSessions();
      return;
    }

    if (!mainDevice) {
      loading = true;
      postStats(true);
      return;
    }

    const cfg = PRESETS[requestedPreset];
    loading = true;
    postStats(true);
    try {
      await ensureEngineAndModel(cfg.model);
      if (ticket !== loadingTicket) return;
      const modelChanged = activeModelName !== cfg.model;
      activeModelName = cfg.model;
      activeFactor = cfg.factor;
      if (modelChanged) ringDirty = true;
      loading = false;
      refreshActiveSessions();
    } catch (err) {
      if (ticket !== loadingTicket) return;
      loading = false;
      lastError = String(err?.message || err);
      requestedPreset = 'off';
      activeModelName = null;
      stopRafLoop();
      refreshActiveSessions();
    }
  }

  async function applySrPreset(preset) {
    const normalized = SR_PRESETS[preset] ? preset : 'off';
    requestedSrPreset = softwarePresent ? 'off' : normalized;
    srLastError = null;
    avgSrMs = 0;
    const ticket = ++srLoadingTicket;

    if (requestedSrPreset === 'off') {
      srLoading = false;
      activeSrModelName = null;
      refreshActiveSessions();
      return;
    }

    if (!mainDevice) {
      srLoading = true;
      postStats(true);
      return;
    }

    const cfg = SR_PRESETS[requestedSrPreset];
    srLoading = true;
    postStats(true);
    try {
      await ensureEngineAndModel(cfg.model);
      if (ticket !== srLoadingTicket) return;
      activeSrModelName = cfg.model;
      srLoading = false;
      refreshActiveSessions();
    } catch (err) {
      if (ticket !== srLoadingTicket) return;
      srLoading = false;
      srLastError = String(err?.message || err);
      requestedSrPreset = 'off';
      activeSrModelName = null;
      refreshActiveSessions();
    }
  }

  // Hook WebGPU entry points cleanly without altering swapchain usage flags
  // (modifying swapchain usage can trigger Dawn OpaqueFD ImportMemory faults on NVIDIA/Linux).
  GPUCanvasContext.prototype.configure = function (descriptor) {
    lastConfigureDesc = { ...descriptor };
    if (this.canvas && (this.canvas.width !== swapTargetW || this.canvas.height !== swapTargetH)) {
      captureW = Math.min(960, this.canvas.width || 0);
      captureH = Math.min(544, this.canvas.height || 0);
    }
    const result = rawConfigure.call(this, descriptor);
    const usage = descriptor?.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
    const deviceChanged = mainDevice && mainDevice !== descriptor.device;
    mainCtx = this;
    mainDevice = descriptor.device;
    mainFormat = descriptor.format || navigator.gpu.getPreferredCanvasFormat();
    mainUsage = usage;
    if (deviceChanged) {
      destroyRingAndSession();
      for (const m of modelCache.values()) m.destroy();
      modelCache.clear();
      engine = null;
    } else if (ringFmt && ringFmt !== mainFormat) {
      ringDirty = true;
    }
    if (requestedPreset !== 'off' && (!engine || !activeModelName)) {
      void applyPreset(requestedPreset);
    }
    if (requestedSrPreset !== 'off' && (!engine || !activeSrModelName)) {
      void applySrPreset(requestedSrPreset);
    }
    if (isReadyToIntercept()) {
      refreshActiveSessions();
    }
    return result;
  };

  GPUCanvasContext.prototype.getCurrentTexture = function (...args) {
    if (this === mainCtx && isReadyToIntercept()) {
      const w = captureW || this.canvas?.width || 0;
      const h = captureH || this.canvas?.height || 0;
      if (w > 0 && h > 0 && ensureRingAndSession(w, h, mainFormat)) {
        return ringTextures[captureSlot];
      }
    }
    return rawGetCurrentTexture.apply(this, args);
  };

  GPUTexture.prototype.createView = function (...args) {
    const view = rawCreateView.apply(this, args);
    const slot = ringSlotByTex.get(this);
    if (slot !== undefined) viewToRingSlot.set(view, slot);
    return view;
  };

  GPUCommandEncoder.prototype.beginRenderPass = function (desc) {
    const pass = rawBeginRenderPass.call(this, desc);
    if (desc?.colorAttachments) {
      for (const att of desc.colorAttachments) {
        const slot = viewToRingSlot.get(att?.resolveTarget) ?? viewToRingSlot.get(att?.view);
        if (slot !== undefined) encToRingSlot.set(this, slot);
      }
    }
    return pass;
  };

  GPUCommandEncoder.prototype.copyTextureToTexture = function (src, dst, size) {
    const res = rawCopyTexToTex.call(this, src, dst, size);
    const slot = dst?.texture ? ringSlotByTex.get(dst.texture) : undefined;
    if (slot !== undefined) encToRingSlot.set(this, slot);
    return res;
  };

  GPUCommandEncoder.prototype.finish = function (...args) {
    const cmd = rawFinish.apply(this, args);
    const slot = encToRingSlot.get(this);
    if (slot !== undefined) cmdToRingSlot.set(cmd, slot);
    return cmd;
  };

  GPUQueue.prototype.submit = function (commands) {
    const list = Array.isArray(commands) ? commands : Array.from(commands);
    const res = rawSubmit.call(this, list);
    for (const cmd of list) {
      const slot = cmdToRingSlot.get(cmd);
      if (slot !== undefined) {
        onCapturedSourceFrame(slot, performance.now());
      }
    }
    return res;
  };

  self.addEventListener('message', (event) => {
    if (event.data?.type === 'pvsspw-frameflow') {
      event.stopImmediatePropagation();
      void applyPreset(event.data.preset);
    } else if (event.data?.type === 'pvsspw-sr') {
      event.stopImmediatePropagation();
      void applySrPreset(event.data.preset);
    }
  });
}
